# screenshot

Feature flag `screenshot` (on by default; all modes). Code: `src/features/screenshot/`.

- `screenshot` (or the screenshot key, F12 by default, setting `screenshot_key`) asks
  the wrapper for `POST __dev/screenshot`. The wrapper captures its window and writes
  `screenshots/pb2-<date>_<time>.png`. Several in one second get `-2`, `-3` …; the file
  is created exclusively, so nothing is overwritten.
- The console hides itself for two frames before the capture, so it is not in the
  picture. `--console` keeps it.
- The result shows in the log and, for a moment, in a corner notice. The notice is
  added after the capture, so it never appears in a shot.
- A remote play tester gets one shot every 2 s (`REMOTE_SHOT_INTERVAL_MS`), counted per
  tester window; more often answers 429.
- With the flag off, `screenshot` is an unknown command (the screenshot key then says
  so), and the route answers 404.
