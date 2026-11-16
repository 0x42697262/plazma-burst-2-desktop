export const FPS_BY_CHOICE: Readonly<Record<number, number>> = Object.freeze({ 1: 20, 2: 30, 3: 60 });
export const FPS_VALUES: readonly number[] = Object.freeze(Object.values(FPS_BY_CHOICE));
export const choiceOfFps = (fps: number): number => Number(Object.keys(FPS_BY_CHOICE).find((choice) => FPS_BY_CHOICE[Number(choice)] === fps));
