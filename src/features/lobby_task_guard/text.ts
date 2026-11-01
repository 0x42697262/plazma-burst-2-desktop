export const TEXT = Object.freeze({
  missing: 'Private server: the game\'s connection class was not found (names.js), so code the server sends would run. Run "npm run find-names", or leave this server.',
  neutralized: (count: number) => `This private server sent code for the game to run (${count === 1 ? 'a task' : `${count} tasks`}). It was not run (lobby_task_guard, docs/features/lobby-task-guard.md).`,
});
