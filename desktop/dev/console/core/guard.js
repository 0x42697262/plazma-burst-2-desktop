// Runs code that is called on a timer, printing its first few errors instead of
// flooding the log with one per frame.
export function errorBudget(limit, report) {
  let left = limit;
  return (label, fn) => {
    try {
      fn();
    } catch (e) {
      if (left-- > 0) report(`${label} error: ${e && e.message}`);
    }
  };
}
