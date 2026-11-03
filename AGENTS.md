# mentor-match Agent Instructions

> **What is built:** run `doctor`, which is the live answer. A kind `validate` does not know is a mode that is not built, named as what comes next and never offered as a step. When a mode tells you to run a guard that does not exist, stop and say so in the applicant's language. Never improvise a guard's judgement in prose, and never stand in for a mode that is not built.

> **Using this repo, or building it?** This file is the runtime policy for *using* mentor-match. If you are *contributing to or extending* the repository, start from `CONTRIBUTING.md`.

## Agent entry

For a host-search request, read `.agents/skills/mentor-match/SKILL.md` and follow its routing. If your agent does not discover skills automatically, open that file directly. Skill commands are conveniences; the same request in plain language selects the same workflow. Required capabilities and tool limitations are in `modes/_shared.md` → Agent capabilities.

Never commit or push unless the user asks in the current conversation.

## What this project is

Many fellowships and programmes put a named mentor or host between the applicant and the application. Some will not accept an application until that person has agreed to work with the applicant. Others publish a list of people to choose from, or expect the applicant to write to someone before applying, without requiring a commitment. The work is the same either way, and it has no tooling: finding the people who could host this project, reading what each of them works on now, and deciding who to write to and why.

`mentor-match` does those three things for one fellowship at a time: **list, summarize, recommend.** The applicant is the reader. Every judgement shows its reasons, and every fact shows the page it was read from.

Whether a mentor is required is read off the fellowship's own pages, never assumed, and recorded as `host_requirement`:

| `host_requirement` | What the fellowship does | What this tool does |
|---|---|---|
| `required` | Will not accept an application until a named host has agreed | Every mode |
| `optional` | Names a mentor as part of the application, publishes people to choose from, or invites contact, without requiring an agreement | Every mode. The reports say the host is optional, and `host_strength` is judged against whatever rules the fellowship does publish |
| `none` | Has no mentor or host component at all | `brief` records that and stops. There is nobody to look for |

This file says *fellowship* for whichever of the three it is, and the record is `fellowships/{fellowship-id}.yml` in every case. The programme's own word for the relationship — mentor, host, sponsor, supervisor, affiliation — is recorded as `host_relationship_term` and used in the reports.

It does not say who will accept. Nothing in this repository estimates that, and no report may imply it.

The first release stops at `recommend`. Drafting the first-contact email, and re-checking a host candidate's eligibility and capacity before the applicant writes, are separate jobs and are not built.

## Standalone

Everything is plain files in the applicant's own clone, and nothing this tool produces leaves it. No path outside this repository root is read or written, and there is no configuration key naming another checkout. `verify:layout` asserts that nothing under `scripts/` can reach one, so the boundary is structural rather than remembered.

It does not integrate with other tools, and the cost is real and accepted: a fellowship the applicant already tracks in another tool is recorded again here, and the hosts this tool recommends go into no other tool.

## Principles

1. **Official pages are the source of facts about a person.** A fact about a person comes from a page their own institution published; a fellowship's host rules come from the fellowship's own pages. The one exception is narrow: a lab or personal site that an official page links to for that person may fill a field the official pages do not carry (**Personal Data** → Linked sites). Directories, ranking sites, and profile aggregators supply leads only: they can say that a person or an institution exists, never a fact about either. What each tier is allowed to establish is **Sources and Trust** below.
2. **A record holds only what was published about the work.** The tool records a professional role and a published research record, and nothing else about a person. The full boundary is **Personal Data** below, and it is the section to read first.
3. **A claim about what someone published carries an identifier.** A DOI, an arXiv id, a PMID, or an OpenAlex id, with the date the record was read. General knowledge about someone's work is tagged `inferred` and is never enough on its own. A paper marked `accepted` is the one that may carry no identifier, because a venue can accept a paper months before it issues a record for it. In the applicant's own profile they are self-reporting their own work and the absence needs nothing beside it; in a host candidate's row the tool is asserting something about a stranger who did not write it, so the official page or linked site that says so, with its retrieval date, stands in place of the identifier. An acceptance the agent inferred rather than read is refused in both.
4. **A metric is a fact only with its source and its date.** The same person has a different h-index in OpenAlex, Scopus and Google Scholar, so a number without the name of the database that produced it and the date it was read is not a fact. A metric may support `host_strength`. It is never a reason for a `fit` value, because a citation count does not say whether two research questions meet. An unsourced reputation claim and a journal impact factor are refused outright.
5. **Nothing predicts a person.** Whether someone is recruiting, has space, or would be interested is not inferred from group size, funding, publication gaps, or tone. `availability` is `stated_open` or `stated_closed` only with a verbatim quote, a URL and a date; otherwise it is `unknown`, which is the normal case. `unknown` never removes a host candidate and never lowers a judgement.
6. **Judgement is the agent's, structured and reasoned.** `fit` and `host_strength` are authored against written rubrics with fixed vocabularies, each with its own reasons and its own evidence basis. Nothing computes either of them from a threshold table.
7. **Description is separate from judgement.** A summary of what someone publishes can be checked against its sources; a fit is an opinion about a stranger. They are written to different files so the second never reads like the first. A summary therefore carries no `fit` and no `host_strength`, compares no two host candidates, and never paraphrases a source into a claim it does not make.
8. **The agent proposes, the guards check, the applicant keeps.** Host admission, schema and vocabulary checks, banned-claim scans, identifier shape, and the joins between layers are deterministic. A mode writes a file, runs `validate` on it until it is clean, and points the applicant to it; the chat never carries a file's content. An instruction the applicant types is the yes, and a file the applicant owns keeps its previous version when a write replaces it (User Layer).
9. **Unknowns stay visible.** A unit not opened for budget, a page that would not open, a domain the gate could not resolve, a host candidate whose record could not be established, a person removed from the pool: each is named in the report with its reason.
10. **Bounded and local.** Web searches and page opens per run are capped by `config.yml`, the cap is hard, and what is unopened is carried as a host candidate and reported. Nothing is committed from the user layer. There is no server, no account, and no telemetry.

These are stated once, here. `modes/_shared.md` does not restate them; it says how a mode carries them out.

## Personal Data

This tool builds a local file of named people who did not agree to be catalogued. That is the part of it that can do harm, so the boundary is written out here rather than left to a schema.

**Who may be recorded.** Only a potential host for the fellowship being worked on: a person whose published work could host the brief's project, and who is either named on the fellowship's own published host list or in a unit the fellowship's host rules make eligible. A list makes a person eligible; it does not make them a host for this brief. A list entry whose work could not host it gets one line in the pool report — the name as the list prints it, the list, the reason, and the page the reason rests on — and no registry row. Nobody else. Not a co-author, not a group member who is not a potential host, not a person who looked interesting on the way past. A row exists because a run was looking for a host and found one.

**What may be recorded.** A closed set, and closed on purpose:

- the name as the person's own institutional page publishes it;
- the institution and the unit;
- the role title as published, in the page's own words;
- the official page URL the row was read from, and the date it was read;
- what the person's group states it works on, in the page's own words;
- a contact address the institution publishes for professional contact, or one a linked site publishes at the institution's own domain;
- for a field read from a linked site, that site's URL, the date it was read, and the official page that links to it, as `linked_from`;
- `availability`, as `stated_open` or `stated_closed` with a verbatim quote, the URL and the date, or `unknown`;
- the publication records read: title, venue, year, authorship position, and status, with the identifier — or, for a paper an official page or a linked site states is accepted and unpublished, that page and the date it was read;
- cited-work metrics, each stored with the name of the source that produced it and the date it was read.

The field set is closed in the schema, not merely described here: `validate researchers` rejects any key outside it. A run that found something interesting about a person cannot add a field to keep it.

**What is never recorded, of anyone, for any reason.**

- Anything about a private life: family, relationships, health, religion, politics, or where they live.
- Age, date of birth, gender, race, ethnicity, nationality, or immigration status.
- A photograph, or any description of appearance.
- A social media account; a lab or personal site no official page links to for them; anything on a linked site outside the set above; a personal email address, a phone number, or any contact address outside the institution's own domain.
- Anything read off a directory, a ranking site, a profile aggregator, a forum, or a news story. Those are leads, and a lead is not a fact.
- A guess about whether they are hiring, looking, approachable, or likely to say yes.
- An opinion about them. The facts layer holds no prose and no judgement; a summary and a recommendation are separate files, and both are about the applicant's decision rather than about the person.
- Anyone who is not a potential host for this fellowship.

**Linked sites.** Many people keep their lab's site, or a site of their own, off the institution's domain, and their official page links to it. A person who publishes such a site is addressing the public in a professional role, so it may be read, on these terms:

- an official page links to it for that person. A site found by search, or linked only from another personal site, is a lead;
- it fills only a field in the set above, and only one the official pages do not carry. Everything on the never-recorded list applies to it in full, and a personal site carries more of that than an institution page does;
- a contact address from it is recorded only at the institution's own domain;
- every fact from it carries the site's URL, the date read, and `linked_from`. A site the gate blocks — a social platform, a profile aggregator — is not read, linked or not;
- it never gets an institution registry row. That registry names an institution's domains, and a lab's or a person's domain is not one.

What a linked site supplied is for this clone's local files only: the gitignored registry and the applicant's own reports. It never enters a tracked file, a fixture, an example, or anything exported, and `linked_from` is what lets an export drop it by structure rather than by memory.

**Where it lives, and how long.** In `registry/researchers.yml`, in the applicant's own clone, gitignored, and disposable. No seed file of people ships with this repository and none ever will: an institution's domain is a public fact about an organisation, and a researcher row is personal data about a named person. The cost of that refusal is that every clone pays the full web budget to build its own pool and there is no warm start. It is accepted.

Deleting `registry/researchers.yml` costs nothing but that warm start. The reports that name its rows will then fail their join and say so, which is the correct behaviour: a report that named a person is not silently readable once the facts behind it are gone.

**What this means in a report.** A report is written for the applicant, about the applicant's decision. It never characterises a person beyond what their institution, a site it links to for them, and their publication record state, and it never says anything about them that they could not read on their own page.

## Sources and Trust

Five tiers. The tier decides what a source is allowed to establish, and every judgement carries the tier its reasons rest on as its `evidence_basis`.

| Tier | Source | May supply |
|---|---|---|
| Official | A university, department, or research-group page the domain gate admits; or a fellowship's own page, on any site the gate does not block | A fellowship's host rules and published host list; a person's existence, institution, unit, role title as published, published professional contact route, and a stated `availability` with its verbatim quote; what a group states it works on, in the group's own words. Each as a quote or a named field with URL and retrieval date |
| Linked | A lab or personal site that an Official page links to for that person, on a site the gate does not block | A field in the **Personal Data** set that the official pages do not carry: a stated `availability` with its verbatim quote, what the group states it works on, an accepted paper. Each with the site's URL, the retrieval date and `linked_from`. A contact address only at the institution's own domain |
| Bibliographic | A publication record carrying a DOI, arXiv id, PMID or OpenAlex id, with the date it was read | What a person published: title, venue, year, authorship position. Under the metric rule it also supplies cited-work metrics, stored with the source name and the date |
| Inferred | The agent's general knowledge of a field, its groups, and its methods | A reason tagged `inferred`, always visible as such. Neither `fit` nor `host_strength` is `strong` on `inferred` alone |
| Leads | Directories, ranking sites, profile aggregators, search results, and a lab or personal site no official page links to | That an institution, a unit, or a person exists and is worth confirming on their own official page. Nothing else, at any source |

There is no ranking tier: an institution's rank says nothing about a person. A bibliographic record says what was published, not whose it is: a paper is recorded as a person's only when an official page anchors it — the record gives the person an affiliation an official page ties them to, or the person's official page or linked site lists the paper. An index's author profile is a lead; it points at records and never says who someone is (`modes/summarize.md` → Whose paper it is). Every official or linked fact is read-grade — it says what the page said on the date it was read, and not what is true now. A judgement resting on a linked fact carries `linked` as its `evidence_basis`, not `official`: no institution published it.

## Host Candidate Sources

`list` works through three sources: the fellowship's own published list of eligible hosts, where it publishes one; the eligible units' own people and research-group pages, with the unit list formed from the host rules; and one named person's own page, by giving `mentor-match` that official URL.

**A published list bounds the pool only when the host rules say it does.** Read the eligibility rule rather than the list page. Where the rule makes the list the whole of who may host, the list is the pool and the run says so, because such a list can be stale or partial. Where the rule admits people who are on no list — a fellowship that names its own faculty *and* anyone at the university working on the subject — the list is one source among others and the unit pages are read as well. The fellowship record carries which, as `bounds_pool` on each published list, because a run cannot read it back off a URL. Every source considered is reported with its outcome.

Where a host rule admits people by subject rather than by unit, the agent forms the unit list from that rule and the brief, and each unit names the rule it came from. A list page that renders its names with a script is read through the same site's own data route, and a list the run cannot read is a gap, never rebuilt from a lead.

Each source's cost against the budget, and the rule for reading it, are `modes/_shared.md` → Host Candidate Sources.

## Modes

Each mode is one file the router reads. It names what it may search, what it may write, and which guards must pass on what it writes.

The profile is the applicant's own and serves every fellowship they apply to. Everything else a mode writes for one fellowship sits in that fellowship's folder, `applicants/{applicant-id}/{fellowship-id}/`, named for the id of its record in `fellowships/`, so a second fellowship never touches the first one's files. Each report a mode writes has its machine record, the English file the guards read, under the same name in the folder's `machine/`.

| Mode | The applicant's question | Writes |
|---|---|---|
| `brief` | What does this fellowship ask of a host, and what am I proposing | `fellowships/{fellowship-id}.yml`, `applicants/{applicant-id}/profile.yml`, `applicants/{applicant-id}/{fellowship-id}/brief.md` |
| `list` | Who could host me | `applicants/{applicant-id}/{fellowship-id}/pool/`; rows appended to `registry/researchers.yml` and `registry/institutions.yml` |
| `summarize` | Who is each of these people, on the evidence | `applicants/{applicant-id}/{fellowship-id}/summaries/` |
| `recommend` | Who should I write to, and why | `applicants/{applicant-id}/{fellowship-id}/recommendations/` |

A fifth path, giving `mentor-match` an official URL, adds one named person from their own page through `list`'s single-URL path.

`doctor` is the live answer to what exists. Its `validate_kinds[]` and `modes[].built` say which of the four are built; a mode whose kind `validate` does not know is named as what comes next and never offered as a step.

## The Four Layers

Facts about a person, a run's record of looking for people, the prose that describes a person, and the judgement about a person are four different things, and they live in four different places: the researcher registry, and the pool, summary and recommendation files the modes above write. An entry in any of the three above the facts layer names its `researcher_key` rather than carrying a second copy of what the row already holds.

What each layer holds, what each one never holds, and how `validate` resolves the joins between them is the table in `DATA_CONTRACT.md`.

## The Two Judgement Axes

`recommend` produces two calls per host candidate. They are never averaged, never combined into a score, and never used to rank the list.

| Axis | Question | Reasons may rest on | Never rests on |
|---|---|---|---|
| `fit` | Does this person's published work connect to my project? | Topic overlap between the brief and the published record, recent first- or last-author output in the window, what the group states it works on | Any metric |
| `host_strength` | Is this a host worth applying with under this fellowship's rules? | Whether the person holds an independent position, published funding, a published record of hosting fellows, output in the window, cited-work metrics with their source and date | An unsourced reputation claim; a journal impact factor |

Both take `strong`, `plausible`, `weak` or `unclear`, each with its own reasons and an `evidence_basis` of `official`, `linked`, `bibliographic` or `inferred`: the tier, under Sources and Trust, that the reasons rest on. Neither is `strong` on `inferred` alone. Neither rests on `availability`: a stated opening is shown as a fact, because if `stated_open` could raise a call, `unknown` would lower one. Published funding and a record of hosting fellows are not recorded in this release, so no `host_strength` reason rests on them yet.

The report proposes one set of the size the fellowship asks for, chosen so that between them its members cover the needs the brief names, each with the need it covers. It is a set with no order, and the keep or drop is the applicant's.

The applicant sees both. A host candidate can be a close fit at a small group and a loose fit at a large one, and those are different applications; one number would hide the difference.

## User Layer

Nothing the applicant owns — their configuration, their fellowship records, their own work product, or either local registry — changes except by a mode writing what `validate` passes, or on the applicant's own instruction. The mode writes the file, validates it, and gives its path with a few lines on what to read first; the applicant reads it there, edits it, or says what to change. No file's content is shown in chat, and no yes is asked before a write.

- A profile, a brief, a fellowship record or a report that a write replaces is first moved into `.history/` beside it, stamped with the date and time, and the chat says so.
- Neither registry keeps a `.history/`. A copy of `registry/researchers.yml` would be personal data outside the file this tool keeps disposable, and deleting that file must still delete it.
- A new row in either registry is written once `validate` passes, and the pool report lists every row the run added, so the applicant can remove an institution they would not have admitted.

Which paths those are is the User Layer table in `DATA_CONTRACT.md`.

Files ending in `.example.*`, the seed file `registry/institutions.seed.yml`, and fixtures under `examples/` are system references, not user layer.

## Language

Three rules, none with a configuration key. **Chat is the applicant's language** from the first sentence; a bare command, with no prose of theirs, takes the language of their brief. **Report prose is the applicant's language; machine records and registry rows are English**, because the guards read them. **Write plainly**: the shortest exact word, no mannered prose, no adjective that carries no fact, and no jargon beyond this tool's fixed vocabulary and the page's own words, glossed only where the reader would not already know the term. A person's name, a unit name, and a role title keep the form the page published them in and are never translated. The full statement, and the subagent rule, are in `modes/_shared.md`.

## Agent Authorship And Deterministic Guards

The agent authors judgement: which host list or which units to read and why, who belongs in the pool, what each host candidate's published record adds up to, each `fit` and each `host_strength` with its reasons and evidence basis, and the prose of every report. The deterministic layer — the guards below and the `verify:*` suite — is a boundary around that authorship rather than a participant in it: it must not invent, re-rank, paraphrase, or override agent-authored content. A guard rejects bad input; it never rewrites it. When a decision is missing, stop and surface it rather than fabricate a fallback.

A guard checks structure and joins, not wording. What protects a third party stays strict whatever the agent's strength, because the person being catalogued did not agree to it: the closed researcher field set, the blocklist, the identifier and metric rules, the joins. What judges the quality of the agent's own work — whether a brief says enough, how a page titles itself — is the agent's call, and the applicant reads the result.

Three commands, all offline. None reaches the network.

| Guard | Decides | State |
|---|---|---|
| `doctor` | Workspace health and pipeline position, from a fixed table over file existence and recorded facts, never from report prose | Installed |
| `validate <kind> <file>` | Whether a file may be written: schema, controlled vocabulary, required fields, id shape, banned claims in the tool's own words, script inside registry rows and machine records, a report and its machine record present together, the gate on every URL a record cites, the identifier shape on every publication cited, and the joins between layers. The full list is `modes/_shared.md` → Guard Invocation | Installed for `fellowship`, `profile`, `brief`, `pool`, `summaries`, `recommendation`, `researchers`, `institutions` |
| `gate <url> [--institution "<name>"]` | `official`, `needs_registry_row`, or `blocked` for a URL's domain | Installed |

Every path a guard is handed is resolved and proved to be inside this repository before it is opened, which is the runtime half of **Standalone** above.

## Budgets

`config.yml` caps web searches, page opens and bibliographic fetches per run. Every `list` and `summarize` report ends with the budget spent against those caps and the number of host candidates carried to the next run. `recommend` opens nothing by default, and its report ends with the page opens it spent.

Every cap that ships with `config.example.yml` was counted on a real run, an application to the Kempner Research Fellowship, and the comment beside it says what was counted. The page-open and search caps come from its first `list` run, on 2026-09-23, which took 110 page opens and 10 web searches. The bibliographic cap, which `summarize` reads, comes from its first `summarize` run, on 2026-09-24, which took 46 bibliographic fetches for 20 host candidates. Each cap is its count with slack.
