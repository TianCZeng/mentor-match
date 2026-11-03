# Summarize Mode

After a summaries report, `recommend` comes next.

## Purpose

Say who each host candidate in the pool is, on the evidence.

A pool row says a person exists and where. A summary says what they work on now, and that can only come from their own recent record: what their group states it works on, in the group's own words, and what they have published as first or last author inside the publication window.

A summary is checkable. Every substantive sentence traces to a researcher-row field or to a paper the row records, and the applicant can open each one. That is why description is a separate layer from judgement: an opinion about a stranger cannot be checked this way, and in one file it would read as though it could.

## Inputs

- the latest pool in the fellowship's folder, read from its machine record under `applicants/{applicant-id}/{fellowship-id}/machine/`, which `inputs.pool` names, and in it the confirmed host candidates. An unconfirmed one has no row, so there is nothing to summarise;
- `registry/researchers.yml`, for the rows that pool names;
- the folder's `brief.md` and `applicants/{applicant-id}/profile.yml`, to say what of the record touches the project. Where the profile lists no publications, the report's Gaps say that no summary could say what touches the applicant's own papers;
- `config.yml`: `publication_window_years` and the three budget caps. A key `config.yml` lacks is read from `config.example.yml`; say which file each value came from.

The window is the current calendar year and the `publication_window_years` before it: five years, read in 2026, is 2021 to 2026.

## May search

- Each host candidate's own official pages and linked sites: the pages the row already cites, and a group, research or publications page on the institution's domain. Each is a page open, through the gate.
- Bibliographic sources, by identifier or by an index query that lists records: Crossref, OpenAlex, arXiv, PubMed. Each request is a bibliographic fetch. An index's author profile is a lead: it points at records, and it never says who a person is.
- A web search where a host candidate's group page is not linked from a page the row cites.

Nothing else: no news story, no profile aggregator page, no social account, no directory.

## May write

- `applicants/{applicant-id}/{fellowship-id}/summaries/{YYYY-MM-DD}-summaries.md`, and its machine record `applicants/{applicant-id}/{fellowship-id}/machine/{YYYY-MM-DD}-summaries.yml`
- appended to a host candidate's existing row in `registry/researchers.yml`: the papers its summary cites, its cited-work metrics, and a `research_statement` where the row has none. Never a new row, and never a field outside the closed set.

Each written, checked and pointed to as `modes/_shared.md` → Writing Files says. Write the registry first, because the report joins it.

## Guards

- `gate` on every page a claim is read from. A bibliographic record is not gated: its identifier is its source, and the gate's question — may this page say who someone is — is not asked of it.
- `validate researchers` on the registry after the append: every identifier's shape, in any written form; an accepted paper with no identifier carries the page that states the acceptance; every metric carries its source and date.
- `validate summaries` on the report: each summary joins a confirmed host candidate in the pool it names and that person's row, with the labels compared; every citation joins the row — a citable field the row holds, a paper the row records by identifier in any written form, or an accepted paper by its title; a summary with no citation is a problem; every confirmed host candidate is summarised or carried; the budget line against the caps; and the banned-claim and English-script scans over the record's gaps. The prose is not scanned. It quotes a group in its own words, which may call itself world-leading, and it is in the applicant's language, which an English phrase list cannot read; so it is the agent's, and the applicant reads it against its sources.
- `doctor` after the write.

## Whose paper it is

A paper is recorded as a person's only when an official page anchors it:

- the record, read by its identifier, lists the person as an author with an affiliation an official page ties them to — the row's institution, its unit, or an institution the page says they held; or
- the person's official page or linked site lists the paper. That page is the publication's `source_url`, with `linked_from` for a linked site.

A name match alone is refused, however rare the name. An index author profile may be used to find records, and each record is then held to the rule above. A paper under a past affiliation no official page states is not recorded, and the summary says the earlier record was not attributed.

## What is recorded

**Publications**, only those the summary cites, each with:

- `title` as the record gives it, `venue`, `year`;
- `authorship`: `first`, `last` or `middle`, as the record orders the authors;
- `status`: `published` for a journal or proceedings record, `preprint` for a repository record, `accepted` for a paper an official page or linked site states is accepted and that has no record yet;
- `identifier`: the DOI where the record has one, else the arXiv id, the PMID or the OpenAlex work id; and `retrieved_at`;
- `source_url` only where the anchor is a page listing the paper.

**Metrics**: `h-index` and `cited-by count`, each from the index author profile whose works the run anchored, with that index named as `source` and the date read. Not a two-year mean citedness, which is a rate of the kind a journal impact factor is. None from a profile whose works include papers that are not the person's; say so in the gaps. A summary never cites a metric: it is `host_strength` evidence, and `recommend` reads it from the row.

**A research statement**, where the row has none: one sentence from the group's own page, verbatim, with its page and date, held to the rules in `modes/list.md` → Rules from the first run.

## Output

One dated summaries report, in the applicant's language, opening with what it read and the window as years ("2021 to 2026", not the config key that set it), and holding one summary per confirmed host candidate, headed by the person's name. Each summary covers four things and nothing else:

1. **What the group works on**, in the group's own words: the row's research statement, quoted.
2. **Recent record**: the first- and last-author papers read inside the window. They are a selection, and the report says so; name each by title, venue and year.
3. **What touches the brief**: which of those papers or statements meets which of the brief's needs, said as a fact about each — "the 2024 paper varies the spacing of repeated images", not "a close match". No degree word, no comparison with another host candidate.
4. **Not established**: what the run could not read or attribute — a statement of work, an earlier record under a past affiliation — about this person alone. Leave the line out when the only thing missing is an availability nobody stated, or when the line would only restate the report's opening rule on which papers count; Gaps and the opening say those once for the whole report.

Every substantive sentence ends with a link to the page it rests on: a paper's link targets `https://doi.org/…` or `https://arxiv.org/abs/…`, with the title as its label in the Recent record and the venue and year after it; a row field links that field's `source_url`. No pronoun about a person, because a pronoun is gender, which is never recorded: the surname, "the page", "the lab", "the 2025 paper".

No summary compares two host candidates, carries a `fit` or a `host_strength`, ranks anything, or says anything about the person that they could not read on their own page or in their own papers. Those calls are `recommend`'s, and the comparison is the applicant's.

A host candidate the caps did not reach is carried: named in the report and in the record's `carried`, for the next run. The report ends with **Gaps** — this run's own, with a link to the pool's Gaps for what the pool's run met — the budget line: web searches, page opens and bibliographic fetches spent against the caps, and the number carried; and the line linking its machine record.

The machine record, in English, carries per summary the `researcher_key`, the identity labels, `cites` — each `{field: …}`, `{identifier: …}` or `{accepted: <title>}` — and `gaps`; and for the run `inputs`, with the pool named by its machine record, `publication_window_years`, `budget`, `carried` and `gaps`. `examples/summaries-valid.md` and `examples/summaries-valid.yml` are the shape.

## Identifiers

`scripts/lib/identifiers.js` checks the shape of a DOI, an arXiv id, a PMID and an OpenAlex work id offline. It accepts every form an identifier is written in — `10.…`, `doi:10.…` and `https://doi.org/10.…`; an arXiv id with or without `arXiv:`; a PMID as `PMID: …` or its PubMed URL — normalised before the shape is tested, so a correct identifier is never refused for how it was written, and a row and a summary that write one paper two ways still join. It is deliberately not a resolver: a guard that fails because a server is down is not a guard.
