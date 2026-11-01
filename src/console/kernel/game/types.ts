export type Character = {
  x: number;
  y: number;
  hea: number;
  hmax: number;
  nickname?: string;
  io?: unknown;
  team?: unknown;
  [field: string]: unknown;
};

export type Gun = { [field: string]: unknown };
export type Rectangle = { x: number; y: number; w: number; h: number };
export type DrawOperation = [string, unknown[]];
export type Bounds = { x1: number; y1: number; x2: number; y2: number };
export type DrawnGraphics = { draw_operations: DrawOperation[]; bounds: Bounds; ScheduleBitmapUpdate?: () => void };
export type DisplayObject = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  graphics?: DrawnGraphics;
  children?: DisplayObject[];
  parent?: { removeChild?: (child: DisplayObject) => void } | null;
  [field: string]: unknown;
};
export type Layer = DisplayObject & { numChildren: number; addChildAt(child: DisplayObject, index: number): DisplayObject };
export type Walls = { x: number[]; y: number[]; w: number[]; h: number[]; count: number };
export type WallGrid = { cells: number[][][]; cell: number; cols: number; rows: number; minX: number; minY: number };

export type MovingCharacter = Character & { stand?: boolean; sit: number; tox: number; toy: number; curwea: number };
