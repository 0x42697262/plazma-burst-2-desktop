export const TEXT = Object.freeze({
  missing: 'Private server: the game\'s connection class was not found (names.js), so code the server sends could run. The game does not join it. Run "npm run find-names" (an installed app finds the names again at its next start).',
  neutralized: (count: number) => `This private server sent code for the game to run (${count === 1 ? 'a task' : `${count} tasks`}). It was not run (lobby_task_guard, docs/features/lobby-task-guard.md).`,
});
