# Recommend Mode

The last mode: after a recommendation report there is no next mode to offer.

## Purpose

Answer who the applicant should write to, and why.

Two judgements per host candidate, never averaged and never combined into a rank:

- `fit` — does this person's published work connect to my project?
- `host_strength` — is this a host worth applying with under this fellowship's rules?

The applicant sees both and keeps or drops each one. Nothing here says who will accept. Why the two are never combined is `AGENTS.md` → The Two Judgement Axes.

## Inputs

- the latest pool and latest summaries report in the fellowship's folder, each read from its machine record under `applicants/{applicant-id}/{fellowship-id}/machine/`; the summaries record must name that pool's record;
- `registry/researchers.yml`, for the rows they name;
- `fellowships/{fellowship-id}.yml`, the record the folder is named for: the host rules `host_strength` is read against, how many names the fellowship asks for, and whether they all take the role or one of them becomes the host;
- the folder's `brief.md` and `applicants/{applicant-id}/profile.yml`: the question, the needs the brief says a mentor must cover, whether the agent drafted them, and the constraints. A flag rests on a profile field — country of work, degrees, current institution, `languages_of_work` — that the profile may lack; where it does, the report's Gaps say which flag could not be raised;
- `config.yml`: the page-open cap, or `config.example.yml`'s. Say which was read.

## May search

Nothing by default. The evidence is what `list` and `summarize` already recorded. Where a host rule cannot be decided from the record, the page that states the rule may be re-read through the gate, and the report says it was. That open counts against `page_opens_per_run`.

## May write

- `applicants/{applicant-id}/{fellowship-id}/recommendations/{YYYY-MM-DD}-recommendation.md` and its machine record `applicants/{applicant-id}/{fellowship-id}/machine/{YYYY-MM-DD}-recommendation.yml`, written, checked and pointed to as `modes/_shared.md` → Writing Files says; then both rewritten together as the applicant keeps or drops entries, the previous pair moved into `.history/` first.

Nothing in the registry. A fact the judgement would need and the row does not hold is a gap, not an append.

## Guards

- `validate recommendation` on the report or its machine record, which reads the record, both files present:
  - **Joins.** Every entry is a confirmed host candidate in the pool the report names and has a summary in the summaries report, which names the same pool. Every confirmed host candidate is judged or carried: a drop is the applicant's status on an entry, never an omission. Each entry's labels are compared with its row.
  - **The axes.** Each carries a value, an `evidence_basis`, at least one reason and its `cites`, which join the row as a summary's do: a row field, a paper by identifier in any written form, an accepted paper by title, and for `host_strength` the published list the pool found the person on.
  - **The basis rule.** A basis other than `inferred` has at least one cite of its tier, and `inferred` is never `strong`.
  - **The metric rule, as a join.** A `fit` cites no metric. It is not a scan for numbers: "three first-author papers since 2023" is a fit reason, and a scan would refuse it. Neither axis cites `availability` (below).
  - **Flags.** They come from the closed list. `availability_stated_closed` and `no_published_contact_route` are joined to the row both ways.
  - **Keys and statuses.** The entry, axis and record key sets are closed, so a score or a rank cannot be written. A `dropped` entry carries its reason. The proposed set names entries the applicant has not dropped.
  - **Scans.** The banned-claim and English-script scans run over the record's reasons, `covers`, drop reasons and gaps. The prose is not scanned: it is the agent's, in the applicant's language, and the applicant reads it.
- `doctor` after the write.

## The two rubrics

Read the brief first: its question, and the needs it says a mentor must cover. A brief might name three: learning and memory; visual representation and neuroimaging; data and validation. A group that shares the applicant's own method but meets none of the needs adds what the applicant already brings.

**`fit`**: does the published work meet the brief's question or one of the needs it names? Read the row's research statement, the recent first- and last-author papers the row records, and the summary's "what touches the brief".

- `strong`: at least one recorded first- or last-author paper in the window meets the question or a named need directly (the same phenomenon, or the same kind of model on the same kind of data), and nothing the group states points elsewhere.
- `plausible`: the work meets the question or a need in part (the same question on other data, or the same data for another question), or only the group's statement meets it directly.
- `weak`: the work shares a method or a framing with the project and meets neither the question nor a need.
- `unclear`: too little could be read or attributed to say.

A missing research statement lowers nothing when a recorded paper settles the call. No metric is a reason for a fit: a citation count does not say whether two research questions meet.

**`host_strength`**: is this a host worth applying with under this fellowship's rules? Read each host rule in the fellowship record against the row and the pool entry.

- `strong`: eligible under the rules without a reading that the fellowship leaves open: on a published list the rules name, or plainly inside a rule (a group whose own statement says it works on what the rule names). Also an independent position as the role title publishes it, and at least one last-author paper in the window recorded. No host rule works against the group.
- `plausible`: all of that, except that eligibility rests on a reading the record supports and the fellowship does not settle.
- `weak`: a host rule works against the group as the record shows it (a rule's subject or method the statement and papers do not show), or no last-author paper in the window was recorded.
- `unclear`: the rules cannot be read against the record, for example where there is no statement and the papers do not settle the rule.

Cited-work metrics are shown with their source and date, and never decide the value on their own. A metric the row lacks lowers nothing: the index profile held another person's works, which says nothing about this person. The recorded papers are a selection, so their number lowers nothing either; only none at all counts. Funding and a record of hosting fellows are not recorded in this release, so the Gaps say they were not read.

**`evidence_basis`**: the tier the call rests on most (`AGENTS.md` → Sources and Trust). `bibliographic` when a paper or a metric makes the call, `official` or `linked` when the group's own statement or a fact read from its page does, and `inferred` when the call needs general knowledge that nothing it cites carries. Linked is its own tier: a statement from a lab's site that an official page links to is `linked`, not `official`. The guard holds every basis but `inferred` to a cite of its tier. `inferred` is always visible as such, and is never `strong`.

**`availability` is neither a reason nor a flag, unless it is `stated_closed`.** A stated opening is a fact the report shows beside the entry. If `stated_open` could raise a call, `unknown`, the normal case, would lower one. `stated_closed` is the flag `availability_stated_closed`. A row holds one statement, which an earlier run for another fellowship may have read: where its quote names a role other than the one this application is for, the report says so beside the flag.

**`host_requirement: optional`** changes the report's wording, not the rubric: the report says that the fellowship names a mentor without requiring an agreement, and `host_strength` is read against whatever rules the fellowship publishes (`AGENTS.md` → What this project is).

## Constraint flags

A flag is a fact for the applicant to weigh, not a removal and not a reason on either axis. It comes from the pool entry's scope notes, the row and the profile's constraints, and the report says what each flag means under this fellowship's rules. The closed list, `knowledge/vocabulary.json` → `recommendation.constraint_flags`:

| Flag | Raised when |
|---|---|
| `host_country_rule` | the host rules require a host in a country the row's institution is not in |
| `mobility_rule` | the fellowship's mobility rule and the applicant's record, read against this host's country, conflict |
| `career_stage` | a host rule about the applicant's stage bears on this host, such as a rule barring the PhD supervisor |
| `unit_not_eligible` | the pool's scope note says the unit sits outside the units the host rules name |
| `no_recent_senior_authorship` | no last-author paper in the window was recorded, a sole-author one counting as last |
| `availability_stated_closed` | the row states the group is closed; the guard requires it then and refuses it otherwise |
| `language_of_work` | the group's stated working language is not among the profile's `languages_of_work` |
| `no_published_contact_route` | the row records no contact address; the guard requires it then and refuses it otherwise |
| `institution_move` | a page states the person has recently moved institution or will move; the report says which and when, against the fellowship's dates |

## The proposed set

Read from the fellowship's own pages how many names it asks for, and what the named people become.

- **A team.** Everyone named takes the role together: two or three mentors, a committee. Choose the set so that between them its members cover the needs the brief names, each with the need it covers.
- **Alternatives.** One person becomes the host, such as a PhD supervisor, and the others are who else the applicant writes to or lists as faculty of interest. Each member then has to host the project alone, so choose members whose `fit` meets the question itself, and give each one's `covers` as the needs it meets.

Propose one set of the size the fellowship asks for. Where its pages name no number, the size is the agent's: say that the pages set none, and why this size. Prefer members whose `fit` meets the need they cover and whose `host_strength` is not in doubt, and say why each is in and what the flags on the others would need. The set has no order and no score. The at-a-glance table names, for every entry, the need its `fit` meets, so a swap is one row away. The proposal is the agent's; the keep and drop are the applicant's.

## Output

One dated recommendation report, in the applicant's language. It opens with the answer:

1. **Proposed**: the set, each member by name with the need it covers, both calls labelled ("`fit` strong, `host_strength` plausible"), never as a bare pair, and why. What no member covers, and the swap the table suggests, in a line or two. It ends with one line on how the applicant keeps or drops an entry.
2. **At a glance**: a table with one row per judged host candidate, in the pool's order, so it ranks nothing: the name, linked to its section; how the fellowship's rules admit the person (by the rule's short name, below, with the list linked where a list admits them); the need the `fit` meets, or none; `fit`; `host_strength`; the cited-work metrics, with the source and the date they were read once in the column's header; the flags, in plain words; and the status. The table carries these facts for every entry and the sections below do not repeat them, so it is read, not skimmed. A line under it says a metric decides no call and a missing one lowers nothing.
3. **How to read this report**, in about twenty lines: the fellowship's `host_requirement` in the report's words; each host rule the report cites, quoted with a link to its page and given the short name the table and the entries use; one line each on what `fit` and `host_strength` mean, the second saying what most calls in this run turned on; and one line on the evidence bases.
4. One section per judged host candidate, headed by the name, in the pool's order, so that the order carries nothing: the role title and the person's page; a link to the person's section in the summaries report; `fit` and `host_strength`, each with its value, its basis and the reasons that differ from person to person, every reason ending with a link to the page or record it rests on; a stated availability, as a fact; and a flag or a status only where there is one, a flag by what it means under the rules.
5. **Carried**: a host candidate the summaries carried, and the pool's unconfirmed host candidates, who have no row and are named as the pool names them.
6. **Gaps**: this run's own, with a link to the earlier reports' Gaps for what their runs met; a gap a call rests on is also named beside that call. Then what the report read, restated from the record's `inputs`; the budget line: page opens against the cap; and the line linking its machine record.

No entry carries a combined score, a rank, a probability, an unsourced reputation claim, or a prediction about a person. No pronoun about a person: a pronoun is gender, which is never recorded.

The first write has every entry `undecided`, because the keep and drop are the applicant's. The applicant's instruction is the yes: the pair is rewritten, checked and pointed to, with `kept`, or `dropped` and the applicant's reason in `status_reason`. A dropped entry leaves the proposed set, and the report and its record change together. Where the brief marks its needs as drafted, the report says so in How to read this report: the set covers needs the agent wrote and the applicant accepted.

The machine record, in English, carries for the run `inputs`, with the pool and the summaries named by their machine records, `budget`, `proposed`, `carried` and `gaps`, and per entry the `researcher_key`, the identity labels, `fit` and `host_strength` as `{value, evidence_basis, reasons, cites}`, `constraint_flags`, `status` and `status_reason`. `examples/recommendation-valid.md` and `examples/recommendation-valid.yml` are the shape.
