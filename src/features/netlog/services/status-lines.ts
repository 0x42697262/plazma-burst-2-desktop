type Line = () => string | null;

const headerParts: Line[] = [];
const footerHints: Line[] = [];

export const addStatusHeader = (part: Line): void => { headerParts.push(part); };
export const addStatusHint = (hint: Line): void => { footerHints.push(hint); };
export const statusHeaderParts = (): string[] => headerParts.map((part) => part()).filter((part): part is string => part !== null);
export const statusHints = (): string[] => footerHints.map((hint) => hint()).filter((hint): hint is string => hint !== null);
