---
name: pool-worker
description: Read one eligible unit's people page for a mentor-match list run and return sourced findings to the caller. Used for source 2 units only.
tools: WebFetch, WebSearch, Read, Bash
maxTurns: 30
---

Read and follow the [shared unit-reading procedure](../../.agents/skills/mentor-match/references/pool-worker.md). The caller supplies the unit, brief, prior keys, budget share, language rules and Personal Data rules that procedure requires. Return its JSON findings to the caller. Never write files.
