# Unit reader for list

Read one eligible unit's people page, screen its people against the brief, and confirm each person kept on their own official page. This procedure serves source 2 only. The main session can follow it sequentially; a delegated worker returns its findings to the caller.

The worker never writes to disk; the caller writes, and `validate researchers` enforces the field set whatever this worker returns.

The caller prepends, verbatim: the three language rules from `modes/_shared.md` → Language, and `AGENTS.md` → Personal Data, including **What is never recorded** and **Linked sites**. The worker also reads `modes/_shared.md` → Agent capabilities and Redirects before any web request. Do not depend on inherited context or tool restrictions from another agent's configuration. The assigned search and page-open caps apply in every agent.

## Input

One unit as JSON: `unit`, `institution`, `official_url` (may be null), `host_rule` (the rule's quote), `why` (why the unit is on the list), the brief's mentor needs in one paragraph, the `researcher_key`s and official URLs already in the pool or the registry (read nobody twice), and the budget this worker may spend (`web_searches`, normally 1; `page_opens`, normally 6).

## Procedure

1. Resolve the unit's people page. When `official_url` is null, one `site:<domain>` web search is allowed; a search result is a lead and supplies no fact.
2. Run `node scripts/cli/gate.js <url> --institution "<institution>"` on every URL before any fact is taken from it. On `blocked`, return that and stop. On `needs_registry_row`, return the gate's row template and any tie to the domain from outside it that the run has seen: an admitted page linking to it, or its ROR record. Then stop; the caller runs the registry row flow (`modes/_shared.md`). Apply its redirect procedure before following a target.
3. Open the people page once. If it renders by script, look for the same site's data route before calling it a gap.
4. Screen each person the page names against the brief's needs and the host rule. Open a person's own official page only for someone whose line could host the project. Keep a person whose own page states work that meets a need; discard, with the reason, a person you opened and did not keep. Do not list people you never opened.
5. A page that would not open, or opened and stated only a role, is `unconfirmed` with its reason. Try one other official page for the same person when budget remains; a second page is often where the work is stated.
6. Follow a lab or personal site only from an official page that links to it for that person, and only for a field the official pages lack. Record the linking page as `linked_from`.
7. Return JSON only to the caller when delegated. In sequential use, retain the same findings for the pool; do not paste them into the applicant's chat.

## Output

The caller writes each confirmed person's `row` into `registry/researchers.yml` and names it from the pool by `researcher_key`; the rest becomes the pool's run fields.

```json
{
  "unit_outcome": "read | page_unavailable | needs_registry_row | not_opened_budget",
  "official_url": "...",
  "retrieved_at": "YYYY-MM-DD",
  "registry_row_template": null,
  "confirmed": [
    {
      "kept_because": "...",
      "scope_notes": ["..."],
      "row": {
        "researcher_key": "...", "name": "...", "institution": "...", "unit": "...",
        "role_title": "...", "official_url": "...", "retrieved_at": "YYYY-MM-DD",
        "research_statement": {"quote": "...", "source_url": "...", "retrieved_at": "YYYY-MM-DD", "linked_from": null},
        "contact": {"email": "...", "source_url": "...", "retrieved_at": "YYYY-MM-DD", "linked_from": null},
        "availability": {"value": "unknown"}
      }
    }
  ],
  "unconfirmed": [{"name": "...", "unconfirmed_reason": "page_unavailable | no_statement_of_work | not_opened_budget", "note": "...", "page_url": "...", "linked_from": null}],
  "discarded": [{"name": "...", "rests_on": "own_page | host_rule", "reason": "...", "page_url": "...", "linked_from": null}],
  "gaps": ["..."],
  "budget_spent": {"web_searches": 0, "page_opens": 0}
}
```

Omit a row field the pages do not carry rather than filling it. `null` for `linked_from` means the fact came from an official page. `page_url` is the page an unconfirmed or discarded person's reason rests on, as it served the content after any redirect: the caller writes it into the pool, because that person has no row.

## Never

- Never record a fact from a page the gate did not admit, or from a search result, a directory, an aggregator or a social account.
- Never return a field outside the row above. A page publishes more than the set — pronouns, a phone number, an office address, a family, a birthplace — and all of it stays on the page.
- Never paraphrase a quote; "not found" is the honest value.
- Never infer availability. `stated_open` and `stated_closed` need the page's own sentence; a lab recruiting PhD students says nothing about a fellow.
- Never write to disk.
