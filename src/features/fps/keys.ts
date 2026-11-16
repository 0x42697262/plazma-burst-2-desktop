export const COMMAND = Object.freeze({ name: 'fps' });
export const PHYSICS = Object.freeze({ low: 'low', high: 'high' } as const);
export const LOGIC = Object.freeze({ match: 'match', unlimited: 'unlimited' } as const);
export type Physics = typeof PHYSICS[keyof typeof PHYSICS];
export type Logic = typeof LOGIC[keyof typeof LOGIC];
