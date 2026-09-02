import crypto from 'crypto';
import os from 'os';
import https from 'https';
import { getSetting, setSetting } from '../database/db';

const SUPABASE_URL = 'https://pdkgurkmeupzmdywvaot.supabase.co';
const SUPABASE_KEY = 'sb_publishable_POstVawQaF3gjN7UjOD3CA_GMdcYsTZ';
const SECRET_SIGN_SALT = 'TRD_PONYTAIL_SECURE_SALT_2026_98FA';

// Asymmetric Public Verification Key (Ed25519)
const ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAcS/LF2KKMisOP6/9zAgGEGCzshApDBfABjhidYNunrY=
-----END PUBLIC KEY-----`;

let cachedHwid: string | null = null;

/**
 * Computes a deterministic, tamper-resistant Hardware ID (HWID)
 * based on the machine's hardware profile and OS parameters.
 */
export function getHardwareId(): string {
  if (cachedHwid) return cachedHwid;

  try {
    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'UNKNOWN_CPU';
    const totalMem = Math.round(os.totalmem() / (1024 * 1024 * 1024)); // in GB
    const platform = os.platform();
    const hostname = os.hostname();
    const username = os.userInfo().username;

    // Combine hardware indicators
    const rawFingerprint = `${platform}|${hostname}|${username}|${cpuModel}|${totalMem}GB`;
    
    // Hash into clean 20-character uppercase HWID
    const hash = crypto.createHash('sha256').update(rawFingerprint).digest('hex').substring(0, 16).toUpperCase();
    cachedHwid = `HWID-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}`;
    return cachedHwid;
  } catch (err) {
    const fallbackHash = crypto.createHash('sha256').update(os.hostname() || 'DEVICE').digest('hex').substring(0, 16).toUpperCase();
    cachedHwid = `HWID-${fallbackHash}`;
    return cachedHwid;
  }
}

/**
 * Creates a cryptographic signature for locally cached license verification.
 */
function createLocalSignature(serialKey: string, hwid: string, activatedAt: string): string {
  return crypto
    .createHmac('sha256', SECRET_SIGN_SALT)
    .update(`${serialKey}|${hwid}|${activatedAt}`)
    .digest('hex');
}

export interface LicenseStatus {
  isLicensed: boolean;
  serialKey?: string;
  hwid: string;
  activatedAt?: string;
  expiresAt?: string | null;
  plan?: string;
  planName?: string;
  message?: string;
}

/**
 * Checks local database to see if this machine already has a valid, signed license.
 */
export function checkLicenseStatus(): LicenseStatus {
  const hwid = getHardwareId();
  try {
    const storedJson = getSetting('app_license_data');
    if (!storedJson) {
      return { isLicensed: false, hwid, message: 'Belum teraktivasi' };
    }

    const data = JSON.parse(storedJson);
    if (!data.serialKey || !data.hwid || !data.signature || !data.activatedAt) {
      return { isLicensed: false, hwid, message: 'Data lisensi korup' };
    }

    // Verify HWID matches current machine
    if (data.hwid !== hwid) {
      return { isLicensed: false, hwid, message: 'Lisensi tidak cocok dengan perangkat ini' };
    }

    // Verify digital signature
    const expectedSig = createLocalSignature(data.serialKey, data.hwid, data.activatedAt);
    if (data.signature !== expectedSig) {
      return { isLicensed: false, hwid, message: 'Tanda tangan lisensi tidak valid (tampered)' };
    }

    // Verify expiration & anti-clock rollback
    const now = Date.now();
    const lastSeenStr = getSetting('app_license_last_seen');
    const lastSeen = lastSeenStr ? Number(lastSeenStr) : 0;

    if (data.exp && typeof data.exp === 'number' && data.exp > 0) {
      // 1. Anti-Rollback: Check if system clock was wound backwards
      if (lastSeen > 0 && now < lastSeen - 900000) {
        return {
          isLicensed: false,
          hwid,
          message: 'Manipulasi tanggal sistem terdeteksi. Silakan kembalikan jam/tanggal komputer ke waktu yang benar.',
        };
      }

      // 2. Check if expired
      if (now > data.exp || lastSeen > data.exp) {
        return {
          isLicensed: false,
          hwid,
          message: `Masa aktif lisensi (${data.planName || 'Pro'}) telah berakhir. Silakan hubungi admin untuk perpanjangan.`,
        };
      }

      // Record high watermark for time
      setSetting('app_license_last_seen', String(Math.max(lastSeen, now)));

      const remainingDays = Math.max(0, Math.ceil((data.exp - now) / (1000 * 60 * 60 * 24)));
      return {
        isLicensed: true,
        serialKey: data.serialKey,
        hwid,
        activatedAt: data.activatedAt,
        expiresAt: new Date(data.exp).toISOString(),
        plan: data.plan,
        planName: data.planName,
        message: `Lisensi Aktif (${data.planName || 'Pro'} — Sisa ${remainingDays} Hari)`,
      };
    }

    // Lifetime License
    setSetting('app_license_last_seen', String(Math.max(lastSeen, now)));
    return {
      isLicensed: true,
      serialKey: data.serialKey,
      hwid,
      activatedAt: data.activatedAt,
      expiresAt: null,
      plan: data.plan || 'PRO_LIFETIME',
      planName: data.planName || 'Pro Lifetime',
      message: 'Lisensi Aktif (Pro Lifetime)',
    };
  } catch (err) {
    return { isLicensed: false, hwid, message: 'Gagal memverifikasi lisensi lokal' };
  }
}

/**
 * Verifies an offline asymmetric activation key (ACT-...) signed by Admin Private Key.
 */
function verifyOfflineAsymmetricKey(activationKey: string, hwid: string): {
  success: boolean;
  message: string;
  buyer?: string;
  plan?: string;
  planName?: string;
  exp?: number;
} {
  try {
    if (!activationKey || !activationKey.startsWith('ACT-')) {
      return { success: false, message: 'Format kode aktivasi tidak dikenali.' };
    }

    const raw = activationKey.substring(4);
    const parts = raw.split('.');
    if (parts.length !== 2) {
      return { success: false, message: 'Struktur kode aktivasi tidak valid.' };
    }

    const [payloadB64, sigB64] = parts;
    const signature = Buffer.from(sigB64, 'base64url');

    // Cryptographic Ed25519 signature verification using Admin Public Key
    const isValidSig = crypto.verify(null, Buffer.from(payloadB64), ED25519_PUBLIC_KEY, signature);
    if (!isValidSig) {
      return { success: false, message: 'Kode aktivasi palsu / tanda tangan digital tidak valid!' };
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.h || payload.h.toUpperCase() !== hwid.toUpperCase()) {
      return { success: false, message: 'Kode aktivasi ini dibuat khusus untuk perangkat/laptop lain (HWID mismatch)!' };
    }

    // Check expiry timestamp if provided
    if (payload.exp && typeof payload.exp === 'number' && payload.exp > 0) {
      if (Date.now() > payload.exp) {
        return { success: false, message: 'Kode aktivasi ini sudah kedaluwarsa!' };
      }
    }

    const planName = payload.planName || (
      payload.p === 'PRO_3MONTHS' ? 'Pro 3 Bulan' :
      payload.p === 'PRO_6MONTHS' ? 'Pro 6 Bulan' :
      payload.p === 'PRO_1YEAR' ? 'Pro 1 Tahun' : 'Pro Lifetime'
    );

    return {
      success: true,
      message: `Aktivasi Offline Berhasil! Selamat datang, ${payload.b || 'Trader'}. (${planName})`,
      buyer: payload.b || 'Trader',
      plan: payload.p || 'PRO_LIFETIME',
      planName,
      exp: payload.exp || 0,
    };
  } catch (err: any) {
    return { success: false, message: 'Gagal memverifikasi kode aktivasi offline: ' + (err.message || 'Error') };
  }
}

/**
 * Hybrid activation engine:
 * 1. If key starts with ACT- -> Validates offline using Asymmetric Ed25519 signature.
 * 2. Otherwise -> Validates online using Supabase RPC database.
 */
export async function activateLicenseOnline(serialKey: string): Promise<{ success: boolean; message: string }> {
  const hwid = getHardwareId();
  const cleanKey = serialKey.trim();

  if (!cleanKey) {
    return { success: false, message: 'Serial number atau kode aktivasi tidak boleh kosong' };
  }

  // OPTION 1: Offline Asymmetric Signature Verification (ACT-...)
  if (cleanKey.toUpperCase().startsWith('ACT-')) {
    const offlineResult = verifyOfflineAsymmetricKey(cleanKey, hwid);
    if (offlineResult.success) {
      const activatedAt = new Date().toISOString();
      const signature = createLocalSignature(cleanKey, hwid, activatedAt);
      
      setSetting(
        'app_license_data',
        JSON.stringify({
          serialKey: cleanKey,
          hwid,
          activatedAt,
          signature,
          buyer: offlineResult.buyer,
          plan: offlineResult.plan,
          planName: offlineResult.planName,
          exp: offlineResult.exp,
        })
      );
      setSetting('app_license_last_seen', String(Date.now()));

      return { success: true, message: offlineResult.message };
    } else {
      return { success: false, message: offlineResult.message };
    }
  }

  // OPTION 2: Online Supabase RPC Activation (TRD-...)
  const upperKey = cleanKey.toUpperCase();
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      input_key: upperKey,
      input_hwid: hwid,
    });

    const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/activate_license`);

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let responseBody = '';

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            const result = JSON.parse(responseBody);
            if (result && result.success) {
              // Store signed license locally for 100% offline usage
              const activatedAt = new Date().toISOString();
              const signature = createLocalSignature(upperKey, hwid, activatedAt);
              
              setSetting(
                'app_license_data',
                JSON.stringify({
                  serialKey: upperKey,
                  hwid,
                  activatedAt,
                  signature,
                })
              );

              resolve({ success: true, message: result.message || 'Aktivasi Berhasil!' });
            } else {
              resolve({ success: false, message: result?.message || 'Aktivasi gagal. Periksa serial key Anda.' });
            }
          } else {
            resolve({
              success: false,
              message: `Server merespon error (${res.statusCode}): Periksa koneksi internet atau serial key.`,
            });
          }
        } catch (parseErr) {
          resolve({ success: false, message: 'Gagal memproses respon dari server lisensi.' });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        message: `Koneksi gagal: Pastikan PC Anda terhubung ke internet, atau gunakan Kode Aktivasi Manual (ACT-...).`,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, message: 'Waktu koneksi habis (Timeout). Coba lagi beberapa saat.' });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Removes local license (for testing or reset).
 */
export function deactivateLicenseLocal(): boolean {
  try {
    setSetting('app_license_data', '');
    setSetting('app_license_last_seen', '');
    return true;
  } catch (e) {
    return false;
  }
}
