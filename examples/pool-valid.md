<!-- Fixture. Every person, institution and page here is invented, and every URL
     sits under an example.* host, which verify:validate asserts. Its
     machine record is examples/pool-valid.yml, which joins
     examples/fellowship-valid.yml and examples/researchers-valid.yml. -->

# Host candidate pool — 23 September 2026

Read the Example Institute Research Fellowship record, the applicant's profile
and brief, the researcher registry and the applicant's `config.yml`. No
earlier pool.

The fellowship's one published list, Institute Faculty, does not bound the
pool: its subject rule also admits faculty anywhere in the university who work
on learning and memory. So the list was read and two units were considered as
well. A published list can be stale or partial.

## Sources

| Source | Page | Read by | Outcome |
|---|---|---|---|
| Institute Faculty | [list page](https://www.example.edu/people/faculty) | [the site's data route](https://www.example.edu/wp-json/wp/v2/people?role=faculty) | read, 4 entries |
| Center for Imaging and Memory | [people page](https://www.example.edu/imaging-memory/people) | the page | read |
| Department of Vision Science | [people page](https://www.example.edu/vision/people) | — | not opened: the page-open cap was reached |
| One named person's page | [faculty page](https://www.example.edu.sg/people/li-ming) | the single-URL path | read |

## Host candidates

Each name links to the page its reason rests on.

- [Mira Ostrander](https://www.example.edu/people/mira-ostrander) — from
  Institute Faculty. The page says the group models how people learn from
  sequences of experience, the brief's first need.
- [Tomas Reyna](https://lab.example.org/research) (lab site, linked from the
  [faculty page](https://www.example.edu/people/tomas-reyna)) — from the Center
  for Imaging and Memory. The lab states it measures how the visual system changes
  with repeated exposure, using fMRI, the brief's second need.
  - The research statement, stated opening, contact address and accepted paper
    came from the lab's own site.
- [李明](https://www.example.edu.sg/people/li-ming) — added from the person's
  own page.
- [Ines Varga](https://www.example.edu/people/ines-varga) (Institute Faculty) —
  unconfirmed: the page would not open.
- [Oren Fald](https://www.example.edu/people/oren-fald) (Institute Faculty) —
  unconfirmed: not opened, left for the next run.

## Discarded

Each name links to the page its reason rests on.

- [Jonas Pell](https://www.example.edu/people/faculty) (Institute Faculty) — the
  list gives the role as Professor of Materials Chemistry; not one of the
  brief's needs.
- [Petra Lund](https://lundlab.example.org/research) (Center for Imaging and
  Memory; lab site, linked from the
  [centre's page](https://www.example.edu/imaging-memory/people/petra-lund)) —
  the lab's site states it studies protein folding in yeast; not one of the
  brief's needs.

## Gaps

- Ines Varga's page returned an error.
- The Department of Vision Science was not opened.
- Nobody's page states whether they are taking a fellow except Tomas Reyna's lab site.

## Budget

3 web searches and 10 page opens, against caps of 20 and 10: the applicant's
`config.yml` lowered the page-open cap to 10 for this run. One host candidate
is left for the next run.

Machine record: [pool-valid.yml](pool-valid.yml)
