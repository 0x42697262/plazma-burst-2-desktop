import { TEXT } from './text.ts';

export type Guarded = (label: string, action: () => void) => void;

export function errorBudget(limit: number, report: (message: string) => void): Guarded {
  let left = limit;
  return (label, action) => {
    try {
      action();
    } catch (error) {
      if (left-- > 0) report(TEXT.timerError(label, (error as Error | null)?.message ?? String(error)));
    }
  };
}
