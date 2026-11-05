# Changelog

Versions below 1.0 may still change the shape of the files a run writes.

## 0.1.1

Tested on a PhD admission, where a supervisor is named rather than a team of mentors. No file shape changed, so files written by 0.1.0 still validate.

- `list` counts a stated opening only for the role the application is for. A lab "recruiting PhD students" is now an opening for a PhD application, and still not for a fellowship.
- `recommend` reads from the programme's pages whether the people named form a team, such as two or three mentors, or alternatives, of whom one becomes the supervisor, and chooses the proposed set to match. Where the pages name no number, it picks the size and says why. Where a lab's stated closure names another role, the report says so beside the flag.
- Reports call the programme by its own name, such as "the EECS PhD program", instead of "the fellowship".
- `npm run verify` skips an applicant folder that holds only the applicant's own files, before `brief` has run there, and names it.
- Both READMEs carry status badges and a language switch at the top.

## 0.1.0

The first public release.

- Four modes: `brief`, `list`, `summarize` and `recommend`, plus the single-URL path that adds one person from their own page.
- Three offline guards: `doctor`, `validate` and `gate`.
- Shared skills and instructions for Claude Code, Codex and agents that read the router directly; optional unit workers and agent-specific permission guidance.
- `npm run verify`, the suite CI runs on Node 22 and 24.
