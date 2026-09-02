/**
 * ToolRegistry — Maps tool IDs to their tool class instances.
 *
 * Adding a new tool = register it here.
 * Everything else works automatically.
 */

import type { BaseTool } from './BaseTool';
import type { DrawingTypeId } from '../engine/types';
import {
  TrendLineTool, RayTool, ExtendedLineTool,
  HorizontalLineTool, HorizontalRayTool, VerticalLineTool, CrossLineTool,
  ArrowTool, ArrowMarkerTool, ArrowUpTool, ArrowDownTool,
} from './lineTools';
import {
  RectangleTool,
  RotatedRectangleTool, CircleTool, EllipseTool, TriangleTool, ArcTool,
  createPolylineTool, createBrushTool, createHighlighterTool, createPathTool,
  createCurveTool, createDoubleCurveTool,
  createTextTool, createAnchoredTextTool, createNoteTool, createAnchoredNoteTool,
  createCalloutTool, createBalloonTool, createPriceLabelTool,
  createLongPositionTool, createShortPositionTool, createForecastTool, createBarsPatternTool,
  createPriceRangeTool, createDateRangeTool, createDatePriceRangeTool,
  createFibRetracementTool, createFibExtensionTool, createFibChannelTool,
  createFibTimeZoneTool, createFibFanTool,
  createGannBoxTool, createGannFanTool,
  createChannelTool, createPitchforkTool, createSchiffPitchforkTool,
} from './shapeTools';

export class ToolRegistry {
  private tools = new Map<DrawingTypeId, BaseTool>();

  constructor() {
    // Lines & Rays
    this.register(new TrendLineTool());
    this.register(new RayTool());
    this.register(new ExtendedLineTool());
    this.register(new HorizontalLineTool());
    this.register(new HorizontalRayTool());
    this.register(new VerticalLineTool());
    this.register(new CrossLineTool());

    // Arrows & Markers
    this.register(new ArrowTool());
    this.register(new ArrowMarkerTool());
    this.register(new ArrowUpTool());
    this.register(new ArrowDownTool());

    // Shapes
    this.register(new RectangleTool());
    this.register(RotatedRectangleTool());
    this.register(CircleTool());
    this.register(EllipseTool());
    this.register(TriangleTool());
    this.register(ArcTool());

    // Brush & Freeform
    this.register(createPolylineTool());
    this.register(createBrushTool());
    this.register(createHighlighterTool());
    this.register(createPathTool());
    this.register(createCurveTool());
    this.register(createDoubleCurveTool());

    // Text & Annotations
    this.register(createTextTool());
    this.register(createAnchoredTextTool());
    this.register(createNoteTool());
    this.register(createAnchoredNoteTool());
    this.register(createCalloutTool());
    this.register(createBalloonTool());
    this.register(createPriceLabelTool());

    // Position Tools
    this.register(createLongPositionTool());
    this.register(createShortPositionTool());
    this.register(createForecastTool());
    this.register(createBarsPatternTool());

    // Measurements
    this.register(createPriceRangeTool());
    this.register(createDateRangeTool());
    this.register(createDatePriceRangeTool());

    // Fibonacci
    this.register(createFibRetracementTool());
    this.register(createFibExtensionTool());
    this.register(createFibChannelTool());
    this.register(createFibTimeZoneTool('fib-timezone'));
    this.register(createFibTimeZoneTool('fib-time-zone'));
    this.register(createFibFanTool());

    // Gann & Channels
    this.register(createGannBoxTool());
    this.register(createGannFanTool());
    this.register(createChannelTool());
    this.register(createPitchforkTool());
    this.register(createSchiffPitchforkTool());
  }

  private register(tool: BaseTool): void {
    this.tools.set(tool.id, tool);
  }

  get(id: DrawingTypeId): BaseTool | undefined {
    return this.tools.get(id);
  }

  getAll(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  getByCategory(): { label: string; tools: BaseTool[] }[] {
    const g = (ids: DrawingTypeId[]) =>
      ids.map((id) => this.tools.get(id)).filter(Boolean) as BaseTool[];

    return [
      { label: 'Lines & Rays', tools: g(['trendline', 'ray', 'extended-line', 'horizontal-line', 'horizontal-ray', 'vertical-line', 'cross-line']) },
      { label: 'Arrows & Markers', tools: g(['arrow', 'arrow-marker', 'arrow-up', 'arrow-down']) },
      { label: 'Shapes', tools: g(['rectangle', 'rotated-rectangle', 'circle', 'ellipse', 'triangle', 'arc', 'polyline', 'path', 'brush', 'highlighter', 'curve', 'double-curve']) },
      { label: 'Text & Annotations', tools: g(['text', 'anchored-text', 'note', 'anchored-note', 'callout', 'balloon', 'price-label']) },
      { label: 'Position & Pattern', tools: g(['long-position', 'short-position', 'forecast', 'bars-pattern']) },
      { label: 'Measurement', tools: g(['price-range', 'date-range', 'date-price-range']) },
      { label: 'Fibonacci', tools: g(['fib-retracement']) },
      { label: 'Channels', tools: g(['channel', 'pitchfork', 'schiff-pitchfork']) },
    ];
  }
}
