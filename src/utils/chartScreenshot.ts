/**
 * Chart Screenshot Compositor Utility
 * Captures the Lightweight Charts canvas and directly composites all overlay layers
 * (Drawing canvases, Technical Indicator SVGs, Real Orders/Positions SVGs & badges,
 * Trade History execution arrows & dashed lines, News markers) into a single high-fidelity image.
 */

import type { IChartApi } from 'lightweight-charts';

export async function captureCompleteChart(
  containerEl: HTMLElement | null,
  chartApi: IChartApi | null
): Promise<string> {
  if (!chartApi) {
    throw new Error('Chart API is not available');
  }

  const baseCanvas = chartApi.takeScreenshot();
  if (!containerEl) {
    return baseCanvas.toDataURL('image/png');
  }

  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = baseCanvas.width;
  compositeCanvas.height = baseCanvas.height;
  const ctx = compositeCanvas.getContext('2d');
  if (!ctx) {
    return baseCanvas.toDataURL('image/png');
  }

  // 1. Draw base chart canvas (candlesticks, grid, watermark, axes)
  ctx.drawImage(baseCanvas, 0, 0, compositeCanvas.width, compositeCanvas.height);

  const chartEl = (containerEl.querySelector('.chart-container') as HTMLElement) || containerEl;
  const chartRect = chartEl.getBoundingClientRect();
  if (chartRect.width === 0 || chartRect.height === 0) {
    return baseCanvas.toDataURL('image/png');
  }

  const scaleX = compositeCanvas.width / chartRect.width;
  const scaleY = compositeCanvas.height / chartRect.height;

  // 2. Draw overlay canvases (DrawingCanvas, axis-overlay-canvas)
  const allCanvases = Array.from(containerEl.querySelectorAll('canvas'));
  const overlayCanvases = allCanvases.filter(
    (c) =>
      c.classList.contains('drawing-canvas') ||
      c.classList.contains('drawing-layer-canvas') ||
      c.classList.contains('axis-overlay-canvas')
  );

  for (const c of overlayCanvases) {
    try {
      const rect = c.getBoundingClientRect();
      const dx = (rect.left - chartRect.left) * scaleX;
      const dy = (rect.top - chartRect.top) * scaleY;
      const dw = rect.width * scaleX;
      const dh = rect.height * scaleY;
      ctx.drawImage(c, dx, dy, dw, dh);
    } catch (err) {
      console.warn('Failed to composite canvas layer', err);
    }
  }

  // 3. Draw overlay SVGs (Indicators, Real Orders, Trade History, News Events) directly with Canvas 2D
  const allSvgs = Array.from(containerEl.querySelectorAll('svg'));
  const overlaySvgs = allSvgs.filter((s) => {
    if (s.closest('button')) return false;
    if (s.closest('.pane-header')) return false;
    if (s.closest('.chart-area__reset-zone')) return false;
    if (s.closest('.replay-timeline')) return false;
    return true;
  });

  for (const svg of overlaySvgs) {
    drawSvgElementsToCanvas(ctx, svg as SVGSVGElement, chartRect, scaleX, scaleY);
  }

  // 4. Draw Real Order / Position badges & pills (.tv-pill-main, .tv-badge-pill, .tv-pill-toggle)
  drawAllBadges(ctx, containerEl, chartRect, scaleX, scaleY);

  return compositeCanvas.toDataURL('image/png');
}

/**
 * Directly draws SVG child elements (<line>, <rect>, <polygon>, <text>, <circle>) to Canvas 2D Context
 */
function drawSvgElementsToCanvas(
  ctx: CanvasRenderingContext2D,
  svg: SVGSVGElement,
  chartRect: DOMRect,
  scaleX: number,
  scaleY: number
) {
  const svgRect = svg.getBoundingClientRect();
  const offsetX = svgRect.left - chartRect.left;
  const offsetY = svgRect.top - chartRect.top;

  // 1. Lines (Indicator Opens, Order Lines, Trade History connecting lines)
  const lines = Array.from(svg.querySelectorAll('line'));
  for (const line of lines) {
    // CRITICAL: Skip invisible wide hover hitbox lines!
    if (
      line.classList.contains('te2-real-hitbox') ||
      line.classList.contains('sl-hitbox') ||
      line.classList.contains('tp-hitbox') ||
      line.classList.contains('entry-hitbox') ||
      line.getAttribute('stroke') === 'transparent'
    ) {
      continue;
    }

    const cs = window.getComputedStyle(line);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;

    let stroke = line.getAttribute('stroke') || cs.stroke;
    if (
      !stroke ||
      stroke === 'none' ||
      stroke === 'transparent' ||
      stroke === 'rgba(0, 0, 0, 0)'
    ) {
      if (line.classList.contains('te2-real-line')) {
        if (line.classList.contains('sl')) stroke = '#f23645';
        else if (line.classList.contains('tp')) stroke = '#089981';
        else if (line.classList.contains('buy')) stroke = '#2962ff';
        else if (line.classList.contains('sell')) stroke = '#f23645';
        else continue;
      } else if (line.classList.contains('tv-connector-line')) {
        stroke = '#2962ff';
      } else {
        continue;
      }
    }

    const x1 = (parseFloat(line.getAttribute('x1') || '0') + offsetX) * scaleX;
    const y1 = (parseFloat(line.getAttribute('y1') || '0') + offsetY) * scaleY;
    const x2 = (parseFloat(line.getAttribute('x2') || '0') + offsetX) * scaleX;
    const y2 = (parseFloat(line.getAttribute('y2') || '0') + offsetY) * scaleY;

    const width = (parseFloat(line.getAttribute('stroke-width') || cs.strokeWidth || '1.2') || 1.2) * scaleY;
    const opacity = parseFloat(line.getAttribute('opacity') || cs.opacity || '1') || 1;
    const dash = line.getAttribute('stroke-dasharray') || cs.strokeDasharray;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    if (dash && dash !== 'none') {
      const parts = dash.split(/[\s,]+/).map((n) => parseFloat(n) * scaleX).filter((n) => !isNaN(n));
      if (parts.length > 0) ctx.setLineDash(parts);
    }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  // 2. Rectangles (Sessions, Killzones, Daye Quarters)
  const rects = Array.from(svg.querySelectorAll('rect'));
  for (const rect of rects) {
    const cs = window.getComputedStyle(rect);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;

    const x = (parseFloat(rect.getAttribute('x') || '0') + offsetX) * scaleX;
    const y = (parseFloat(rect.getAttribute('y') || '0') + offsetY) * scaleY;
    const w = parseFloat(rect.getAttribute('width') || '0') * scaleX;
    const h = parseFloat(rect.getAttribute('height') || '0') * scaleY;
    if (w <= 0 || h <= 0) return;

    const fill = rect.getAttribute('fill') || cs.fill;
    const fillOp = parseFloat(rect.getAttribute('fill-opacity') || '1');
    const stroke = rect.getAttribute('stroke') || cs.stroke;
    const strokeOp = parseFloat(rect.getAttribute('stroke-opacity') || '1');
    const strokeWidth = (parseFloat(rect.getAttribute('stroke-width') || cs.strokeWidth || '1') || 1) * scaleY;
    const dash = rect.getAttribute('stroke-dasharray') || cs.strokeDasharray;
    const rx = (parseFloat(rect.getAttribute('rx') || '0') || 0) * scaleX;

    ctx.save();
    ctx.beginPath();
    if (rx > 0 && typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, rx);
    } else {
      ctx.rect(x, y, w, h);
    }

    if (fill && fill !== 'none' && fill !== 'transparent') {
      ctx.globalAlpha = fillOp;
      ctx.fillStyle = fill;
      ctx.fill();
    }

    if (stroke && stroke !== 'none' && stroke !== 'transparent') {
      ctx.globalAlpha = strokeOp;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      if (dash && dash !== 'none') {
        const parts = dash.split(/[\s,]+/).map((n) => parseFloat(n) * scaleX).filter((n) => !isNaN(n));
        if (parts.length > 0) ctx.setLineDash(parts);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3. Polygons (Trade history entry/exit arrows)
  const polys = Array.from(svg.querySelectorAll('polygon'));
  for (const poly of polys) {
    const cs = window.getComputedStyle(poly);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;

    const rawPoints = poly.getAttribute('points');
    if (!rawPoints) continue;
    const pts = rawPoints.trim().split(/[\s,]+/).map(Number);
    if (pts.length < 4) continue;

    const fill = poly.getAttribute('fill') || cs.fill || '#3b82f6';
    const stroke = poly.getAttribute('stroke') || cs.stroke;
    const strokeWidth = (parseFloat(poly.getAttribute('stroke-width') || '1') || 1) * scaleY;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo((pts[0] + offsetX) * scaleX, (pts[1] + offsetY) * scaleY);
    for (let i = 2; i < pts.length; i += 2) {
      ctx.lineTo((pts[i] + offsetX) * scaleX, (pts[i + 1] + offsetY) * scaleY);
    }
    ctx.closePath();

    if (fill && fill !== 'none') {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke && stroke !== 'none') {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
    ctx.restore();
  }

  // 4. Texts (Indicator session names, open line names)
  const texts = Array.from(svg.querySelectorAll('text'));
  for (const text of texts) {
    const cs = window.getComputedStyle(text);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;

    const x = (parseFloat(text.getAttribute('x') || '0') + offsetX) * scaleX;
    const y = (parseFloat(text.getAttribute('y') || '0') + offsetY) * scaleY;
    const fill = text.getAttribute('fill') || cs.fill || cs.color || '#ffffff';
    const fillOp = parseFloat(text.getAttribute('fill-opacity') || cs.opacity || '1') || 1;
    const fontSize = parseFloat(text.getAttribute('font-size') || cs.fontSize || '11') || 11;
    const fontWeight = text.getAttribute('font-weight') || cs.fontWeight || 'normal';
    const fontFamily = text.getAttribute('font-family') || cs.fontFamily || '-apple-system, BlinkMacSystemFont, sans-serif';
    const anchor = text.getAttribute('text-anchor') || 'start';

    ctx.save();
    ctx.globalAlpha = fillOp;
    ctx.font = `${fontWeight} ${fontSize * scaleY}px ${fontFamily}`;
    ctx.fillStyle = fill;
    ctx.textAlign = anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text.textContent || '', x, y);
    ctx.restore();
  }

  // 5. Circles (Order connector dots)
  const circles = Array.from(svg.querySelectorAll('circle'));
  for (const circle of circles) {
    const cs = window.getComputedStyle(circle);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;

    const cx = (parseFloat(circle.getAttribute('cx') || '0') + offsetX) * scaleX;
    const cy = (parseFloat(circle.getAttribute('cy') || '0') + offsetY) * scaleY;
    const r = (parseFloat(circle.getAttribute('r') || '3') || 3) * scaleX;

    let fill = circle.getAttribute('fill') || cs.fill || '#131722';
    let stroke = circle.getAttribute('stroke') || cs.stroke;
    if (!stroke || stroke === 'none') {
      if (circle.classList.contains('sl')) stroke = '#f23645';
      else if (circle.classList.contains('tp')) stroke = '#089981';
      else if (circle.classList.contains('entry')) stroke = '#2962ff';
    }
    const strokeWidth = (parseFloat(circle.getAttribute('stroke-width') || cs.strokeWidth || '1.5') || 1.5) * scaleY;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (fill && fill !== 'none' && fill !== 'transparent') {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke && stroke !== 'none' && stroke !== 'transparent') {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * Draws Order & Position badges (.tv-pill-main, .tv-badge-pill, .tv-pill-toggle)
 */
function drawAllBadges(
  ctx: CanvasRenderingContext2D,
  containerEl: HTMLElement,
  chartRect: DOMRect,
  scaleX: number,
  scaleY: number
) {
  const badges = Array.from(
    containerEl.querySelectorAll('.tv-pill-main, .tv-badge-pill, .tv-pill-toggle')
  ) as HTMLElement[];

  for (const badge of badges) {
    const cs = window.getComputedStyle(badge);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;

    const rect = badge.getBoundingClientRect();
    const x = (rect.left - chartRect.left) * scaleX;
    const y = (rect.top - chartRect.top) * scaleY;
    const w = rect.width * scaleX;
    const h = rect.height * scaleY;
    if (w <= 0 || h <= 0) continue;

    ctx.save();

    // 1. Background & Border
    let bgColor = cs.backgroundColor;
    if (!bgColor || bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') {
      bgColor = '#131722';
    }
    let borderColor = cs.borderColor;
    if (!borderColor || borderColor === 'transparent' || borderColor === 'rgba(0, 0, 0, 0)') {
      if (badge.classList.contains('sl')) borderColor = '#f23645';
      else if (badge.classList.contains('tp')) borderColor = '#089981';
      else if (badge.classList.contains('buy')) borderColor = '#2962ff';
      else if (badge.classList.contains('sell')) borderColor = '#f23645';
      else borderColor = 'rgba(255, 255, 255, 0.2)';
    }

    ctx.beginPath();
    const radius = 4 * scaleX;
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, radius);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1 * scaleY;
    ctx.stroke();

    // 2. Child segments inside the badge
    const children = Array.from(badge.children) as HTMLElement[];
    if (children.length > 0) {
      for (const child of children) {
        if (child.classList.contains('close')) continue; // Skip 'X' close button
        const childCS = window.getComputedStyle(child);
        if (childCS.display === 'none' || childCS.visibility === 'hidden') continue;

        const cRect = child.getBoundingClientRect();
        const cx = (cRect.left - chartRect.left) * scaleX;
        const cy = (cRect.top - chartRect.top) * scaleY;
        const cw = cRect.width * scaleX;
        const ch = cRect.height * scaleY;

        // Lot tag pill (e.g. 1.36 blue / red box)
        if (child.classList.contains('tv-pill-tag')) {
          ctx.beginPath();
          ctx.rect(cx, cy, cw, ch);
          ctx.fillStyle = child.classList.contains('buy') ? '#2962ff' : '#f23645';
          ctx.fill();
        }

        const text = child.textContent?.trim();
        if (text) {
          ctx.fillStyle = childCS.color || '#ffffff';
          const fontSize = parseFloat(childCS.fontSize) || 11;
          const fontWeight = childCS.fontWeight || '600';
          ctx.font = `${fontWeight} ${fontSize * scaleY}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, cx + cw / 2, cy + ch / 2);
        }
      }
    } else {
      const text = badge.textContent?.replace(/✕/g, '').trim();
      if (text) {
        ctx.fillStyle = cs.color || '#ffffff';
        const fontSize = parseFloat(cs.fontSize) || 11;
        const fontWeight = cs.fontWeight || '600';
        ctx.font = `${fontWeight} ${fontSize * scaleY}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + w / 2, y + h / 2);
      }
    }

    ctx.restore();
  }
}
