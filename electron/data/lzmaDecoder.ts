/**
 * Lightweight LZMA decompressor for Dukascopy bi5 tick files.
 *
 * Dukascopy .bi5 files are compressed using standard LZMA compression.
 * Header: 5 bytes props/dictSize + 8 bytes uncompressed size + LZMA bitstream.
 */

class RangeDecoder {
  range: number = 0xffffffff;
  code: number = 0;
  buf: Uint8Array;
  pos: number = 0;

  constructor(buf: Uint8Array) {
    this.buf = buf;
    this.code = 0;
    for (let i = 0; i < 5; i++) {
      this.code = (this.code << 8) | (this.buf[this.pos++] || 0);
    }
  }

  decodeBit(probs: Uint16Array, index: number): number {
    const prob = probs[index];
    const newBound = (this.range >>> 11) * prob;

    if ((this.code >>> 0) < (newBound >>> 0)) {
      this.range = newBound;
      probs[index] = (prob + ((2048 - prob) >>> 5)) & 0xffff;
      if ((this.range & 0xff000000) === 0) {
        this.range = (this.range << 8) >>> 0;
        this.code = ((this.code << 8) | (this.buf[this.pos++] || 0)) >>> 0;
      }
      return 0;
    } else {
      this.range = (this.range - newBound) >>> 0;
      this.code = (this.code - newBound) >>> 0;
      probs[index] = (prob - (prob >>> 5)) & 0xffff;
      if ((this.range & 0xff000000) === 0) {
        this.range = (this.range << 8) >>> 0;
        this.code = ((this.code << 8) | (this.buf[this.pos++] || 0)) >>> 0;
      }
      return 1;
    }
  }

  decodeDirectBits(numBits: number): number {
    let result = 0;
    for (let i = numBits; i > 0; i--) {
      this.range = (this.range >>> 1) >>> 0;
      const t = ((this.code - this.range) >>> 0) >>> 31;
      this.code = (this.code - (this.range & (t - 1))) >>> 0;
      result = (result << 1) | (1 - t);
      if ((this.range & 0xff000000) === 0) {
        this.range = (this.range << 8) >>> 0;
        this.code = ((this.code << 8) | (this.buf[this.pos++] || 0)) >>> 0;
      }
    }
    return result;
  }
}

function initProbs(size: number): Uint16Array {
  const p = new Uint16Array(size);
  p.fill(1024);
  return p;
}

/**
 * Decompresses a Dukascopy .bi5 LZMA compressed buffer into raw uncompressed bytes.
 */
export function decompressBi5(compressedData: Buffer | Uint8Array): Buffer {
  if (!compressedData || compressedData.length < 13) {
    return Buffer.alloc(0);
  }

  const input = new Uint8Array(compressedData);
  const propsByte = input[0];
  const lc = propsByte % 9;
  const remainder = Math.floor(propsByte / 9);
  const lp = remainder % 5;
  const pb = Math.floor(remainder / 5);

  let uncompressedSize = 0;
  for (let i = 0; i < 8; i++) {
    uncompressedSize += input[5 + i] * Math.pow(2, 8 * i);
  }

  // Handle bi5 stream header (if 0xFFFFFFFF or size = -1)
  if (uncompressedSize < 0 || uncompressedSize > 100 * 1024 * 1024) {
    uncompressedSize = 250000; // Safe upper limit per hourly bi5 file
  }

  const rc = new RangeDecoder(input.subarray(13));
  const out = new Uint8Array(uncompressedSize);
  let outPos = 0;

  const kNumStates = 12;
  const isMatch = initProbs(kNumStates << 4);
  const isRep = initProbs(kNumStates);
  const isRepG0 = initProbs(kNumStates);
  const isRepG1 = initProbs(kNumStates);
  const isRepG2 = initProbs(kNumStates);
  const isRep0Long = initProbs(kNumStates << 4);

  const posSlot = initProbs(4 << 6);
  const specPos = initProbs(114);
  const align = initProbs(16);

  const lenDecoder = initProbs(2 + 16 + 256 + 16 + 256);
  const repLenDecoder = initProbs(2 + 16 + 256 + 16 + 256);

  function decodeLen(probs: Uint16Array, posState: number): number {
    if (rc.decodeBit(probs, 0) === 0) {
      let tree = 1;
      for (let i = 0; i < 3; i++) tree = (tree << 1) | rc.decodeBit(probs, 2 + (posState << 3) + tree);
      return tree - 8;
    }
    if (rc.decodeBit(probs, 1) === 0) {
      let tree = 1;
      for (let i = 0; i < 3; i++) tree = (tree << 1) | rc.decodeBit(probs, 2 + 16 + (posState << 3) + tree);
      return tree - 8 + 8;
    }
    let tree = 1;
    for (let i = 0; i < 8; i++) tree = (tree << 1) | rc.decodeBit(probs, 2 + 16 + 256 + tree);
    return tree - 256 + 8 + 8;
  }

  const literalProbs = initProbs(0x300 << (lc + lp));

  function decodeLiteral(pos: number, prevByte: number): number {
    let symbol = 1;
    const litState = (((pos & ((1 << lp) - 1)) << lc) + (prevByte >> (8 - lc))) << 8;
    if (state < 7) {
      do {
        symbol = (symbol << 1) | rc.decodeBit(literalProbs, litState + symbol);
      } while (symbol < 0x100);
    } else {
      let matchByte = out[outPos - rep0];
      do {
        const bit = (matchByte >> 7) & 1;
        matchByte <<= 1;
        const subBit = rc.decodeBit(literalProbs, litState + ((1 + bit) << 8) + symbol);
        symbol = (symbol << 1) | subBit;
        if (bit !== subBit) {
          while (symbol < 0x100) {
            symbol = (symbol << 1) | rc.decodeBit(literalProbs, litState + symbol);
          }
          break;
        }
      } while (symbol < 0x100);
    }
    return symbol & 0xff;
  }

  let state = 0;
  let rep0 = 0, rep1 = 0, rep2 = 0, rep3 = 0;

  while (outPos < uncompressedSize && rc.pos < input.length - 13) {
    const posState = outPos & ((1 << pb) - 1);
    if (rc.decodeBit(isMatch, (state << 4) + posState) === 0) {
      const prevByte = outPos > 0 ? out[outPos - 1] : 0;
      out[outPos++] = decodeLiteral(outPos, prevByte);
      state = state < 4 ? 0 : state < 10 ? state - 3 : state - 6;
    } else {
      let len: number;
      if (rc.decodeBit(isRep, state) === 1) {
        if (rc.decodeBit(isRepG0, state) === 0) {
          if (rc.decodeBit(isRep0Long, (state << 4) + posState) === 0) {
            state = state < 7 ? 9 : 11;
            out[outPos] = out[outPos - rep0];
            outPos++;
            continue;
          }
        } else {
          let distance: number;
          if (rc.decodeBit(isRepG1, state) === 0) {
            distance = rep1;
          } else {
            if (rc.decodeBit(isRepG2, state) === 0) {
              distance = rep2;
            } else {
              distance = rep3;
              rep3 = rep2;
            }
            rep2 = rep1;
          }
          rep1 = rep0;
          rep0 = distance;
        }
        len = decodeLen(repLenDecoder, posState) + 2;
        state = state < 7 ? 8 : 11;
      } else {
        rep3 = rep2;
        rep2 = rep1;
        rep1 = rep0;
        len = decodeLen(lenDecoder, posState) + 2;
        state = state < 7 ? 7 : 10;

        let slot = 1;
        const posStateSlot = Math.min(len - 2, 3) << 6;
        for (let i = 0; i < 6; i++) {
          slot = (slot << 1) | rc.decodeBit(posSlot, posStateSlot + slot);
        }
        slot -= 64;

        if (slot < 4) {
          rep0 = slot + 1;
        } else {
          const numDirectBits = (slot >> 1) - 1;
          rep0 = (2 | (slot & 1)) << numDirectBits;
          if (slot < 14) {
            let b = 1;
            for (let i = 0; i < numDirectBits; i++) {
              b = (b << 1) | rc.decodeBit(specPos, rep0 - slot - 1 + b);
            }
            rep0 += b - 1;
          } else {
            rep0 += rc.decodeDirectBits(numDirectBits - 4) << 4;
            let b = 1;
            for (let i = 0; i < 4; i++) {
              b = (b << 1) | rc.decodeBit(align, b);
            }
            rep0 += b - 1;
          }
          rep0 += 1;
        }
      }

      for (let i = 0; i < len && outPos < uncompressedSize; i++) {
        out[outPos] = out[outPos - rep0];
        outPos++;
      }
    }
  }

  return Buffer.from(out.subarray(0, outPos));
}
