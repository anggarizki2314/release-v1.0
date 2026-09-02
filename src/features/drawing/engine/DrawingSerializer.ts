/**
 * Drawing Engine — DrawingSerializer
 *
 * Serialize/deserialize drawings to/from JSON.
 * Versioned format for forward compatibility.
 */

import type { DrawingObject, SerializedDrawing } from './types';

const SERIALIZATION_VERSION = 1;

export class DrawingSerializer {
  serialize(drawing: DrawingObject): SerializedDrawing {
    return {
      v: SERIALIZATION_VERSION,
      id: drawing.id,
      type: drawing.type,
      points: drawing.points.map((p) => ({ t: p.time, p: p.price })),
      style: { ...drawing.style },
      text: drawing.text,
      rotation: drawing.rotation,
      locked: drawing.locked,
      hidden: drawing.hidden,
      zIndex: drawing.zIndex,
      ts: drawing.createdAt,
    };
  }

  deserialize(data: SerializedDrawing): DrawingObject | null {
    if (data.v !== SERIALIZATION_VERSION) {
      console.warn(`[Serializer] Unknown version ${data.v}, attempting migration`);
    }
    try {
      const now = Date.now();
      return {
        id: data.id,
        type: data.type,
        points: data.points.map((p) => ({ time: p.t, price: p.p })),
        style: data.style,
        text: data.text,
        rotation: data.rotation,
        selected: false,
        locked: data.locked,
        hidden: data.hidden,
        visible: true,
        zIndex: data.zIndex,
        createdAt: data.ts,
        updatedAt: now,
      };
    } catch {
      return null;
    }
  }

  serializeAll(drawings: DrawingObject[]): string {
    const serialized = drawings.map((d) => this.serialize(d));
    return JSON.stringify({ v: SERIALIZATION_VERSION, drawings: serialized });
  }

  deserializeAll(json: string): DrawingObject[] {
    try {
      const parsed = JSON.parse(json);
      const arr = parsed.drawings ?? parsed;
      if (!Array.isArray(arr)) return [];
      return arr.map((d: SerializedDrawing) => this.deserialize(d)).filter(Boolean) as DrawingObject[];
    } catch {
      return [];
    }
  }
}
