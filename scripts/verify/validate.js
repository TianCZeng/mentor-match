// The validate guard against the committed fixtures. Each kind has one valid
// fixture, and each invalid case is that file with one thing changed, written
// here as the edit beside the field the guard must name: a rule that stops
// firing, or starts naming a different field, fails here.
const fs = require("fs");
const path = require("path");
const { validateFile } = require("../cli/validate");
const { registrableLabel } = require("../lib/gate");
const { REPORT_KINDS, reportPair, workspaceForPath } = require("../lib/workspace");
const { bannedPhrasesIn, validateFellowship, validateProfile, validateRecommendation } = require("../lib/schema");
const { parseIdentifier } = require("../lib/identifiers");
const { loadYamlFile } = require("../lib/yaml");

const repoRoot = path.resolve(__dirname, "..", "..");

const FELLOWSHIP = "examples/fellowship-valid.yml";
const PROFILE = "examples/profile-valid.yml";
const BRIEF = "examples/brief-valid.md";
// A report is two files. Its cases edit the machine record, which is what
// the guard reads; the report beside it is checked once as committed.
const POOL = "examples/pool-valid.yml";
const SUMMARIES = "examples/summaries-valid.yml";
const RECOMMENDATION = "examples/recommendation-valid.yml";
const RESEARCHERS = "examples/researchers-valid.yml";
const INSTITUTIONS = "examples/institutions-valid.yml";
const SEED = "examples/institutions-valid.seed.yml";

// [file, kind, expected, what the case pins, ...edits]. `expected` is `ok` for
// a file that must validate clean, or the exact `field` of a problem the guard
// must report. With no edits the file is checked as committed. An edit is
// [find, replace] over the file's text, in memory: a string must occur exactly
// once and a regular expression at least once, so an edit that stops matching
// its file fails here instead of quietly testing the valid one.
const CASES = [
  ["fellowships/example-institute-research-fellowship.example.yml", "fellowship", "ok", "the shipped template"],
  [FELLOWSHIP, "fellowship", "ok", "as committed"],
  [FELLOWSHIP, "fellowship", "ok", "no host component, and nothing else recorded",
    [/host_requirement: optional[\s\S]*/, "host_requirement: none\n"]],
  // The banned-phrase scan reads the tool's own words -- `rule` and
  // `note` -- and nothing copied from a page, so a fellowship that calls itself
  // prestigious in its title, its list names and its quotes is recorded as the
  // page wrote it. And a fellowship's own page is refused only when the gate
  // blocks it, so a funder under .org, which no academic registry and no seed
  // row places, is a source for its own rules.
  [FELLOWSHIP, "fellowship", "ok", "banned words in the page's own name, institution, list title and quote",
    ["name: Example Institute Research Fellowship", "name: Prestigious Example Research Fellowship"],
    ["host_institution: Example Institute", "host_institution: World-Class Example Institute"],
    ["- name: Institute Faculty", "- name: Prestigious Faculty Directory"],
    ["quote: Candidates will be asked to provide the names of two to three proposed mentors.",
      "quote: Candidates will be asked to name two to three mentors from our world-leading faculty."]],
  [FELLOWSHIP, "fellowship", "ok", "a funder's own pages under .org",
    ["host_institution: Example Institute", "host_institution: Example Foundation"],
    [/www\.example\.edu\/fellowships/g, "www.example.org/funding"]],
  [FELLOWSHIP, "fellowship", "host_requirement", "a value outside the vocabulary",
    ["host_requirement: optional", "host_requirement: encouraged"]],
  [FELLOWSHIP, "fellowship", "host_rules[0].quote", "a rule with no quote",
    ["    quote: Candidates will be asked to provide the names of two to three proposed mentors.\n", ""]],
  [FELLOWSHIP, "fellowship", "host_rules[0].official_url", "a rule read off a profile aggregator",
    ["mentors.\n    official_url: https://www.example.edu/fellowships/research-fellowship",
      "mentors.\n    official_url: https://www.researchgate.net/profile/Someone"]],
  [FELLOWSHIP, "fellowship", "host_rules[0].category", "a key outside a rule's closed set",
    ["  - rule: No prior agreement", "    category: count\n  - rule: No prior agreement"]],
  [FELLOWSHIP, "fellowship", "host_lists[0].bounds_pool", "a list that does not say whether it bounds the pool",
    ["    bounds_pool: false\n", ""]],
  [FELLOWSHIP, "fellowship", "host_lists[0].note", "a list that does not bound the pool, with no note saying who else is eligible",
    [/    note: >-\n(?:      .+\n)+/, ""]],
  [FELLOWSHIP, "fellowship", "host_rules[1].rule", "a reputation claim and a prediction in the tool's own words",
    ["rule: No prior agreement with a proposed mentor is needed before applying.",
      "rule: Mentors are drawn from this world-leading institute, so most are likely to accept."]],
  [FELLOWSHIP, "fellowship", "host_rules", "host rules on a fellowship with no host component",
    ["host_requirement: optional", "host_requirement: none"]],

  ["applicants/profile.example.yml", "profile", "ok", "the shipped template"],
  [PROFILE, "profile", "ok", "as committed"],
  // Three fields are what list needs to start, and every other one is a note.
  // The fellowship is the folder an application sits in, so a key naming one
  // is refused rather than left to disagree with the path.
  [PROFILE, "profile", "ok", "only the three required fields",
    [/\ncurrent_position:[\s\S]*/, "\n"]],
  [PROFILE, "profile", "fellowship", "a fellowship key, which the folder already names",
    ["applicant_id: example-applicant\n", "applicant_id: example-applicant\nfellowship: example-institute-research-fellowship\n"]],
  [PROFILE, "profile", "career_stage", "a required field missing",
    ["career_stage: final-year PhD\n", ""]],
  [PROFILE, "profile", "publications[0].identifier", "a published paper with no identifier",
    ["    identifier: 10.0000/example.2025.00001\n", ""]],
  [PROFILE, "profile", "publications[0].status", "a status outside the vocabulary",
    ["status: published", "status: in-press"]],
  // A venue can accept a paper months before it issues a record for it, so
  // an accepted entry may carry no identifier. In the applicant's own profile
  // that is the whole rule, because they are self-reporting their own work; a
  // host candidate's row takes the same status and must carry the official page
  // that states the acceptance, which `validate researchers` enforces.
  [PROFILE, "profile", "ok", "an accepted paper with no identifier",
    ["    status: published\n    identifier: 10.0000/example.2025.00001\n", "    status: accepted\n"]],
  [PROFILE, "profile", "degrees", "no degrees",
    [/degrees:\n(?:  .+\n)+/, "degrees: []\n"]],
  // `unknown` and `none` are answers in a free-text field, and a
  // placeholder word is refused only where an identifier belongs.
  [PROFILE, "profile", "ok", "unknown and none as answers",
    ["current_position: PhD candidate, Department of Example Studies", "current_position: unknown"],
    ["current_institution: Example State University", "current_institution: none"]],
  [PROFILE, "profile", "publications[0].identifier", "a placeholder where an identifier belongs",
    ["identifier: 10.0000/example.2025.00001", "identifier: unknown"]],

  // No length floor, so a complete brief in Chinese, one sentence a
  // section, is a brief. What is refused is a brief with no prose, and one that
  // still carries a whole paragraph of the shipped example, rewrapped or not.
  ["applicants/brief.example.md", "brief", "(file)", "the shipped example itself"],
  [BRIEF, "brief", "ok", "as committed"],
  ["examples/brief-valid-concise-zh.md", "brief", "ok", "a complete brief in Chinese, one sentence a section"],
  [BRIEF, "brief", "(file)", "headings and no prose",
    [/^(?!#).+\n/gm, ""]],
  [BRIEF, "brief", "(file)", "a paragraph of the shipped example, rewrapped",
    [/- Models of learning[\s\S]*/, `Example question: whether an example circuit implements an example
computation, and if so by what mechanism. The current models account for the
steady state and not for the transient, and no published recording set is long
enough to separate the two.
`]],

  // The run record. The valid pool joins examples/fellowship-valid.yml and
  // examples/researchers-valid.yml and exercises all three sources, both
  // statuses, a carried host candidate, and two discards: one citing its
  // list's page and one citing a linked site with the page that links to it.
  [POOL, "pool", "ok", "as committed"],
  ["examples/pool-valid.md", "pool", "ok", "the report, checked through the machine record beside it"],
  [POOL, "pool", "host_candidates[2].kept_because", "Han script in a keep reason, which is the tool's own words and English",
    ["kept_because: Added by the applicant from the person's own page.", "kept_because: 申请人从其本人页面添加。"]],
  [POOL, "pool", "host_candidates[0].researcher_key", "a confirmed host candidate naming no row, so its facts live nowhere",
    ["  - researcher_key: example-institute-mira-ostrander\n", "  - researcher_key: example-institute-mira-ostrand\n"]],
  [POOL, "pool", "host_candidates[0].name", "a label that disagrees with the row it names",
    ["    name: Mira Ostrander\n", "    name: Mira Ostrander-Kell\n"]],
  [POOL, "pool", "host_candidates[0].official_url", "an entry copying a fact its row holds",
    ["    unit: Department of Computation\n", "    unit: Department of Computation\n    official_url: https://www.example.edu/people/mira-ostrander\n"]],
  [POOL, "pool", "units[0].host_rule", "a unit naming a host rule the fellowship record does not carry",
    ["host_rule: Proposed mentors may be members of the Institute faculty or faculty across the university whose research addresses learning and memory.\n    why: The subject rule admits",
      "host_rule: Candidates may name any faculty member at the institute.\n    why: The subject rule admits"]],
  [POOL, "pool", "host_lists", "a list the fellowship record carries, left out",
    [/host_lists:\n(?:  .+\n)+/, "host_lists: []\n"]],
  [POOL, "pool", "host_lists[0].entries", "a list's size disagreeing with the entries naming it; someone left silently",
    ["    entries: 4", "    entries: 5"]],
  [POOL, "pool", "budget.page_opens.used", "page opens over the cap the run states",
    ["page_opens: {used: 10, cap: 10}", "page_opens: {used: 11, cap: 10}"]],
  // Within the cap the run states and over config.example.yml's 20 searches: a
  // stated cap cannot lift the config's, so this edit moves with that number.
  [POOL, "pool", "budget.web_searches.used", "web searches over config.example.yml's cap",
    ["web_searches: {used: 3, cap: 20}", "web_searches: {used: 25, cap: 30}"]],
  [POOL, "pool", "discarded[0].reason", "a discard with no reason",
    ["    reason: The list gives the role as Professor of Materials Chemistry, which is not one of the brief's needs.\n", ""]],
  [POOL, "pool", "discarded[0].rests_on", "a discard resting on availability, which removes nobody",
    ["rests_on: list_line", "rests_on: availability"]],
  [POOL, "pool", "units[0].official_url", "a unit page the gate blocks, here for its http scheme",
    ["    official_url: https://www.example.edu/imaging-memory/people\n", "    official_url: http://www.example.edu/imaging-memory/people\n"]],
  [POOL, "pool", "host_candidates[0].kept_because", "an unsourced reputation claim in a keep reason",
    ["kept_because: The page states the group models", "kept_because: A world-leading group. The page states the group models"]],
  [POOL, "pool", "host_candidates[3].researcher_key", "an unconfirmed host candidate naming a row no page confirmed",
    ["  - researcher_key: null\n    name: Ines Varga", "  - researcher_key: example-institute-mira-ostrander\n    name: Ines Varga"]],
  [POOL, "pool", "units", "no units, although no list bounds the pool",
    [/units:\n(?:  .+\n)+/, "units: []\n"]],
  // An entry with no row carries the page its reason rests on -- the
  // source's own page, or a page about the person gated as a row's fact is --
  // and a confirmed one carries none, because its pages are in its row.
  [POOL, "pool", "discarded[0].page_url", "a discard with no page",
    ["    page_url: https://www.example.edu/people/faculty\n", ""]],
  [POOL, "pool", "host_candidates[3].page_url", "an unconfirmed host candidate with no page, which has no row to keep one",
    ["    page_url: https://www.example.edu/people/ines-varga\n", ""]],
  [POOL, "pool", "discarded[0].page_url", "a discard on the list line naming a page other than the list's own",
    ["page_url: https://www.example.edu/people/faculty", "page_url: https://www.example.edu/people/jonas-pell"]],
  [POOL, "pool", "discarded[1].page_url", "a discard resting on a lab site no official page is recorded as linking to",
    ["    linked_from: https://www.example.edu/imaging-memory/people/petra-lund\n", ""]],
  [POOL, "pool", "host_candidates[0].page_url", "a confirmed host candidate carrying a page its row already holds",
    ["    kept_because: The page states the group models", "    page_url: https://www.example.edu/people/mira-ostrander\n    kept_because: The page states the group models"]],

  // The description layer. The valid report joins examples/pool-valid.yml and
  // examples/researchers-valid.yml: two summaries citing a row field, a paper
  // by identifier, an accepted paper by title and a stated availability, and
  // the pool's third confirmed host candidate carried.
  [SUMMARIES, "summaries", "ok", "as committed"],
  ["examples/summaries-valid.md", "summaries", "ok", "the report, checked through the machine record beside it"],
  // The joins run between machine records, and a report's prose is never read.
  [SUMMARIES, "summaries", "inputs.pool", "a pool named by its report rather than its machine record",
    ["pool: examples/pool-valid.yml", "pool: examples/pool-valid.md"]],
  [SUMMARIES, "summaries", "summaries[0].cites[2].identifier", "an unidentified citation",
    ["identifier: doi:10.5555/example.2025.001", "identifier: pending"]],
  [SUMMARIES, "summaries", "summaries[0].gaps[0]", "an unsourced reputation claim in the machine record",
    ["      - The page states nothing about taking a fellow.", "      - A world-leading group; the page states nothing about taking a fellow."]],
  [SUMMARIES, "summaries", "summaries[0].cites", "a summary with no citable claim",
    ["    cites:\n      - field: role_title\n      - field: research_statement\n      - identifier: doi:10.5555/example.2025.001\n", "    cites: []\n"]],
  [SUMMARIES, "summaries", "summaries[0].researcher_key", "a summary of someone the pool did not confirm",
    ["  - researcher_key: example-institute-mira-ostrander", "  - researcher_key: example-institute-ines-varga"]],
  [SUMMARIES, "summaries", "summaries[0].cites[2].identifier", "a well-formed identifier the row does not record",
    ["identifier: doi:10.5555/example.2025.001", "identifier: doi:10.5555/example.2024.999"]],
  [SUMMARIES, "summaries", "ok", "the row's paper cited in another written form, which is the same key",
    ["identifier: doi:10.5555/example.2025.001", "identifier: 'DOI: 10.5555/EXAMPLE.2025.001'"]],
  [SUMMARIES, "summaries", "summaries[1].cites[1].accepted", "an accepted title the row does not hold",
    ["accepted: Repetition and spacing in human visual cortex", "accepted: Spacing in human visual cortex"]],
  [SUMMARIES, "summaries", "summaries[0].cites[0].field", "an availability citation where the row states none",
    ["      - field: role_title\n", "      - field: availability\n"]],
  [SUMMARIES, "summaries", "summaries[0].cites[0].field", "a metric cited in a summary, which is host_strength evidence",
    ["      - field: role_title\n", "      - field: metrics\n"]],
  [SUMMARIES, "summaries", "summaries[0].fit", "a fit call in a summary, which is recommend's (principle 7)",
    ["    cites:\n      - field: role_title", "    fit: strong\n    cites:\n      - field: role_title"]],
  [SUMMARIES, "summaries", "summaries", "a confirmed host candidate neither summarised nor carried",
    ["carried:\n  - example-university-li-ming\n", "carried: []\n"]],
  [SUMMARIES, "summaries", "carried[1]", "a host candidate both summarised and carried",
    ["carried:\n  - example-university-li-ming\n", "carried:\n  - example-university-li-ming\n  - example-institute-mira-ostrander\n"]],
  [SUMMARIES, "summaries", "summaries[0].name", "a label that disagrees with the row",
    ["    name: Mira Ostrander\n", "    name: M. Ostrander\n"]],
  [SUMMARIES, "summaries", "budget.bibliographic_fetches.used", "bibliographic fetches over config.example.yml's cap",
    ["bibliographic_fetches: {used: 6, cap: 60}", "bibliographic_fetches: {used: 61, cap: 100}"]],
  [SUMMARIES, "summaries", "budget.bibliographic_fetches", "no bibliographic line in the budget",
    ["  bibliographic_fetches: {used: 6, cap: 60}\n", ""]],
  [SUMMARIES, "summaries", "summaries[0].gaps[0]", "Han script in a gap, which is the tool's own words and English",
    ["      - The page states nothing about taking a fellow.", "      - 页面未说明是否接收博士后。"]],
  [SUMMARIES, "summaries", "publication_window_years", "no publication window",
    ["publication_window_years: 5\n", ""]],

  // The judgement layer. The valid report joins examples/pool-valid.yml,
  // examples/summaries-valid.yml and examples/researchers-valid.yml: two
  // entries, one fit resting on an official page and one on a linked site, a
  // host_strength citing a metric and the list the pool found the person on, a
  // proposed set, and the summaries' carried host candidate carried again.
  [RECOMMENDATION, "recommendation", "ok", "as committed"],
  ["examples/recommendation-valid.md", "recommendation", "ok", "the report, checked through the machine record beside it"],
  [RECOMMENDATION, "recommendation", "entries[1].fit.value", "strong on inferred alone",
    ["      value: strong\n      evidence_basis: linked", "      value: strong\n      evidence_basis: inferred"]],
  [RECOMMENDATION, "recommendation", "entries[0].host_strength.reasons", "a judgement with no reasons",
    ["      reasons:\n        - An associate professorship, on the fellowship's own Institute Faculty list, with a 2025 last-author paper.\n        - h-index 21 in OpenAlex, read 2026-09-23.\n", "      reasons: []\n"]],
  // The metric rule is a join on what a fit cites, never a scan of its
  // words, so the host_strength reason that names an h-index passes above.
  [RECOMMENDATION, "recommendation", "entries[0].fit.cites[2].field", "a fit citing a metric field of the row",
    ["        - identifier: 10.5555/example.2025.001\n    host_strength", "        - identifier: 10.5555/example.2025.001\n        - field: metrics\n    host_strength"]],
  [RECOMMENDATION, "recommendation", "entries[0].researcher_key", "an entry for someone the pool did not confirm",
    ["  - researcher_key: example-institute-mira-ostrander\n    name: Mira Ostrander", "  - researcher_key: example-institute-ines-varga\n    name: Mira Ostrander"]],
  [RECOMMENDATION, "recommendation", "entries[0].constraint_flags[0]", "a flag outside the closed list",
    [/constraint_flags: \[\]/, "constraint_flags: [senior_host]"]],
  [RECOMMENDATION, "recommendation", "entries[0].score", "a combined score beside the two axes",
    ["    status: kept\n", "    score: 0.8\n    status: kept\n"]],
  [RECOMMENDATION, "recommendation", "entries[1].host_strength.reasons[0]", "a prediction about a person in the machine record",
    ["        - An assistant professorship in a unit", "        - Likely to accept; an assistant professorship in a unit"]],
  [RECOMMENDATION, "recommendation", "ranking", "a rank beside the entries",
    ["carried:\n  - example-university-li-ming\n", "ranking:\n  - example-institute-tomas-reyna\ncarried:\n  - example-university-li-ming\n"]],
  // The basis is held to the cites: a call said to rest on a tier cites a fact
  // of it. Inferred needs none, and is never strong.
  [RECOMMENDATION, "recommendation", "entries[0].fit.evidence_basis", "an official basis citing no official fact",
    ["        - field: research_statement\n        - identifier: 10.5555/example.2025.001", "        - identifier: 10.5555/example.2025.001"]],
  [RECOMMENDATION, "recommendation", "entries[1].host_strength.evidence_basis", "a linked basis citing nothing read from a linked site",
    ["      evidence_basis: official\n      reasons:\n        - An assistant professorship", "      evidence_basis: linked\n      reasons:\n        - An assistant professorship"],
    ["        - field: unit\n        - field: research_statement\n        - accepted: Repetition and spacing in human visual cortex\n", "        - field: unit\n"]],
  [RECOMMENDATION, "recommendation", "entries[1].host_strength.cites[2].field", "a stated opening cited as a reason, which would make unknown lower a call",
    ["        - field: unit\n", "        - field: unit\n        - field: availability\n"]],
  [RECOMMENDATION, "recommendation", "entries[1].host_strength.cites[1].host_list", "a published list cited for someone the pool found at a unit",
    ["        - field: unit\n", "        - host_list: Institute Faculty\n"]],
  [RECOMMENDATION, "recommendation", "entries[0].fit.cites[2]", "list membership cited for a fit, which is about eligibility",
    ["        - identifier: 10.5555/example.2025.001\n    host_strength", "        - identifier: 10.5555/example.2025.001\n        - host_list: Institute Faculty\n    host_strength"]],
  [RECOMMENDATION, "recommendation", "ok", "the row's paper cited in another written form",
    [/identifier: 10\.5555\/example\.2025\.001/g, "identifier: 'doi:10.5555/EXAMPLE.2025.001'"]],
  [RECOMMENDATION, "recommendation", "entries[1].status_reason", "a drop with no reason",
    ["    status: undecided\n", "    status: dropped\n"]],
  [RECOMMENDATION, "recommendation", "ok", "a drop with the applicant's reason, out of the proposed set",
    ["    status: undecided\n    status_reason: null", "    status: dropped\n    status_reason: The applicant will name a mentor in the Department of Computation only."],
    ["  - researcher_key: example-institute-tomas-reyna\n    covers: Human fMRI of repeated exposure.\n", ""]],
  [RECOMMENDATION, "recommendation", "proposed[1].researcher_key", "a dropped host candidate still proposed",
    ["    status: undecided\n    status_reason: null", "    status: dropped\n    status_reason: The applicant will name a mentor in the Department of Computation only."]],
  [RECOMMENDATION, "recommendation", "proposed[1].researcher_key", "a proposed member who is not an entry",
    ["  - researcher_key: example-institute-tomas-reyna\n    covers:", "  - researcher_key: example-university-li-ming\n    covers:"]],
  [RECOMMENDATION, "recommendation", "entries[0].constraint_flags", "availability_stated_closed where the row states no closure",
    [/constraint_flags: \[\]/, "constraint_flags: [availability_stated_closed]"]],
  // A drop is a status, never an omission.
  [RECOMMENDATION, "recommendation", "entries", "a confirmed host candidate neither judged nor carried",
    ["carried:\n  - example-university-li-ming\n", "carried: []\n"]],
  // Judged although the summaries carried them. The entry is otherwise sound:
  // an unclear call on general knowledge alone cites nothing, and a row with
  // no contact address carries its flag.
  [RECOMMENDATION, "recommendation", "entries[2].researcher_key", "a judgement with no summary behind it",
    ["    status_reason: null\ncarried:\n  - example-university-li-ming\n", `    status_reason: null
  - researcher_key: example-university-li-ming
    name: 李明
    institution: Example University
    unit: 计算神经科学实验室
    fit: {value: unclear, evidence_basis: inferred, reasons: [No summary was read.], cites: []}
    host_strength: {value: unclear, evidence_basis: inferred, reasons: [No summary was read.], cites: []}
    constraint_flags: [no_published_contact_route]
    status: undecided
    status_reason: null
carried: []
`]],
  [RECOMMENDATION, "recommendation", "inputs.fellowship", "a fellowship record other than the one the pool was read against",
    ["  fellowship: examples/fellowship-valid.yml", "  fellowship: fellowships/example-institute-research-fellowship.example.yml"]],
  [RECOMMENDATION, "recommendation", "entries[0].name", "a label that disagrees with the row",
    ["    name: Mira Ostrander\n", "    name: M. Ostrander\n"]],
  [RECOMMENDATION, "recommendation", "entries[0].fit.reasons[0]", "Han script in a reason, which is the tool's own words and English",
    ["        - The group states it models learning", "        - 该组研究序列学习。The group states it models learning"]],
  [RECOMMENDATION, "recommendation", "budget.page_opens.used", "page opens over config.example.yml's cap",
    ["page_opens: {used: 0, cap: 120}", "page_opens: {used: 121, cap: 200}"]],

  // The personal-data boundary as code. The valid file's third row keeps a
  // name, a unit and a role title in Han script, as a page would publish them:
  // a sweep over the whole row would refuse it.
  [RESEARCHERS, "researchers", "ok", "as committed"],
  [RESEARCHERS, "researchers", "researchers[0].pronouns", "a key outside the closed set, which a page may publish and which is never recorded",
    ["    role_title: Associate Professor of Computation\n", "    role_title: Associate Professor of Computation\n    pronouns: she/her\n"]],
  [RESEARCHERS, "researchers", "researchers[1].availability.quote", "stated_open with no verbatim quote",
    ["      quote: The lab is looking for a postdoctoral fellow to start in 2027.\n", ""]],
  [RESEARCHERS, "researchers", "researchers[0].metrics[0].source", "a metric with no source",
    ["        source: OpenAlex\n", ""]],
  [RESEARCHERS, "researchers", "researchers[1].publications[0].source_url", "an accepted paper with no identifier and no page stating the acceptance",
    ["        source_url: https://lab.example.org/publications\n", ""]],
  [RESEARCHERS, "researchers", "researchers[1].research_statement.source_url", "a lab site fact with nothing saying an official page links to it",
    ["research\n      retrieved_at: '2026-09-23'\n      linked_from: https://www.example.edu/people/tomas-reyna\n",
      "research\n      retrieved_at: '2026-09-23'\n"]],
  [RESEARCHERS, "researchers", "researchers[1].research_statement.source_url", "a linked site the gate blocks, which is not read, linked or not",
    ["source_url: https://lab.example.org/research", "source_url: http://lab.example.org/research"]],
  [RESEARCHERS, "researchers", "researchers[0].contact.email", "a contact address at the lab's domain rather than the institution's",
    ["email: mira.ostrander@example.edu", "email: mira.ostrander@lab.example.org"]],
  [RESEARCHERS, "researchers", "researchers[0].contact.email", "a contact address at another institution's domain",
    ["email: mira.ostrander@example.edu", "email: mira.ostrander@example.ac.uk"]],
  [RESEARCHERS, "researchers", "researchers[0].official_url", "a row read from a page the gate blocks, here for its http scheme",
    ["    official_url: https://www.example.edu/people/mira-ostrander", "    official_url: http://www.example.edu/people/mira-ostrander"]],
  [RESEARCHERS, "researchers", "researchers[2].institution", "Han script in the institution's English name, which the script sweep reads",
    ["institution: Example University", "institution: 示例大学"]],
  [RESEARCHERS, "researchers", "researchers[0].publications[0].identifier", "a placeholder where a published paper's identifier belongs",
    ["identifier: 10.5555/example.2025.001", "identifier: pending"]],
  // The doi.org URL form is pinned by IDENTIFIERS_ACCEPTED below: a URL at
  // doi.org in a people fixture is what the example.* host pin below refuses.
  [RESEARCHERS, "researchers", "ok", "an identifier written with its doi: prefix",
    ["identifier: 10.5555/example.2025.001", "identifier: 'doi:10.5555/example.2025.001'"]],
  [RESEARCHERS, "researchers", "researchers[1].researcher_key", "two rows under one key",
    ["researcher_key: example-institute-tomas-reyna", "researcher_key: example-institute-mira-ostrander"]],

  ["registry/institutions.seed.yml", "institutions", "ok", "the shipped seed"],
  [SEED, "institutions", "ok", "as committed"],
  // An institution's name in its own script belongs in `aliases`, which the
  // English-script sweep does not read.
  [INSTITUTIONS, "institutions", "ok", "as committed, with an alias in Han script"],
  [SEED, "institutions", "source_version", "a seed with no source_version",
    ['source_version: "2026-09-22"\n\n', ""]],
  [INSTITUTIONS, "institutions", "institutions[0].official_domains[0]", "a bare public suffix as a domain",
    ['["riverton-college.example.org"]', '["ac.uk"]']],
  [INSTITUTIONS, "institutions", "institutions[1].official_domains[0]", "a second row claiming the first row's domain",
    [/  - name: [\s\S]*/, (row) => row + row.replace("Riverton College", "Second College")]],
  // A run writes a discovered row itself and the pool report lists it,
  // so the row says the agent vouched for it; it must say someone did.
  [INSTITUTIONS, "institutions", "ok", "a discovered row a run wrote",
    ["confirmed_by: applicant", "confirmed_by: agent"]],
  [INSTITUTIONS, "institutions", "institutions[0].confirmed_by", "a discovered row that says no one vouched for it",
    ["confirmed_by: applicant", "confirmed_by: null"]],
  [INSTITUTIONS, "institutions", "institutions[0].name", "Han script in the English name",
    ['name: "Riverton College"', 'name: "河流学院"']],
];

// The claim is banned, not the word. These two lists are
// the difference, and a change to knowledge/vocabulary.json that loses it fails
// here rather than in an applicant's report.
const BANNED = [
  "A world-leading group in this area.",
  "One of the top labs for this method.",
  "A prestigious institute.",
  "The journal's impact factor is high.",
  "They are likely to accept a fellow this year.",
  "The group probably has space.",
  "Seems to be recruiting postdocs.",
  "An approachable supervisor.",
  "Worth a try even so.",
];
const ALLOWED = [
  "An h-index of 42 in OpenAlex, read on 2026-09-22.",
  "Citation counts are recorded with the source that produced them.",
  "The index of staff on the department page lists the unit.",
  "The prestige of a venue is not a fact this tool records.",
  "Top-down models of cortical dynamics.",
  "Likely mechanisms of the transient response are the subject of the brief.",
  "The page gives no statement about availability, so it stays unknown.",
  "Leading authors on three of the five papers.",
];

// Every form an identifier is written in is one identifier, and the forms
// of one paper share a key, so a row and a summary that write it differently
// still join. Refused: a placeholder, a bare number, which names no scheme, and
// a DOI prefix too short to be one.
const IDENTIFIERS_ACCEPTED = [
  ["10.1038/s44220-025-00388-5", "doi:10.1038/s44220-025-00388-5"],
  ["doi:10.1038/S44220-025-00388-5", "doi:10.1038/s44220-025-00388-5"],
  ["DOI: 10.1038/s44220-025-00388-5", "doi:10.1038/s44220-025-00388-5"],
  ["https://doi.org/10.1038/s44220-025-00388-5", "doi:10.1038/s44220-025-00388-5"],
  ["https://dx.doi.org/10.1073/pnas.2318641121", "doi:10.1073/pnas.2318641121"],
  ["2308.01175", "arxiv:2308.01175"],
  ["arXiv:2308.01175v2", "arxiv:2308.01175"],
  ["https://arxiv.org/abs/2308.01175", "arxiv:2308.01175"],
  ["https://arxiv.org/pdf/2308.01175v1.pdf", "arxiv:2308.01175"],
  ["hep-th/9901001", "arxiv:hep-th/9901001"],
  ["PMID: 38012345", "pmid:38012345"],
  ["https://pubmed.ncbi.nlm.nih.gov/38012345/", "pmid:38012345"],
  ["W4389012345", "openalex:W4389012345"],
  ["https://openalex.org/W4389012345", "openalex:W4389012345"],
];
const IDENTIFIERS_REFUSED = ["unknown", "n/a", "tbd", "pending", "-", "38012345", "2024", "10.123/x", "doi:", "arXiv:1234.123", "W"];

// Rules a fixture cannot exercise. Five are about where a file sits: a record
// under examples/ is named as a fixture, not for the id it carries, and it sits
// in no workspace or fellowship folder, and no fixture may sit in one. Two are about a file that is missing: a report and its
// machine record stand or fall together, and since no fixture may lack
// its other half, each probe hands the guard a committed file that has none --
// brief-valid.md has no record beside it, and researchers-valid.yml no report.
// Two need a row no fixture holds, since editing one file cannot change the row
// another file joins: a flag the row settles is required as well as refused.
const CONTEXT_RULES = [
  ["a fellowship record's id is its filename", () => {
    const data = loadYamlFile(path.join(repoRoot, FELLOWSHIP), "fixture");
    const findings = validateFellowship(data, { label: "fixture", fileId: "some-other-name" });
    return findings.problems.some((problem) => problem.field === "fellowship_id");
  }],
  ["a matching filename raises nothing", () => {
    const data = loadYamlFile(path.join(repoRoot, FELLOWSHIP), "fixture");
    const findings = validateFellowship(data, { label: "fixture", fileId: "example-institute-research-fellowship" });
    return !findings.problems.some((problem) => problem.field === "fellowship_id");
  }],
  // A fellowship folder is named for its record's id. The path is judged
  // as written and nothing is opened at it, so no workspace has to exist.
  ["a fellowship folder with no record of its id is refused", () => {
    const result = validateFile("brief", path.join(repoRoot, "applicants", "example-applicant", "no-such-fellowship", "brief.md"));
    return result.problems.some((problem) => problem.field === "(folder)");
  }],
  // Two fellowships run on one day once wrote one `{date}-pool.md`. Same-day
  // pools in two folders pair with two records, each in its own folder,
  // whichever half is handed over.
  ["same-day pools in two fellowship folders pair with two records", () => {
    const pool = REPORT_KINDS.find((entry) => entry.kind === "pool");
    const pairs = ["first-fellowship", "second-fellowship"].map((id) => {
      const report = path.join(repoRoot, "applicants", "example-applicant", id, "pool", "2026-09-23-pool.md");
      const fromReport = reportPair(pool, report, workspaceForPath(report));
      const fromRecord = reportPair(pool, fromReport.record, workspaceForPath(fromReport.record));
      return { id, ...fromReport, same: fromRecord.workspace && fromRecord.report === fromReport.report };
    });
    return pairs.every((pair) => pair.workspace && pair.same
      && pair.record === path.join(repoRoot, "applicants", "example-applicant", pair.id, "machine", "2026-09-23-pool.yml"))
      && pairs[0].record !== pairs[1].record;
  }],
  ["a profile's applicant_id is its workspace directory", () => {
    const data = loadYamlFile(path.join(repoRoot, PROFILE), "fixture");
    const findings = validateProfile(data, { label: "fixture", applicantId: "someone-else" });
    return findings.problems.some((problem) => problem.field === "applicant_id");
  }],
  ["a report with no machine record is refused", () => {
    const result = validateFile("pool", path.join(repoRoot, BRIEF));
    return result.problems.some((problem) => problem.field === "(file)" && /brief-valid\.yml does not exist/.test(problem.message));
  }],
  ["a machine record with no report is refused", () => {
    const result = validateFile("pool", path.join(repoRoot, RESEARCHERS));
    return result.problems.some((problem) => problem.field === "(file)" && /researchers-valid\.md does not exist/.test(problem.message));
  }],
  ["a row stating closure requires availability_stated_closed", () => flagRequired((row) => {
    row.availability = { value: "stated_closed", quote: "The lab is not taking fellows.", source_url: row.official_url, retrieved_at: row.retrieved_at };
  }, /availability_stated_closed/)],
  ["a row with no contact address requires no_published_contact_route", () => flagRequired((row) => {
    delete row.contact;
  }, /no_published_contact_route/)],
];

// The valid recommendation read against its own inputs, with the first row
// changed in memory: the first entry's empty flag list must be refused.
function flagRequired(change, message) {
  const block = loadYamlFile(path.join(repoRoot, RECOMMENDATION), "fixture");
  const rows = loadYamlFile(path.join(repoRoot, RESEARCHERS), "fixture").researchers;
  change(rows[0]);
  const read = (file) => loadYamlFile(path.join(repoRoot, file), file);
  const findings = validateRecommendation(block, { label: "fixture", researchers: rows, pool: read(POOL), summaries: read(SUMMARIES) });
  return findings.problems.some((problem) => problem.field === "entries[0].constraint_flags" && message.test(problem.message));
}

// A fixture shaped like a researcher row, a pool, a summary or a
// recommendation holds invented people only. A real row cites a real page, so
// every URL and every address in these files must sit under an example.* host;
// a real person pasted in fails here.
// Read by filename rather than from CASES, so a fixture nobody listed is
// checked too, and every edited case over one of them is checked the same way.
const PEOPLE_FIXTURE = /^(researchers|pool|summaries|recommendation)-.*\.(yml|md)$/;
// A report's machine record may cite no page, since it names rows and fields
// and the report beside it links the pages; every other people fixture must
// cite one, or the pin passes on nothing.
const REPORT_RECORD = /^(pool|summaries|recommendation)-.*\.yml$/;

function assertInventedHosts(label, text, name) {
  const hosts = [
    ...[...text.matchAll(/\bhttps?:\/\/([^/\s'"<>)]+)/g)].map((match) => match[1]),
    ...[...text.matchAll(/[^\s@'"<>(]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g)].map((match) => match[1]),
  ];
  assert(hosts.length > 0 || REPORT_RECORD.test(name), `${label} cites no page; a people fixture that cites nothing pins nothing`);
  for (const host of hosts) {
    assert(registrableLabel(host) === "example",
      `${label} cites ${host}, which is not an example.* host; people fixtures hold invented people only`);
  }
}

// Each edit must match where it says it does, so a fixture that drifts under
// its edits fails loudly rather than leaving the case testing the valid file.
function applyEdits(text, edits, label) {
  for (const [find, replace] of edits) {
    const count = typeof find === "string"
      ? text.split(find).length - 1
      : (text.match(new RegExp(find.source, find.flags.includes("g") ? find.flags : `${find.flags}g`)) || []).length;
    assert(typeof find === "string" ? count === 1 : count > 0,
      `${label}: the edit ${typeof find === "string" ? JSON.stringify(find) : find} matches ${count} times; a string edit matches exactly once, a pattern at least once`);
    text = text.replace(find, typeof replace === "function" ? replace : () => replace);
  }
  return text;
}

function main() {
  let checked = 0;
  const dir = path.join(repoRoot, "examples");
  for (const name of fs.readdirSync(dir).filter((file) => PEOPLE_FIXTURE.test(file))) {
    assertInventedHosts(`examples/${name}`, fs.readFileSync(path.join(dir, name), "utf8"), name);
    checked += 1;
  }
  for (const text of BANNED) {
    assert(bannedPhrasesIn(text).length > 0, `banned language not caught: ${text}`);
    checked += 1;
  }
  for (const text of ALLOWED) {
    const hits = bannedPhrasesIn(text);
    assert(hits.length === 0, `ordinary wording rejected as banned language: ${text} (matched ${hits.join(", ")})`);
    checked += 1;
  }

  for (const [written, key] of IDENTIFIERS_ACCEPTED) {
    const parsed = parseIdentifier(written);
    assert(parsed && parsed.key === key, `identifier ${JSON.stringify(written)} must parse to ${key} (got ${parsed ? parsed.key : "nothing"})`);
    checked += 1;
  }
  for (const written of IDENTIFIERS_REFUSED) {
    assert(parseIdentifier(written) === null, `${JSON.stringify(written)} is not an identifier and must not parse as one`);
    checked += 1;
  }

  for (const [label, check] of CONTEXT_RULES) {
    assert(check() === true, `context rule: ${label}`);
    checked += 1;
  }

  for (const [relPath, kind, expectation, what, ...edits] of CASES) {
    const label = `${relPath} (${what})`;
    const options = {};
    if (edits.length > 0) {
      options.text = applyEdits(fs.readFileSync(path.join(repoRoot, relPath), "utf8"), edits, label);
      if (PEOPLE_FIXTURE.test(path.basename(relPath))) assertInventedHosts(label, options.text, path.basename(relPath));
    }
    const result = validateFile(kind, path.join(repoRoot, relPath), options);
    if (expectation === "ok") {
      assert(result.ok, `${label} must validate as ${kind} but reported: ${format(result)}`);
    } else {
      assert(!result.ok, `${label} must fail as ${kind} on field "${expectation}" but validated clean`);
      const fields = result.problems.map((problem) => problem.field);
      assert(fields.includes(expectation), `${label} must report a problem on field "${expectation}"; got ${fields.join(", ") || "none"}`);
      for (const problem of result.problems) {
        assert(typeof problem.message === "string" && problem.message.trim() !== "", `${label}: problem on ${problem.field} carries no message`);
      }
    }
    checked += 1;
  }
  const kinds = [...new Set(CASES.map(([, kind]) => kind))].join(", ");
  const files = new Set(CASES.map(([relPath]) => relPath)).size;
  console.log(`validate verifies (${checked} checks: ${CASES.length} cases over ${files} files across ${kinds}, ${BANNED.length + ALLOWED.length} banned-language cases, ${IDENTIFIERS_ACCEPTED.length + IDENTIFIERS_REFUSED.length} identifier forms, ${CONTEXT_RULES.length} context rules)`);
}

function format(result) {
  return result.problems.map((problem) => `${problem.field}: ${problem.message}`).join("; ");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`verify:validate failed: ${message}`);
    process.exit(1);
  }
}

main();
