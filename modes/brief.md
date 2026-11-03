# Brief Mode

After a brief, `list` comes next.

## Purpose

Write down the two things every later mode reads: what this fellowship asks of a host, and what the applicant is proposing.

Both are conversational to build. The fellowship half is a read of the fellowship's own pages, rule by rule, each rule recorded with the page's own words, the URL it came from, and the date it was read; nothing about the host is assumed, including whether a host is required at all, what the fellowship calls the relationship — mentor, host, sponsor, supervisor, affiliation — and whether it publishes a list of eligible hosts. The applicant half is their own record and their own project, in their own words, and asks for as little as `list` needs to start.

## Inputs

- the fellowship's own pages;
- the applicant, in conversation, and any file they name inside this repository — a CV, an abstract, a proposal. Nothing outside it is read. When the applicant asks where to put one, the answer is `applicants/{applicant-id}/`, which is gitignored; a file at the repository root is not, and `git add .` would commit it;
- `applicants/{applicant-id}/profile.yml` when it exists. It serves every fellowship, so a second fellowship reads it rather than asking again;
- `applicants/{applicant-id}/{fellowship-id}/brief.md` when it exists;
- `config.yml` for `default_applicant` and the budget caps.

## May search

The fellowship's own site, and one `site:` search to find it when the URL is unknown. Nothing about a person: no host candidate is looked up in this mode, and no name is recorded anywhere by it.

## May write

- `fellowships/{fellowship-id}.yml`
- `applicants/{applicant-id}/profile.yml`
- `applicants/{applicant-id}/{fellowship-id}/brief.md`, in a folder named for the record's `fellowship_id`

In that order, each written, checked and pointed to as `modes/_shared.md` → Writing Files says; a file that exists moves into `.history/` first. Nothing else. The record is named for the `fellowship_id` it carries; `validate` rejects a record whose id and filename disagree, and a folder with no record of its id.

## Guards

- `node scripts/cli/validate.js fellowship <file>` on the record written, then `validate profile` and `validate brief` on theirs. `validate` gates every URL the record carries and refuses one the gate `blocked` — not https, a directory, an aggregator, a ranking site, a search wrapper — because then it is not the fellowship's own page: find that page instead. `needs_registry_row` is not a refusal here. It says whether a page may supply a fact about a *person*, and a funder's own site sits under no academic registry; this mode reads no person, so it runs no registry row flow. Run `node scripts/cli/gate.js <url>` first when you are unsure a page is the fellowship's own.
- `node scripts/cli/doctor.js` after the write, to confirm the next step.

## Reading the fellowship

**The read comes before the questions.** Open the fellowship's own pages first and find out what it asks of a host; then ask the applicant only what the pages cannot answer. An applicant does not always know whether their fellowship requires a signature, and asking them is not a source.

Record `host_requirement` as `required`, `optional` or `none` from what the pages say:

| Value | What the pages show |
|---|---|
| `required` | The application is not accepted until a named host has agreed |
| `optional` | A mentor is named as part of the application, or people are published to choose from, or contact is invited — without an agreement being required |
| `none` | No mentor or host component at all |

`required` and `optional` both continue to `list`: a fellowship that lets the applicant choose a mentor needs the same three answers as one that will not accept an application without a signature, and `optional` is carried into the reports so they say which it is. On `none`, say so and stop, because there is then nobody to look for; the record carries no host fields at all and `doctor` reports that the pipeline ends here.

### One rule, two fields

Each entry in `host_rules` carries both `rule` — what the rule means for this applicant, in plain words — and `quote`, the page's own words, verbatim. The paraphrase is what the later modes act on; the quote is what makes it checkable. Write the quote first and the paraphrase from it, never the other way round, and never paraphrase a source into a claim it does not make.

The field set is closed: `rule`, `quote`, `official_url`, `retrieved_at`. A rule that seems to need a fifth field is a note for the maintainer, not a key.

### A published list is not automatically the pool

Where the fellowship publishes a list of eligible hosts, record it under `host_lists` with its own name, URL and date — and with `bounds_pool`, which is the field that says whether reading that list is enough.

`bounds_pool: true` means the host rules make this list the whole of who may host, so `list` reads it and stops. `bounds_pool: false` means it is one branch among others, and then `note` says which rule leaves people off it, because a run that reads a list and stops has no way to discover that it missed a branch.

The distinction is not hypothetical: a fellowship can publish its own faculty *and* admit hosts from anywhere in the university who work on the named subjects. Read the eligibility rule, not the list page, to decide which this is.

## Building the applicant's half

The profile is the applicant's own record and holds no facts about anyone else. It serves every fellowship; the brief is this fellowship's. What this mode asks for comes in three levels:

| Level | What | If missing |
|---|---|---|
| Needed | The fellowship URL, the field, and the question in a few sentences — or a file holding them: a CV, an abstract, a proposal | `list` cannot run. Ask for it |
| Drafted | The mentor needs and the career stage | Draft them from the question, the host rules and any file; the applicant accepts or edits |
| Optional | Publications, methods, degrees, position, institution, country of work, constraints | A flag `recommend` cannot raise, or a summary that cannot say what touches the applicant's own papers; the reports' Gaps say which. Take them from a file the applicant names or from what they say unasked; never ask for them one by one |

**The first message** comes after the fellowship's pages are read. It asks for what the first level still lacks, in one message, and offers to read a file for the rest. Where the applicant gave the field and the question with the URL, there is nothing to ask but the drafted level.

**Drafted needs.** Where the applicant states no mentor needs, draft two to four from the question, the host rules and any file: each a kind of expertise, method or data a host's group would bring, never a person. Put them, and the career stage where it is drafted too, in one short message for the applicant to accept or edit; that is the round's one question. Once answered, write them into the brief under a line that says so, in the brief's language: *Drafted from the question and accepted by the applicant on 2026-10-22.* `list` screens on the needs, and `fit` and the proposed set are judged against them, so the mark is what lets the applicant, and a later run, see where they came from. A need the applicant rewrites is theirs, and drops out of the mark.

An applicant with a fellowship URL and a paragraph therefore reaches `list` after one round of questions.

`unknown` or `none` is an answer where it is the true one — an applicant between positions, or with no current institution. A constraint becomes a flag in a recommendation, never a filter that silently removes a host candidate. `validate profile` requires `applicant_id`, `field` and `career_stage`, and notes each other field that is missing with what a later mode loses for it.

Each publication carries a `status` — `published`, `preprint` or `accepted` — and an identifier. `accepted` is the one state that may carry no identifier, because a venue can accept a paper months before it issues a record for it; say which venue accepted it, and expect `validate` to note that nothing may cite it until the record exists. That relaxation is the applicant's own record and nothing else: it never reaches a host candidate, whose unpublished acceptance is a claim no page can support.

The brief is the applicant's own words about their own project, in their own language. Three sections earn their place — what the question is, what they would do, and what they need from a host. Only the question is needed; the needs are drafted where the applicant gives none, and they are the section `list` and `recommend` lean on hardest, because they say what kind of group could host this rather than what kind of person is impressive. Nothing validates its prose: `validate brief` checks only that there is some, and that no paragraph of it is still the shipped example's. Its length and its headings are the applicant's.

### A second fellowship

Run `brief` again with the new fellowship's URL. It writes that fellowship's record and a new folder with its own brief, reads the profile rather than asking for it again, and leaves every other folder alone. One project sent to two fellowships is two briefs, because each fellowship's rules shape the needs: draft them again against these rules, starting from the first brief's question where the applicant says it is the same project.

## Output

A fellowship record carrying `host_requirement`, `host_relationship_term`, every host rule with its quote, its `official_url` and its `retrieved_at`, and every published host list with its `bounds_pool`; a profile; a project brief in the fellowship's folder; and a line saying what comes next. Point to the three files, with the brief's needs as what to read first.

The next step is `list`. Say what the applicant now has: a record of what the fellowship asks of a host, which is the thing they would otherwise be holding in their head. Where `host_requirement` is `none`, the pipeline stops here.

## What this mode does not do

It records no person. Not the name on a host list, not a mentor the applicant already has in mind, not an author of a paper the brief cites. A named person enters this repository through `list`, under the closed field set in `AGENTS.md` → Personal Data, and through nothing else.
