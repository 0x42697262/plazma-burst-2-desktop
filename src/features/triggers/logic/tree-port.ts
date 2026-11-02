import { QUERY_TEXT as TEXT } from './text.ts';

type TreeRunner = (args: string[]) => void;

let treeRunner: TreeRunner | null = null;

export const provideTree = (runner: TreeRunner): void => { treeRunner = runner; };
export function runTree(args: string[]): void {
  if (!treeRunner) throw new Error(TEXT.noTree);
  treeRunner(args);
}
