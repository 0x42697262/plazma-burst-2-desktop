export type Trigger = Record<string, unknown> & { uid?: string };
export type Action = { n: number; type: number; A: unknown; B: unknown };
export type TriggerSource = { kind: string; index?: number; uid?: string; text: string };
export type TriggerRun = { idx: number | undefined; uid: string | undefined; by: unknown; ok: boolean; why: string; count: number; first: number; last: number };
