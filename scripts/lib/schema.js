// What a fellowship record, an applicant profile, a project brief, a pool
// report, a summaries report, a recommendation report, the researcher registry
// and an institution registry file must look like.
//
// Every controlled value comes from `knowledge/vocabulary.json`; nothing here
// restates a vocabulary in code, so the vocabulary file stays the single place
// a value is added. These functions reject; they never rewrite. A rejection
// names the field, because the agent has to fix the file it authored.
//
// They check structure and joins, not wording. Whether a brief says
// enough, or a title copied from a page sounds promotional, is the agent's call
// with the applicant reading the result; a check that can reject correct output
// is a bug.
const fs = require("fs");
const path = require("path");
const { REPO_ROOT } = require("./workspace");
const { findNonEnglishScriptDeep, nonEnglishScriptReason } = require("./language");
const { gateUrl, isBarePublicSuffix, normalizeHost, registrableDomain } = require("./gate");
const { IDENTIFIER_FORMS, parseIdentifier } = require("./identifiers");

const vocabulary = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "knowledge", "vocabulary.json"), "utf8"));
const BRIEF_EXAMPLE_PATH = path.join(REPO_ROOT, "applicants", "brief.example.md");

// The kinds `validate` understands today. `doctor` reads this to say which
// modes are built: a mode whose kind is missing here is shown as not built yet.
const SUPPORTED_KINDS = ["fellowship", "profile", "brief", "pool", "summaries", "recommendation", "researchers", "institutions"];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const KEY_ORDER = {
  institution: ["name", "country", "aliases", "official_domains", "ror_id", "source", "retrieved_at", "confirmed_by"],
};

// The keys each kind writes in the tool's own words rather than copying from a
// page. The banned-phrase scan and the English-script sweep read these and
// nothing else. An allow-list on purpose: a field that carries a page's own
// words -- a rule's quote, a published list's title, the fellowship's own
// name, an institution's alias in its own script -- is skipped because it is
// not listed, not because someone remembered to exempt it. A guard that
// rejected a page's wording would push the agent into paraphrasing a source,
// which principle 7 forbids. A new kind declares its list.
//
// A researcher row has no prose, so no banned-phrase scan reads it; the script
// sweep reads the institution's English name and the metric fields, and never
// a person's name, unit or role title, which keep the page's form in any
// script. A pool's machine record names people and units as their pages print
// them, so both scans read its reasons, notes and gaps and nothing else. A
// summaries record holds the labels, the citations -- an accepted paper's title
// among them, in the page's words -- and the gaps, and only the gaps are the
// tool's. A recommendation record adds the reasons on each axis and the
// applicant's drop reason, both in the tool's words.
const VOICE_KEYS = {
  fellowship: ["rule", "note"],
  pool: ["why", "kept_because", "scope_notes", "note", "reason", "gaps"],
  summaries: ["gaps"],
  recommendation: ["reasons", "status_reason", "covers", "gaps"],
  researchers: ["institution", "metrics"],
  institutions: ["name", "country"],
};

class Findings {
  constructor(label) {
    this.label = label;
    this.problems = [];
    this.notes = [];
  }
  problem(field, message) {
    this.problems.push({ field, message });
    return false;
  }
  note(field, message) {
    this.notes.push({ field, message });
  }
  get ok() {
    return this.problems.length === 0;
  }
}

function isMapping(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFilledString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function requireStringList(findings, value, field) {
  if (!Array.isArray(value) || value.length === 0) {
    return findings.problem(field, "must be a non-empty list");
  }
  let ok = true;
  value.forEach((item, index) => {
    if (!isFilledString(item)) ok = findings.problem(`${field}[${index}]`, "must be a non-empty string");
  });
  return ok;
}

// What a message says a field held: "(missing)" rather than "(found
// undefined)" when the key is absent.
function found(value) {
  return value === undefined ? " (missing)" : ` (found ${JSON.stringify(value)})`;
}

function requireEnum(findings, value, field, allowed) {
  if (!allowed.includes(value)) {
    return findings.problem(field, `must be one of ${allowed.join(", ")}${found(value)}`);
  }
  return true;
}

function requireDate(findings, value, field) {
  if (!DATE.test(String(value || ""))) {
    return findings.problem(field, `must be a written YYYY-MM-DD date${found(value)}`);
  }
  return true;
}

// An identifier's shape, in any form it is written in. A present identifier
// that is not one is refused whatever the status, because a placeholder in the
// field reads as a citation that nothing can open.
function requireIdentifier(findings, value, field) {
  if (parseIdentifier(value)) return true;
  return findings.problem(field, `${JSON.stringify(value)} is not ${IDENTIFIER_FORMS}`);
}

// Banned language in one string, from `knowledge/vocabulary.json`
// banned_phrases. Matched on a word boundary so `impact factor` is caught and
// `impact` is not.
function bannedPhrasesIn(text) {
  return vocabulary.banned_phrases.filter((phrase) => phraseRegex(phrase).test(text));
}

const phraseCache = new Map();
function phraseRegex(phrase) {
  if (!phraseCache.has(phrase)) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const left = /^[\p{L}\p{N}]/u.test(phrase) ? "(?<![\\p{L}\\p{N}])" : "";
    const right = /[\p{L}\p{N}]$/u.test(phrase) ? "(?![\\p{L}\\p{N}])" : "";
    phraseCache.set(phrase, new RegExp(`${left}${escaped}${right}`, "iu"));
  }
  return phraseCache.get(phrase);
}

// Every string under one of `keys`, at any depth, with its dotted path.
function voiceStrings(value, keys, at = "", inVoice = false, out = []) {
  if (typeof value === "string") {
    if (inVoice) out.push({ at, text: value });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => voiceStrings(item, keys, `${at}[${index}]`, inVoice, out));
  } else if (isMapping(value)) {
    for (const [key, item] of Object.entries(value)) {
      voiceStrings(item, keys, at ? `${at}.${key}` : key, inVoice || keys.includes(key), out);
    }
  }
  return out;
}

function reportBannedPhrases(findings, value, keys) {
  for (const { at, text } of voiceStrings(value, keys)) {
    for (const phrase of bannedPhrasesIn(text)) {
      findings.problem(at, `contains banned language "${phrase}"; it is an unsourced reputation claim or a guess about a person, and neither is a fact this tool records (AGENTS.md principles 4 and 5)`);
    }
  }
}

// A fellowship's own page: the record's `official_url`, each rule's, each
// published list's. The one thing refused is a page the gate blocks -- not
// https, a directory, an aggregator, a ranking site, a search wrapper -- because
// recording a fellowship's host rules off one of those is the hazard. The
// gate's other two verdicts answer whether a page may supply a fact about a
// *person*, which a fellowship's own page is not asked to do, so
// `needs_registry_row` passes: HFSP, Wellcome, EMBO and the EU sit under no
// academic registry and in no seed row, and a registry of institutions has no
// row for a funder. `blocked` is decided before the gate
// reads a registry, so none is passed and the record stands on neither half.
// The full gate, `requirePersonPage`, is for the pages a person's facts are
// read from.
function requireFellowshipUrl(findings, value, field) {
  if (!isFilledString(value)) {
    return findings.problem(field, "required; a fact carries the page it was read from");
  }
  const result = gateUrl(value);
  if (result.verdict === "blocked") {
    return findings.problem(field, `the gate blocks this page: ${result.reason}`);
  }
  for (const warning of result.warnings) {
    findings.note(field, `${warning.code}: ${warning.message}`);
  }
  return true;
}

// ------------------------------------------------------------- fellowship ---

// What this fellowship asks of a host, rule by rule, each rule carrying the
// page it was read from and that page's own words.
//
// The two-field rule entry -- `rule` in the tool's plain words, `quote`
// verbatim -- is principle 7 at the source: a paraphrase can be checked against
// the quote beside it, and a reader's check of this record against the
// fellowship's pages is a comparison rather than a search.
function validateFellowship(data, context = {}) {
  const findings = new Findings(context.label);
  if (!isMapping(data)) {
    findings.problem("(root)", "a fellowship record must parse to a mapping");
    return findings;
  }

  if (!isFilledString(data.fellowship_id)) {
    findings.problem("fellowship_id", "required");
  } else if (!/^[a-z0-9][a-z0-9-]*$/.test(data.fellowship_id)) {
    findings.problem("fellowship_id", `must be a lowercase path-safe id${found(data.fellowship_id)}`);
  } else if (context.fileId && data.fellowship_id !== context.fileId) {
    findings.problem("fellowship_id", `is ${data.fellowship_id} but the file is named ${context.fileId}.yml`);
  }

  for (const key of ["name", "host_institution"]) {
    if (!isFilledString(data[key])) findings.problem(key, "required");
  }
  requireFellowshipUrl(findings, data.official_url, "official_url");
  requireDate(findings, data.retrieved_at, "retrieved_at");

  const requirement = data.host_requirement;
  requireEnum(findings, requirement, "host_requirement", vocabulary.fellowship.host_requirement);

  // `none` means the fellowship has no host component, so there is nobody to
  // look for and nothing to record about one. The other two carry the same
  // fields: a fellowship that lets the applicant choose a mentor needs the same
  // three answers as one that will not accept an application without a
  // signature (AGENTS.md -> What this project is).
  if (requirement === "none") {
    for (const key of ["host_relationship_term", "host_lists", "host_rules"]) {
      if (data[key] !== undefined) {
        findings.problem(key, "must be absent when host_requirement is none; there is no host component to describe");
      }
    }
    reportBannedPhrases(findings, data, VOICE_KEYS.fellowship);
    return findings;
  }

  if (!isFilledString(data.host_relationship_term)) {
    findings.problem("host_relationship_term", "required; the fellowship's own word for the relationship -- mentor, host, sponsor, supervisor, affiliation -- as its page writes it");
  }

  validateHostLists(findings, data.host_lists);

  if (!Array.isArray(data.host_rules) || data.host_rules.length === 0) {
    findings.problem("host_rules", "required and non-empty; a fellowship that asks anything of a host says so somewhere, and a record with no rule bounds no pool");
  } else {
    data.host_rules.forEach((rule, index) => {
      const at = `host_rules[${index}]`;
      if (!isMapping(rule)) {
        findings.problem(at, "must be a mapping with rule, quote, official_url and retrieved_at");
        return;
      }
      if (!isFilledString(rule.rule)) {
        findings.problem(`${at}.rule`, "required; what the rule means for this applicant, in plain words");
      }
      if (!isFilledString(rule.quote)) {
        findings.problem(`${at}.quote`, "required; the page's own words, verbatim. The paraphrase above it is checkable only against this");
      }
      requireFellowshipUrl(findings, rule.official_url, `${at}.official_url`);
      requireDate(findings, rule.retrieved_at, `${at}.retrieved_at`);
      for (const key of Object.keys(rule)) {
        if (!["rule", "quote", "official_url", "retrieved_at"].includes(key)) {
          findings.problem(`${at}.${key}`, "is not a host-rule field; the set is rule, quote, official_url, retrieved_at");
        }
      }
    });
  }

  reportBannedPhrases(findings, data, VOICE_KEYS.fellowship);
  return findings;
}

// A published list of eligible hosts, where the fellowship publishes one.
//
// `bounds_pool` exists because a fellowship's rule can be an OR. The Kempner
// Institute's names "current faculty associated with the Kempner Institute OR
// working on machine learning, artificial intelligence, or computational
// neurobiology at Harvard University", and the three lists it publishes are one
// branch of that OR, so reading them and stopping would miss everyone in the
// other branch. A list bounds the pool only when the rules say it does, and the
// record has to carry which, because `list` cannot read it back off a URL.
function validateHostLists(findings, lists) {
  if (lists === undefined) return;
  if (!Array.isArray(lists)) {
    return findings.problem("host_lists", "must be a list of published host lists, or absent where the fellowship publishes none");
  }
  if (lists.length === 0) {
    return findings.problem("host_lists", "is empty; omit the key where the fellowship publishes no list of eligible hosts");
  }
  lists.forEach((entry, index) => {
    const at = `host_lists[${index}]`;
    if (!isMapping(entry)) {
      return findings.problem(at, "must be a mapping with name, official_url, retrieved_at and bounds_pool");
    }
    if (!isFilledString(entry.name)) {
      findings.problem(`${at}.name`, "required; the list's own title on the page, so the report can say which one it read");
    }
    requireFellowshipUrl(findings, entry.official_url, `${at}.official_url`);
    requireDate(findings, entry.retrieved_at, `${at}.retrieved_at`);
    if (typeof entry.bounds_pool !== "boolean") {
      findings.problem(`${at}.bounds_pool`, "required; true when the host rules make this list the whole of who may host, false when it is one branch among others");
    } else if (entry.bounds_pool === false && !isFilledString(entry.note)) {
      findings.problem(`${at}.note`, "required when bounds_pool is false; say which rule leaves people off this list, or a later run will read the list and stop");
    }
    for (const key of Object.keys(entry)) {
      if (!["name", "official_url", "retrieved_at", "bounds_pool", "note"].includes(key)) {
        findings.problem(`${at}.${key}`, "is not a host-list field; the set is name, official_url, retrieved_at, bounds_pool, note");
      }
    }
  });
}

// ---------------------------------------------------------------- profile ---

// What each optional profile field costs a later mode when it is absent, said
// as a note rather than a problem: an applicant with a paragraph can start, and
// the reports' Gaps say the same thing where it bites.
const PROFILE_OPTIONAL = {
  current_position: "recommend cannot raise career_stage where a host rule turns on the applicant's current post",
  current_institution: "recommend cannot raise career_stage where a host rule turns on the applicant's own institution, such as one barring the PhD supervisor",
  country_of_work: "recommend cannot raise mobility_rule",
  degrees: "recommend cannot raise career_stage where a host rule turns on the applicant's degrees",
  publications: "summarize and recommend cannot say what of a host candidate's record touches the applicant's own papers",
  methods: "recommend reads the applicant's own methods from the brief alone",
  constraints: "recommend cannot raise language_of_work or a flag for any other constraint",
};

// The applicant's own record, serving every fellowship they apply to. It holds
// no facts about anyone else: a host candidate lives in
// registry/researchers.yml under the closed field set and never here.
//
// Three fields are required, because they are what `list` needs to start; the
// rest are noted when absent.
function validateProfile(data, context = {}) {
  const findings = new Findings(context.label);
  if (!isMapping(data)) {
    findings.problem("(root)", "a profile must parse to a mapping");
    return findings;
  }

  if (!isFilledString(data.applicant_id)) {
    findings.problem("applicant_id", "required");
  } else if (context.applicantId && data.applicant_id !== context.applicantId) {
    findings.problem("applicant_id", `is ${data.applicant_id} but the profile sits in applicants/${context.applicantId}/`);
  }

  // The fellowship an application answers is the folder it sits in. A
  // key left from the older one-fellowship layout would name a second join that
  // can disagree with the path, so it is refused, with where its files go.
  if (data.fellowship !== undefined) {
    const id = isFilledString(data.fellowship) ? data.fellowship : "<fellowship-id>";
    const workspace = `applicants/${context.applicantId || data.applicant_id || "<id>"}`;
    findings.problem("fellowship", `a profile serves every fellowship and names none; move brief.md, pool/, summaries/, recommendations/ and machine/ into ${workspace}/${id}/, then delete this key`);
  }

  for (const key of ["field", "career_stage"]) {
    if (!isFilledString(data[key])) findings.problem(key, "required; brief drafts it from the question or a CV where the applicant does not say it");
  }
  for (const key of ["current_position", "current_institution", "country_of_work"]) {
    if (data[key] === undefined || data[key] === null) findings.note(key, `absent; ${PROFILE_OPTIONAL[key]}`);
    else if (!isFilledString(data[key])) findings.problem(key, "must be a non-empty string when present; unknown or none is an answer where it is the true one");
  }

  if (data.degrees === undefined || data.degrees === null) {
    findings.note("degrees", `absent; ${PROFILE_OPTIONAL.degrees}`);
  } else if (!Array.isArray(data.degrees) || data.degrees.length === 0) {
    findings.problem("degrees", "must be a non-empty list when present; leave the key out where there is nothing to list");
  } else {
    data.degrees.forEach((degree, index) => {
      const at = `degrees[${index}]`;
      if (!isMapping(degree)) return findings.problem(at, "must be a mapping");
      for (const key of ["degree", "subject", "institution", "status"]) {
        if (!isFilledString(degree[key])) findings.problem(`${at}.${key}`, "required");
      }
    });
  }

  // Identifiers are carried here for the same reason they are required of a
  // host candidate's: a claim about what someone published cites the record it
  // came from (AGENTS.md principle 3). Each is held to an identifier's shape in
  // any of the forms it is written in (`identifiers.js`).
  //
  // `status: accepted` is the one case that may carry no identifier, because a
  // venue can accept a paper months before it issues a record for it. Here the
  // applicant is self-reporting their own work and owns the claim, so the
  // absence needs nothing beside it but a note, because nothing downstream may
  // cite it. A host candidate's row takes the same three values and a stricter
  // rule -- the official page that says so, with its date, in place of the
  // identifier -- because there the tool is asserting something about a
  // stranger who did not write it.
  if (data.publications !== undefined) {
    if (!Array.isArray(data.publications)) {
      findings.problem("publications", "must be a list (empty when there are none)");
    } else {
      data.publications.forEach((entry, index) => {
        const at = `publications[${index}]`;
        if (!isMapping(entry)) return findings.problem(at, "must be a mapping");
        for (const key of ["title", "venue", "year", "authorship"]) {
          if (!isFilledString(String(entry[key] ?? ""))) findings.problem(`${at}.${key}`, "required");
        }
        requireEnum(findings, entry.status, `${at}.status`, vocabulary.publications.status);
        if (isFilledString(String(entry.identifier ?? ""))) {
          requireIdentifier(findings, entry.identifier, `${at}.identifier`);
        } else if (entry.status === "accepted") {
          findings.note(`${at}.identifier`, `absent; "${entry.venue}" has accepted this and issued no record for it yet, so nothing may cite it until it does`);
        } else {
          findings.problem(`${at}.identifier`, "required unless status is accepted; a claim about what someone published carries a DOI, an arXiv id, a PMID or an OpenAlex id");
        }
      });
    }
  } else {
    findings.note("publications", `absent; ${PROFILE_OPTIONAL.publications}`);
  }

  if (data.methods === undefined) findings.note("methods", `absent; ${PROFILE_OPTIONAL.methods}`);
  else requireStringList(findings, data.methods, "methods");
  if (data.constraints === undefined) {
    findings.note("constraints", `absent; ${PROFILE_OPTIONAL.constraints}`);
  } else if (!isMapping(data.constraints)) {
    findings.problem("constraints", "must be a mapping; each entry becomes a constraint flag in a recommendation rather than a filter that silently removes a host candidate");
  }

  return findings;
}

// ------------------------------------------------------------------ brief ---

// The project the applicant is proposing, in their own words and their own
// language. Its prose is theirs: `recommend` judges `fit` against the whole of
// it, and whether it says enough is the applicant's call, not a character count
// -- a complete brief in Chinese, one sentence a section, is a few dozen
// characters. So two checks. It has prose at all, because an
// empty file is never a brief. And no whole paragraph of it is still the
// shipped example's, read from `applicants/brief.example.md` at validate time so
// that rewording the example moves the check with it.
function validateBrief(text, context = {}) {
  const findings = new Findings(context.label);
  const paragraphs = proseParagraphs(text);
  if (paragraphs.length === 0) {
    findings.problem("(file)", "carries no prose outside its headings; the brief is the applicant's own words about their project");
  }
  const example = new Set(fs.existsSync(BRIEF_EXAMPLE_PATH) ? proseParagraphs(fs.readFileSync(BRIEF_EXAMPLE_PATH, "utf8")) : []);
  const copied = paragraphs.filter((paragraph) => example.has(paragraph));
  if (copied.length > 0) {
    findings.problem("(file)", `still carries ${copied.length} paragraph${copied.length === 1 ? "" : "s"} of applicants/brief.example.md word for word, starting "${copied[0].slice(0, 60)}"; the example is a shape to copy, not a brief`);
  }
  return findings;
}

// Blank-line-separated paragraphs with heading lines dropped and whitespace
// collapsed, so rewrapping a copied paragraph does not hide it.
function proseParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").filter((line) => !/^\s*#/.test(line)).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

// ------------------------------------------------------------ researchers ---

// The facts layer: one row per potential host a run confirmed, and the one file
// in this repository that holds personal data about people who did not agree
// to be catalogued. Every key set below is closed, because the personal-data
// boundary is structural or it is nothing (AGENTS.md -> Personal Data): a run
// that found something interesting about a person cannot add a field to keep
// it, and a key outside these lists is refused rather than ignored.
//
// Every fact names the page it was read from. The row's own `official_url`
// supplied the name, institution, unit and role title; each other fact carries
// its own `source_url` and date, because a research statement, a contact
// address and an accepted paper are often on three different pages.
const RESEARCHER_KEYS = [
  "researcher_key", "name", "institution", "unit", "role_title", "official_url", "retrieved_at",
  "research_statement", "contact", "availability", "publications", "metrics",
];
const SOURCED_KEYS = ["source_url", "retrieved_at", "linked_from"];
const RESEARCHER_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/;

// A page a person's facts are read from, through the full gate. Unlike a
// fellowship's own page, `needs_registry_row` refuses here: the question the
// gate was built to answer is exactly whether this page may say who someone is
// and where they work. Warnings never lower the verdict; they say the address
// alone does not settle it, so they are notes for the agent to act on.
function requirePersonPage(findings, value, field, context, institution, hint = "") {
  if (!isFilledString(value)) {
    return findings.problem(field, "required; a fact about a person carries the page it was read from");
  }
  const result = gateUrl(value, { institution, registry: context.registry || [] });
  if (result.verdict !== "official") {
    findings.problem(field, `the gate reads this page as ${result.verdict}: ${result.reason}${result.verdict === "needs_registry_row" ? hint : ""}`);
    return null;
  }
  for (const warning of result.warnings) findings.note(field, `${warning.code}: ${warning.message}`);
  return result;
}

function validateResearchers(data, context = {}) {
  const findings = new Findings(context.label);
  if (!isMapping(data)) {
    findings.problem("(root)", "must parse to a mapping with a researchers list");
    return findings;
  }
  for (const key of Object.keys(data)) {
    if (key !== "researchers") findings.problem(key, "is not a key of the researcher registry; the file holds a researchers list and nothing else");
  }
  if (!Array.isArray(data.researchers)) {
    findings.problem("researchers", "must be a list of researcher rows (empty when no run has confirmed anyone)");
    return findings;
  }
  const seen = new Map();
  data.researchers.forEach((row, index) => {
    const at = `researchers[${index}]`;
    if (!isMapping(row)) return findings.problem(at, "must be a mapping");
    validateResearcherRow(findings, row, at, context);
    if (isFilledString(row.researcher_key)) {
      if (seen.has(row.researcher_key)) findings.problem(`${at}.researcher_key`, `duplicates researchers[${seen.get(row.researcher_key)}]; one row per person`);
      else seen.set(row.researcher_key, index);
    }
  });
  for (const { at, text } of voiceStrings(data, VOICE_KEYS.researchers)) {
    const script = findNonEnglishScriptDeep(text, at);
    if (script) findings.problem(script.path, nonEnglishScriptReason(script));
  }
  return findings;
}

function validateResearcherRow(findings, row, at, context) {
  for (const key of Object.keys(row)) {
    if (!RESEARCHER_KEYS.includes(key)) {
      findings.problem(`${at}.${key}`, `is not in the closed researcher field set (${RESEARCHER_KEYS.join(", ")}); AGENTS.md -> Personal Data is the whole of what may be recorded about a person, and a field outside it is not kept anywhere`);
    }
  }
  if (!isFilledString(row.researcher_key)) {
    findings.problem(`${at}.researcher_key`, "required; the key every layer above this one names the row by");
  } else if (!RESEARCHER_KEY.test(row.researcher_key)) {
    findings.problem(`${at}.researcher_key`, `must be lowercase letters, digits and single hyphens${found(row.researcher_key)}`);
  }
  // The page's own form, in any script: a name, a unit and a role title are
  // never translated (AGENTS.md -> Language), so none of these is swept.
  for (const key of ["name", "unit", "role_title"]) {
    if (!isFilledString(row[key])) findings.problem(`${at}.${key}`, "required, as the page publishes it");
  }
  if (!isFilledString(row.institution)) findings.problem(`${at}.institution`, "required; the institution's English name");
  const page = requirePersonPage(findings, row.official_url, `${at}.official_url`, context, row.institution);
  requireDate(findings, row.retrieved_at, `${at}.retrieved_at`);

  if (row.research_statement === undefined) {
    findings.note(`${at}.research_statement`, "absent; summarize and recommend have no statement of what the group works on to cite");
  } else if (requireSourced(findings, row.research_statement, `${at}.research_statement`, ["quote"], context, row.institution)) {
    if (!isFilledString(row.research_statement.quote)) {
      findings.problem(`${at}.research_statement.quote`, "required; what the group states it works on, in the page's own words");
    }
  }

  if (row.contact === undefined) {
    findings.note(`${at}.contact`, "absent; recommend flags a host candidate with no published contact route");
  } else if (requireSourced(findings, row.contact, `${at}.contact`, ["email"], context, row.institution)) {
    validateContact(findings, row.contact, `${at}.contact`, page, context, row.institution);
  }

  validateAvailability(findings, row.availability, `${at}.availability`, context, row.institution);
  validateResearcherPublications(findings, row.publications, `${at}.publications`, context, row.institution);
  validateMetrics(findings, row.metrics, `${at}.metrics`);
}

// A fact with its own page: `source_url`, the date, and `linked_from` when the
// page is a lab or personal site rather than the institution's. The
// guard sees the link chain -- the linking page is official and the site is
// not blocked -- and not whether the official pages lacked the field, which is
// the mode's rule and the applicant's to read. Returns false when the value
// is not a mapping, so the caller skips its own checks.
function requireSourced(findings, value, at, ownKeys, context, institution) {
  if (!isMapping(value)) {
    findings.problem(at, `must be a mapping with ${[...ownKeys, "source_url", "retrieved_at"].join(", ")}`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (![...ownKeys, ...SOURCED_KEYS].includes(key)) {
      findings.problem(`${at}.${key}`, `is not a field here; the set is ${[...ownKeys, ...SOURCED_KEYS].join(", ")}`);
    }
  }
  requireSourceUrl(findings, value, at, context, institution);
  requireDate(findings, value.retrieved_at, `${at}.retrieved_at`);
  return true;
}

// `urlKey` names the page's field: `source_url` on a row's fact, `page_url` on
// a pool entry that has no row.
function requireSourceUrl(findings, value, at, context, institution, urlKey = "source_url") {
  if (value.linked_from === undefined) {
    requirePersonPage(findings, value[urlKey], `${at}.${urlKey}`, context, institution,
      ". If this is a lab or personal site an official page links to for this person, record that page as linked_from instead; a lab's domain never gets a registry row");
    return;
  }
  // A linked site: the linking page is what says whose site it is, so it is
  // held to the full gate, and the site itself only to the blocklist. A lab's
  // domain gates needs_registry_row and is never given a registry row, because
  // the registry names institutions (AGENTS.md -> Personal Data -> Linked sites).
  requirePersonPage(findings, value.linked_from, `${at}.linked_from`, context, institution);
  if (!isFilledString(value[urlKey])) {
    findings.problem(`${at}.${urlKey}`, "required; the linked site the fact was read from");
    return;
  }
  const site = gateUrl(value[urlKey], { registry: context.registry || [] });
  if (site.verdict === "blocked") {
    findings.problem(`${at}.${urlKey}`, `the gate blocks this site, linked or not: ${site.reason}`);
  }
}

// An address at the institution's own domain, whichever page published it: the
// domain gates official, and it is the same institution as the page the row
// was read from -- one registry row, or one registered domain under a
// restricted academic registry. A personal mailbox and a lab's own domain both
// fail the first test; another university's address fails the second.
function validateContact(findings, contact, at, page, context, institution) {
  const match = EMAIL.exec(String(contact.email || "").trim());
  if (!match) {
    return findings.problem(`${at}.email`, `must be one email address${found(contact.email)}; a phone number or a postal address is never recorded`);
  }
  const domain = gateUrl(`https://${match[1]}/`, { institution, registry: context.registry || [] });
  if (domain.verdict !== "official") {
    return findings.problem(`${at}.email`, `${match[1]} is not the institution's own domain (${domain.verdict}); a contact address is recorded only at the institution's domain`);
  }
  if (page && !sameInstitution(page, domain)) {
    findings.problem(`${at}.email`, `${match[1]} belongs to a different institution from ${page.host}, the page this row was read from`);
  }
}

function sameInstitution(a, b) {
  if (a.match === "registry" && b.match === "registry") return a.institution === b.institution;
  return Boolean(registrableDomain(a.host)) && registrableDomain(a.host) === registrableDomain(b.host);
}

// Two of the three values are published facts and carry the page's own
// words; `unknown` is the normal case and carries nothing, because nothing was
// stated. The field is required so that `unknown` is written rather than
// implied -- principle 9.
function validateAvailability(findings, value, at, context, institution) {
  if (!isMapping(value)) {
    return findings.problem(at, "required; value: unknown unless a page states otherwise");
  }
  if (!requireEnum(findings, value.value, `${at}.value`, vocabulary.researchers.availability)) return;
  if (value.value === "unknown") {
    for (const key of Object.keys(value)) {
      if (key !== "value") findings.problem(`${at}.${key}`, "must be absent when availability is unknown; nothing was stated, so nothing was read");
    }
    return;
  }
  requireSourced(findings, value, at, ["value", "quote"], context, institution);
  if (!isFilledString(value.quote)) {
    findings.problem(`${at}.quote`, `required for ${value.value}; availability is a stated fact only with the page's own words, and otherwise unknown`);
  }
}

// The same three statuses as the applicant's profile, and a stricter rule for
// the one that may carry no identifier: here the tool is asserting
// something about a stranger, so an accepted paper with no record carries the
// page that states the acceptance.
function validateResearcherPublications(findings, list, at, context, institution) {
  if (list === undefined) return;
  if (!Array.isArray(list)) return findings.problem(at, "must be a list (empty when none were read)");
  list.forEach((entry, index) => {
    const field = `${at}[${index}]`;
    if (!isMapping(entry)) return findings.problem(field, "must be a mapping");
    const allowed = ["title", "venue", "year", "authorship", "status", "identifier", ...SOURCED_KEYS];
    for (const key of Object.keys(entry)) {
      if (!allowed.includes(key)) findings.problem(`${field}.${key}`, `is not a publication field; the set is ${allowed.join(", ")}`);
    }
    for (const key of ["title", "venue", "year", "authorship"]) {
      if (!isFilledString(String(entry[key] ?? ""))) findings.problem(`${field}.${key}`, "required");
    }
    requireEnum(findings, entry.status, `${field}.status`, vocabulary.publications.status);
    requireDate(findings, entry.retrieved_at, `${field}.retrieved_at`);
    if (isFilledString(String(entry.identifier ?? ""))) {
      requireIdentifier(findings, entry.identifier, `${field}.identifier`);
      if (entry.source_url !== undefined) requireSourceUrl(findings, entry, field, context, institution);
      return;
    }
    if (entry.status !== "accepted") {
      return findings.problem(`${field}.identifier`, "required unless status is accepted; a claim about what someone published carries a DOI, an arXiv id, a PMID or an OpenAlex id");
    }
    if (entry.source_url === undefined) {
      return findings.problem(`${field}.source_url`, "required on an accepted paper with no identifier: the page that states the acceptance, because an acceptance the agent inferred is not a fact");
    }
    requireSourceUrl(findings, entry, field, context, institution);
  });
}

// A metric is a fact only with the database that produced it and the date
// it was read, because the same person has a different h-index in each. A
// journal impact factor is a fact about a journal, refused outright.
function validateMetrics(findings, list, at) {
  if (list === undefined) return;
  if (!Array.isArray(list)) return findings.problem(at, "must be a list (empty when none were read)");
  list.forEach((entry, index) => {
    const field = `${at}[${index}]`;
    if (!isMapping(entry)) return findings.problem(field, "must be a mapping with name, value, source and retrieved_at");
    for (const key of Object.keys(entry)) {
      if (!["name", "value", "source", "retrieved_at"].includes(key)) findings.problem(`${field}.${key}`, "is not a metric field; the set is name, value, source, retrieved_at");
    }
    if (!isFilledString(entry.name)) findings.problem(`${field}.name`, "required; which metric, e.g. h-index or cited-by count");
    else if (/impact factor/i.test(entry.name)) findings.problem(`${field}.name`, "a journal impact factor is a fact about a journal, not a person, and is refused outright (AGENTS.md principle 4)");
    if (typeof entry.value !== "number" || !Number.isFinite(entry.value)) findings.problem(`${field}.value`, `must be a number${found(entry.value)}`);
    if (!isFilledString(entry.source)) findings.problem(`${field}.source`, "required; the database that produced the number, because the same person has a different h-index in OpenAlex, Scopus and Google Scholar");
    requireDate(findings, entry.retrieved_at, `${field}.retrieved_at`);
  });
}

// ------------------------------------------------------------------- pool ---

// A list run's record: which published lists and which units were read, who
// was confirmed, who was discarded and why, and what the run spent. It records
// the run, not the world (DATA_CONTRACT.md -> Reports): a confirmed host
// candidate names its researcher row by `researcher_key` and carries only the
// run fields and the labels, which are compared with the row so the two cannot
// drift apart unnoticed.
//
// The record is read against three other files, which `validate.js` loads from
// its `inputs`: the fellowship record (its lists and rules), the researcher
// registry (the join), and the budget caps.
//
// A discard and an unconfirmed host candidate have no row, so each carries the
// page its reason rests on as `page_url`, with `linked_from` for a linked site
// A confirmed one carries neither: its pages are in the row it names.
const POOL_ENTRY_KEYS = ["researcher_key", "name", "institution", "unit", "found_at", "source", "status", "kept_because", "scope_notes", "unconfirmed_reason", "note", "page_url", "linked_from"];
const POOL_DISCARD_KEYS = ["name", "found_at", "source", "rests_on", "reason", "page_url", "linked_from"];
const POOL_LABELS = ["name", "institution", "unit"];

function validatePool(block, context = {}) {
  const findings = new Findings(context.label);
  if (!isMapping(block)) {
    findings.problem("(root)", "the machine record must parse to a mapping");
    return findings;
  }
  validateRecordHeader(findings, block, "pool", context);
  if (!isMapping(block.inputs)) {
    findings.problem("inputs", "required; a report opens with what it read");
  } else {
    for (const key of ["fellowship", "profile", "brief", "researchers"]) {
      if (!isFilledString(block.inputs[key])) findings.problem(`inputs.${key}`, "required; the path this run read, from the repository root");
    }
    if (!Array.isArray(block.inputs.prior_pools)) findings.problem("inputs.prior_pools", "must be a list (empty on a first run); a run dedupes against earlier pools");
  }
  for (const [field, message] of context.inputProblems || []) findings.problem(field, message);

  const record = isMapping(context.fellowship) ? context.fellowship : null;
  const rows = new Map();
  for (const row of context.researchers || []) {
    if (isMapping(row) && isFilledString(row.researcher_key)) rows.set(row.researcher_key, row);
  }

  if (validateBudget(findings, block.budget, context.caps || {}, ["web_searches", "page_opens"], "every list run")
    && (!Number.isInteger(block.budget.host_candidates_carried) || block.budget.host_candidates_carried < 0)) {
    findings.problem("budget.host_candidates_carried", `must be a non-negative whole number: the host candidates left unopened for the next run${found(block.budget.host_candidates_carried)}`);
  }
  const listNames = validatePoolLists(findings, block.host_lists, record);
  const unitNames = validatePoolUnits(findings, block.units, record, context);
  const sources = { host_list: listNames, unit: unitNames };

  const counts = new Map();
  const count = (entry) => {
    if (entry.found_at === "host_list" && isFilledString(entry.source)) counts.set(entry.source, (counts.get(entry.source) || 0) + 1);
  };

  if (!Array.isArray(block.host_candidates)) {
    findings.problem("host_candidates", "must be a list (empty when the run confirmed nobody)");
  } else {
    const keys = new Map();
    block.host_candidates.forEach((entry, index) => {
      const at = `host_candidates[${index}]`;
      if (!isMapping(entry)) return findings.problem(at, "must be a mapping");
      validatePoolEntry(findings, entry, at, rows, sources, context);
      count(entry);
      if (isFilledString(entry.researcher_key)) {
        if (keys.has(entry.researcher_key)) findings.problem(`${at}.researcher_key`, `duplicates host_candidates[${keys.get(entry.researcher_key)}]; one entry per person`);
        else keys.set(entry.researcher_key, index);
      }
    });
  }

  if (!Array.isArray(block.discarded)) {
    findings.problem("discarded", "must be a list (empty when nothing was removed); no host candidate leaves a run silently");
  } else {
    block.discarded.forEach((entry, index) => {
      const at = `discarded[${index}]`;
      if (!isMapping(entry)) return findings.problem(at, "must be a mapping with name, found_at, source, rests_on, reason and page_url");
      for (const key of Object.keys(entry)) {
        if (!POOL_DISCARD_KEYS.includes(key)) findings.problem(`${at}.${key}`, `is not a discard field; the set is ${POOL_DISCARD_KEYS.join(", ")}, because a discarded person has no row and nothing else about them is kept`);
      }
      if (!isFilledString(entry.name)) findings.problem(`${at}.name`, "required, as the list or page prints it");
      validatePoolSource(findings, entry, at, sources, context);
      // No availability value exists here, so a discard on availability cannot
      // be written: unknown removes nobody and stated_closed is a flag.
      requireEnum(findings, entry.rests_on, `${at}.rests_on`, vocabulary.pool.rests_on);
      if (!isFilledString(entry.reason)) findings.problem(`${at}.reason`, "required; nothing leaves a run silently");
      validatePoolPage(findings, entry, at, sources, context);
      count(entry);
    });
  }

  // Every entry a list printed has an outcome here: kept, unconfirmed, or
  // discarded. A name the run dropped without a line is the silent removal the
  // discard section exists to prevent.
  for (const [index, list] of (Array.isArray(block.host_lists) ? block.host_lists : []).entries()) {
    if (!isMapping(list) || list.outcome !== "read" || !Number.isInteger(list.entries)) continue;
    const accounted = counts.get(list.name) || 0;
    if (accounted !== list.entries) {
      findings.problem(`host_lists[${index}].entries`, `says the list printed ${list.entries} but ${accounted} host candidate and discard entries name it; every entry a list printed has an outcome`);
    }
  }

  requireOptionalStringList(findings, block.gaps, "gaps", "what the run could not resolve");

  for (const { at, text } of voiceStrings(block, VOICE_KEYS.pool)) {
    const script = findNonEnglishScriptDeep(text, at);
    if (script) findings.problem(script.path, nonEnglishScriptReason(script));
  }
  reportBannedPhrases(findings, block, VOICE_KEYS.pool);
  return findings;
}

// Every machine record names its kind, its applicant and its date, and the
// date is the filename's, so a hand-renamed report is caught.
function validateRecordHeader(findings, block, kind, context) {
  if (block.kind !== kind) findings.problem("kind", `must be ${kind}${found(block.kind)}`);
  if (block.schema_version !== 1) findings.problem("schema_version", `must be 1${found(block.schema_version)}`);
  if (!isFilledString(block.applicant_id)) {
    findings.problem("applicant_id", "required");
  } else if (context.applicantId && block.applicant_id !== context.applicantId) {
    findings.problem("applicant_id", `is ${block.applicant_id} but the report sits in applicants/${context.applicantId}/`);
  }
  if (requireDate(findings, block.date, "date") && context.fileDate && block.date !== context.fileDate) {
    findings.problem("date", `is ${block.date} but the filename says ${context.fileDate}`);
  }
}

// The caps are hard and the guard cannot see a fetch, so it checks the spend
// the run states against the cap it states and against config.yml.
// Not that the stated cap equals the config's: a report records the run under
// the caps of its day, and doctor re-validates it every session, so an
// applicant who later changes a cap would see a correct record refused.
// `keys` are the spends a mode reports, each capped by `<key>_per_run`.
// Returns false when there is no budget mapping to read further.
function validateBudget(findings, budget, caps, keys, who) {
  if (!isMapping(budget)) {
    return findings.problem("budget", `required; ${who} ends with what it spent against the config.yml caps`);
  }
  for (const key of keys) {
    const capKey = `${key}_per_run`;
    const at = `budget.${key}`;
    const entry = budget[key];
    if (!isMapping(entry)) {
      findings.problem(at, "required as {used, cap}");
      continue;
    }
    if (!Number.isInteger(entry.used) || entry.used < 0) findings.problem(`${at}.used`, `must be a non-negative whole number${found(entry.used)}`);
    if (!Number.isInteger(entry.cap) || entry.cap < 0) {
      findings.problem(`${at}.cap`, `must be the cap the run ran under, as a whole number${found(entry.cap)}`);
    }
    const over = [[entry.cap, "the cap this run states"], [caps[capKey], `config ${capKey}`]]
      .find(([cap]) => Number.isInteger(entry.used) && Number.isInteger(cap) && entry.used > cap);
    if (over) {
      findings.problem(`${at}.used`, `${entry.used} is over ${over[1]}, ${over[0]}; the cap is hard, and what the run did not reach is carried to the next run instead`);
    }
  }
  return true;
}

// Source 1: every list the fellowship record carries, and nothing else, each
// with the route the run read it by. A list is the fellowship's own page, so
// it is refused only when the gate blocks it. Returns each list's name
// with its pages -- the route read and the page a person reads -- which an
// entry's `page_url` may name.
function validatePoolLists(findings, lists, record) {
  const names = new Map();
  const recordLists = record && Array.isArray(record.host_lists) ? record.host_lists.filter(isMapping) : [];
  const expected = recordLists.map((list) => list.name);
  if (lists === undefined && expected.length === 0) return names;
  if (!Array.isArray(lists)) {
    findings.problem("host_lists", "must be a list of the fellowship record's published host lists, each with its outcome");
    return names;
  }
  lists.forEach((list, index) => {
    const at = `host_lists[${index}]`;
    if (!isMapping(list)) return findings.problem(at, "must be a mapping with name, read_url, retrieved_at, outcome and entries");
    if (!isFilledString(list.name)) {
      findings.problem(`${at}.name`, "required; the list's title as the fellowship record carries it");
    } else if (record && !expected.includes(list.name)) {
      findings.problem(`${at}.name`, `${JSON.stringify(list.name)} is not a host list in the fellowship record`);
    } else if (names.has(list.name)) {
      findings.problem(`${at}.name`, `${JSON.stringify(list.name)} appears twice`);
    } else {
      const own = recordLists.find((entry) => entry.name === list.name);
      names.set(list.name, [list.read_url, own && own.official_url]);
    }
    requireFellowshipUrl(findings, list.read_url, `${at}.read_url`);
    requireDate(findings, list.retrieved_at, `${at}.retrieved_at`);
    requireEnum(findings, list.outcome, `${at}.outcome`, vocabulary.pool.source_outcome);
    if (list.outcome === "read" && (!Number.isInteger(list.entries) || list.entries < 0)) {
      findings.problem(`${at}.entries`, "required when the list was read: how many people it printed");
    }
  });
  const missing = expected.filter((name) => !names.has(name));
  if (missing.length > 0) {
    findings.problem("host_lists", `leaves out ${missing.map((name) => JSON.stringify(name)).join(", ")}; every list the fellowship record carries is reported with its outcome`);
  }
  return names;
}

// Source 2: the units formed from the host rules and the brief. Read unless a
// published list bounds the pool, because the rules then make that list the
// whole of who may host. Each names the rule it came from by that rule's own
// words, and its page is held to the full gate, because a unit page is where a
// person's existence is read.
// Returns each unit's name with its page, as validatePoolLists does.
function validatePoolUnits(findings, units, record, context) {
  const names = new Map();
  const bounded = record && Array.isArray(record.host_lists) && record.host_lists.some((list) => isMapping(list) && list.bounds_pool === true);
  if (!Array.isArray(units)) {
    findings.problem("units", "must be a list (empty only when a published list bounds the pool)");
    return names;
  }
  if (bounded && units.length > 0) {
    findings.problem("units", "must be empty: a host list in the fellowship record has bounds_pool: true, so the rules make that list the whole of who may host and no unit page is read");
  } else if (record && !bounded && units.length === 0) {
    findings.problem("units", "is empty, but no host list in the fellowship record bounds the pool, so the eligible units are read as well");
  }
  const quotes = record && Array.isArray(record.host_rules)
    ? record.host_rules.filter(isMapping).map((rule) => collapse(rule.quote)) : [];
  units.forEach((unit, index) => {
    const at = `units[${index}]`;
    if (!isMapping(unit)) return findings.problem(at, "must be a mapping with unit, institution, host_rule, why, official_url, retrieved_at and outcome");
    if (!isFilledString(unit.unit)) findings.problem(`${at}.unit`, "required, as the unit's page names it");
    else names.set(unit.unit, [unit.official_url]);
    if (!isFilledString(unit.institution)) findings.problem(`${at}.institution`, "required");
    if (!isFilledString(unit.host_rule)) {
      findings.problem(`${at}.host_rule`, "required; the quote of the host rule this unit came from, verbatim");
    } else if (record && !quotes.includes(collapse(unit.host_rule))) {
      findings.problem(`${at}.host_rule`, "matches no host rule's quote in the fellowship record; a unit names the rule it came from in that rule's own words");
    }
    if (!isFilledString(unit.why)) findings.problem(`${at}.why`, "required; why this unit is on the list, from the rule and the brief");
    requireEnum(findings, unit.outcome, `${at}.outcome`, vocabulary.pool.source_outcome);
    if (unit.outcome === "needs_registry_row") {
      // Awaiting the registry row flow, or declined there: the page gated
      // needs_registry_row and nothing was read from it.
      if (!isFilledString(unit.official_url) || gateUrl(unit.official_url).verdict === "blocked") {
        findings.problem(`${at}.official_url`, "required, and not a page the gate blocks");
      }
    } else {
      requirePersonPage(findings, unit.official_url, `${at}.official_url`, context, unit.institution);
    }
    requireDate(findings, unit.retrieved_at, `${at}.retrieved_at`);
  });
  return names;
}

function collapse(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function validatePoolEntry(findings, entry, at, rows, sources, context) {
  for (const key of Object.keys(entry)) {
    if (!POOL_ENTRY_KEYS.includes(key)) {
      findings.problem(`${at}.${key}`, `is not a pool entry field (${POOL_ENTRY_KEYS.join(", ")}); a fact about the person belongs to the researcher row this entry names, not to a second copy here`);
    }
  }
  for (const key of ["name", "institution"]) {
    if (!isFilledString(entry[key])) findings.problem(`${at}.${key}`, "required");
  }
  validatePoolSource(findings, entry, at, sources, context);
  if (!requireEnum(findings, entry.status, `${at}.status`, vocabulary.pool.status)) return;

  if (entry.status === "unconfirmed") {
    // Named, never described: no page confirmed this person, so there is no
    // row to name and no fact to carry.
    if (entry.researcher_key !== undefined && entry.researcher_key !== null) {
      findings.problem(`${at}.researcher_key`, "must be null on an unconfirmed host candidate; no page confirmed them, so no row exists");
    }
    requireEnum(findings, entry.unconfirmed_reason, `${at}.unconfirmed_reason`, vocabulary.pool.unconfirmed_reason);
    if (!isFilledString(entry.note)) findings.problem(`${at}.note`, "required; what was tried and why it did not confirm them");
    validatePoolPage(findings, entry, at, sources, context);
    return;
  }

  if (entry.unconfirmed_reason !== undefined) findings.problem(`${at}.unconfirmed_reason`, "must be absent on a confirmed host candidate");
  for (const key of ["page_url", "linked_from"]) {
    if (entry[key] !== undefined) findings.problem(`${at}.${key}`, "must be absent on a confirmed host candidate; its pages are in the row it names, and the record copies none of them");
  }
  if (!isFilledString(entry.kept_because)) {
    findings.problem(`${at}.kept_because`, "required; the screen is a judgement, and a judgement shows its reasons (principle 6)");
  }
  requireOptionalStringList(findings, entry.scope_notes, `${at}.scope_notes`, "recommend turns each note into a constraint flag");
  if (!isFilledString(entry.researcher_key)) {
    return findings.problem(`${at}.researcher_key`, "required on a confirmed host candidate; the row its facts live in");
  }
  const row = rows.get(entry.researcher_key);
  if (!row) {
    return findings.problem(`${at}.researcher_key`, `${entry.researcher_key} has no row in the researcher registry this run names; a confirmed host candidate's facts live in a row`);
  }
  for (const key of POOL_LABELS) {
    if (isFilledString(entry[key]) && isFilledString(row[key]) && entry[key].trim() !== row[key].trim()) {
      findings.problem(`${at}.${key}`, `${JSON.stringify(entry[key])} disagrees with the row's ${JSON.stringify(row[key])}`);
    }
  }
}

// Where a person was found: a list this pool reports, a unit it reports, or,
// on the single-URL path, the person's own page, which is gated.
function validatePoolSource(findings, entry, at, sources, context) {
  if (!requireEnum(findings, entry.found_at, `${at}.found_at`, vocabulary.pool.found_at)) return;
  if (!isFilledString(entry.source)) {
    return findings.problem(`${at}.source`, "required: the list's name, the unit's name, or the page the single-URL path read");
  }
  if (entry.found_at === "single_url") {
    requirePersonPage(findings, entry.source, `${at}.source`, context, entry.institution);
  } else if (!sources[entry.found_at].has(entry.source)) {
    findings.problem(`${at}.source`, `${JSON.stringify(entry.source)} is not a ${entry.found_at === "host_list" ? "host list" : "unit"} this pool reports`);
  }
}

// The page a discard's or an unconfirmed entry's reason rests on. It is
// the page of the list or unit the entry was found at, which is gated as that
// source already, or a page about the person, held to the rule a row's fact
// is: official, or a linked site whose linking page is. A reason on the list
// line is read off the source's own page, so it names that page.
function validatePoolPage(findings, entry, at, sources, context) {
  if (!isFilledString(entry.page_url)) {
    return findings.problem(`${at}.page_url`, "required; the page this entry's reason rests on, so the reader can open it");
  }
  const own = entry.found_at === "single_url" ? [entry.source] : (sources[entry.found_at] && sources[entry.found_at].get(entry.source)) || [];
  if (entry.linked_from === undefined && own.some((page) => samePage(page, entry.page_url))) return;
  if (entry.rests_on === "list_line") {
    return findings.problem(`${at}.page_url`, `rests on the list line, so it names the page of ${JSON.stringify(entry.source)}, the source it was found at`);
  }
  requireSourceUrl(findings, entry, at, context, entry.institution, "page_url");
}

// One page, whatever the trailing slash or a leading www.
function samePage(a, b) {
  const key = (url) => {
    try {
      const parsed = new URL(String(url).trim());
      return `${normalizeHost(parsed.hostname)}${parsed.pathname.replace(/\/+$/, "")}${parsed.search}`;
    } catch (error) {
      return null;
    }
  };
  return isFilledString(a) && isFilledString(b) && key(a) !== null && key(a) === key(b);
}

// -------------------------------------------------------------- summaries ---

// A summarize run's record: one summary per confirmed host candidate in the
// pool it names, or the host candidate carried to the next run. The prose is
// the applicant's language and is not read here: it quotes
// a group in its own words, which may call itself world-leading, and an English
// phrase list cannot read another language. What is read is the record, where
// each summary names its row and lists what it cites, and every citation is
// joined to that row: a row field that holds something, or a paper the row
// records. A citation that joins nothing is a claim about a named person
// that rests on nothing the applicant can open.
//
// There is no `fit`, no `host_strength` and no rank key, and none may be added:
// the entry key set is closed, because a summary is description and a judgement
// in the same file would read like one (principle 7).
const SUMMARY_ENTRY_KEYS = ["researcher_key", "name", "institution", "unit", "cites", "gaps"];
// The row fields a summary's rubric describes: what the group states it works
// on, and who the person is in the page's words. Not `metrics`, which is
// host_strength evidence, and not `contact`, which describes no work.
const CITABLE_FIELDS = ["research_statement", "role_title", "unit", "availability"];

function validateSummaries(block, context = {}) {
  const findings = new Findings(context.label);
  if (!isMapping(block)) {
    findings.problem("(root)", "the machine record must parse to a mapping");
    return findings;
  }
  validateRecordHeader(findings, block, "summaries", context);
  if (!isMapping(block.inputs)) {
    findings.problem("inputs", "required; a report opens with what it read");
  } else {
    for (const key of ["pool", "researchers", "brief", "profile"]) {
      if (!isFilledString(block.inputs[key])) findings.problem(`inputs.${key}`, "required; the path this run read, from the repository root");
    }
  }
  for (const [field, message] of context.inputProblems || []) findings.problem(field, message);
  if (!Number.isInteger(block.publication_window_years) || block.publication_window_years < 1) {
    findings.problem("publication_window_years", `required: the window this run read the record in, as a whole number of years${found(block.publication_window_years)}`);
  }
  validateBudget(findings, block.budget, context.caps || {}, ["web_searches", "page_opens", "bibliographic_fetches"], "every summarize run");

  const rows = new Map();
  for (const row of context.researchers || []) {
    if (isMapping(row) && isFilledString(row.researcher_key)) rows.set(row.researcher_key, row);
  }
  // The pool's confirmed host candidates: who this run owes a summary. An
  // unconfirmed one has no row, so there is nothing to summarise.
  const owed = new Set((context.pool && Array.isArray(context.pool.host_candidates) ? context.pool.host_candidates : [])
    .filter((entry) => isMapping(entry) && entry.status === "confirmed" && isFilledString(entry.researcher_key))
    .map((entry) => entry.researcher_key));
  const seen = new Map();
  const account = (key, at) => {
    if (!isFilledString(key)) return false;
    if (seen.has(key)) {
      findings.problem(at, `${key} already appears at ${seen.get(key)}; each host candidate has one summary or is carried, once`);
      return false;
    }
    seen.set(key, at);
    if (context.pool && !owed.has(key)) {
      findings.problem(at, `${key} is not a confirmed host candidate in ${context.poolPath || "the pool this run names"}; a summary describes someone the pool confirmed`);
      return false;
    }
    return true;
  };

  if (!Array.isArray(block.summaries)) {
    findings.problem("summaries", "must be a list (empty when the run reached nobody)");
  } else {
    block.summaries.forEach((entry, index) => {
      const at = `summaries[${index}]`;
      if (!isMapping(entry)) return findings.problem(at, "must be a mapping with researcher_key, name, institution, cites and gaps");
      for (const key of Object.keys(entry)) {
        if (!SUMMARY_ENTRY_KEYS.includes(key)) {
          findings.problem(`${at}.${key}`, `is not a summary field (${SUMMARY_ENTRY_KEYS.join(", ")}); a fit, a host-strength call or a rank is recommend's, and a fact about the person is the row's`);
        }
      }
      if (!isFilledString(entry.researcher_key)) {
        findings.problem(`${at}.researcher_key`, "required; the row this summary describes");
      } else if (account(entry.researcher_key, `${at}.researcher_key`)) {
        const row = rows.get(entry.researcher_key);
        if (!row) {
          findings.problem(`${at}.researcher_key`, `${entry.researcher_key} has no row in the researcher registry this run names`);
        } else {
          for (const key of POOL_LABELS) {
            if (isFilledString(entry[key]) && isFilledString(row[key]) && entry[key].trim() !== row[key].trim()) {
              findings.problem(`${at}.${key}`, `${JSON.stringify(entry[key])} disagrees with the row's ${JSON.stringify(row[key])}`);
            }
          }
          validateCitations(findings, entry.cites, `${at}.cites`, row);
        }
      }
      for (const key of ["name", "institution"]) {
        if (!isFilledString(entry[key])) findings.problem(`${at}.${key}`, "required");
      }
      requireOptionalStringList(findings, entry.gaps, `${at}.gaps`, "what could not be established for this person");
    });
  }

  if (!Array.isArray(block.carried)) {
    findings.problem("carried", "must be a list (empty when every confirmed host candidate was summarised); nobody leaves a run silently");
  } else {
    block.carried.forEach((key, index) => {
      if (!isFilledString(key)) findings.problem(`carried[${index}]`, "must be a researcher_key");
      else account(key, `carried[${index}]`);
    });
  }
  for (const key of owed) {
    if (!seen.has(key)) {
      findings.problem("summaries", `${key} is a confirmed host candidate in the pool with no summary and not carried; every one has an outcome`);
    }
  }

  requireOptionalStringList(findings, block.gaps, "gaps", "what the run could not establish");
  for (const { at, text } of voiceStrings(block, VOICE_KEYS.summaries)) {
    const script = findNonEnglishScriptDeep(text, at);
    if (script) findings.problem(script.path, nonEnglishScriptReason(script));
  }
  reportBannedPhrases(findings, block, VOICE_KEYS.summaries);
  return findings;
}

// Each citation is one of three things, each joined to the row: a citable
// field the row holds; a paper the row records, by identifier in any written
// form; or an accepted paper with no record yet, by its title, whose row entry
// carries the page that states the acceptance. A summary that cites
// nothing is a problem, not a note: an empty record is a finding for the
// report's gaps, never a reason to write prose that cites nothing.
function validateCitations(findings, cites, at, row) {
  if (!Array.isArray(cites) || cites.length === 0) {
    return findings.problem(at, "must list at least one citation; a summary with no citable claim describes nobody, and what could not be established goes in gaps");
  }
  cites.forEach((cite, index) => joinCite(findings, cite, `${at}[${index}]`, row, { fields: CITABLE_FIELDS, who: "a summary" }));
}

// One citation joined to the row it names: a citable field the row holds, a
// paper the row records by identifier in any written form, an accepted paper
// with no record yet by its title, or -- where `hostList` is passed -- the
// published host list the pool found the person on, null when it found them
// elsewhere. Returns the tier the cite
// rests on (AGENTS.md -> Sources and Trust), or null when it joins nothing.
// A row's name, unit and role title were read off its official page; any other
// fact is linked when it carries `linked_from`.
function joinCite(findings, cite, at, row, { fields, who, hostList }) {
  const lists = hostList !== undefined;
  const kinds = ["field", "identifier", "accepted", ...(lists ? ["host_list"] : [])];
  const keys = isMapping(cite) ? Object.keys(cite) : [];
  if (keys.length !== 1 || !kinds.includes(keys[0])) {
    findings.problem(at, `must be one of {field: <row field>}, {identifier: <DOI, arXiv id, PMID or OpenAlex id>}, {accepted: <title>}${lists ? " or {host_list: <list name>}" : ""}`);
    return null;
  }
  const value = cite[keys[0]];
  const publications = Array.isArray(row.publications) ? row.publications.filter(isMapping) : [];
  if (keys[0] === "field") {
    const held = row[value];
    if (!fields.includes(value)) {
      const why = value === "metrics" ? "; a metric is never a reason for a fit, because a citation count does not say whether two research questions meet (principle 4)"
        : value === "availability" && who !== "a summary" ? "; a stated opening is shown, never a reason, or unknown would lower a call" : "";
      findings.problem(`${at}.field`, `${JSON.stringify(value)} is not a field ${who} cites (${fields.join(", ")})${why}`);
      return null;
    }
    if (held === undefined || (Array.isArray(held) && held.length === 0) || (value === "availability" && isMapping(held) && held.value === "unknown")) {
      findings.problem(`${at}.field`, `the row holds no ${value}${value === "availability" ? " statement" : ""}, so there is nothing to cite; say so in gaps`);
      return null;
    }
    if (value === "metrics") return "bibliographic";
    return isMapping(held) && held.linked_from !== undefined ? "linked" : "official";
  }
  if (keys[0] === "identifier") {
    const parsed = parseIdentifier(value);
    if (!parsed) {
      findings.problem(`${at}.identifier`, `${JSON.stringify(value)} is not ${IDENTIFIER_FORMS}`);
      return null;
    }
    if (!publications.some((entry) => parseIdentifier(entry.identifier)?.key === parsed.key)) {
      findings.problem(`${at}.identifier`, `${value} is not a paper the row records; ${who} cites what the row holds, and the paper is appended to the row first`);
      return null;
    }
    return "bibliographic";
  }
  if (keys[0] === "accepted") {
    const paper = publications.find((entry) => entry.status === "accepted" && !isFilledString(String(entry.identifier ?? "")) && collapse(entry.title) === collapse(value));
    if (!paper) {
      findings.problem(`${at}.accepted`, `${JSON.stringify(value)} is not the title of an accepted paper with no identifier in the row; one with an identifier is cited by it`);
      return null;
    }
    return paper.linked_from !== undefined ? "linked" : "official";
  }
  if (!isFilledString(hostList) || value !== hostList) {
    findings.problem(`${at}.host_list`, `${JSON.stringify(value)} is not the published list the pool found this person on${isFilledString(hostList) ? ` (${JSON.stringify(hostList)})` : "; the pool found them at a unit or on their own page"}`);
    return null;
  }
  return "official";
}

// --------------------------------------------------------- recommendation ---

// A recommend run's record: two judgements on every host candidate the
// summaries report described -- `fit` and `host_strength` -- each with its
// value, its evidence basis, its reasons and what it cites; the constraint
// flags that apply; and the applicant's keep or drop. The three key sets are
// closed, so no score, rank or probability can be added beside the judgements,
// and nothing here combines the two axes (principle 6).
//
// The prose is the agent's, as a summary's is: what is read is the record.
// Each axis cites the row the way a summary does, and the rule no wording
// carries is a join: a fit cites no metric. A text scan for numbers or
// "h-index" would refuse "three first-author papers since 2023", which is a
// fit reason.
const RECOMMENDATION_KEYS = ["kind", "schema_version", "applicant_id", "date", "inputs", "budget", "proposed", "entries", "carried", "gaps"];
const RECOMMENDATION_ENTRY_KEYS = ["researcher_key", "name", "institution", "unit", "fit", "host_strength", "constraint_flags", "status", "status_reason"];
const AXIS_KEYS = ["value", "evidence_basis", "reasons", "cites"];
// What each axis may cite from the row. `availability` is on neither list: a
// stated opening is a fact the report shows, never a reason, because if
// stated_open could raise a call then unknown, the normal case, would lower
// one. A fit cites no metric; `host_strength` alone cites the published list
// the pool found the person on, which is a fact about eligibility.
const AXIS_FIELDS = {
  fit: ["research_statement", "role_title", "unit"],
  host_strength: ["research_statement", "role_title", "unit", "metrics"],
};

function validateRecommendation(block, context = {}) {
  const findings = new Findings(context.label);
  if (!isMapping(block)) {
    findings.problem("(root)", "the machine record must parse to a mapping");
    return findings;
  }
  validateRecordHeader(findings, block, "recommendation", context);
  for (const key of Object.keys(block)) {
    if (!RECOMMENDATION_KEYS.includes(key)) {
      findings.problem(key, `is not a recommendation record key (${RECOMMENDATION_KEYS.join(", ")}); a report carries two judgements per host candidate and nothing that ranks or combines them`);
    }
  }
  if (!isMapping(block.inputs)) {
    findings.problem("inputs", "required; a report opens with what it read");
  } else {
    for (const key of ["pool", "summaries", "researchers", "fellowship", "brief", "profile"]) {
      if (!isFilledString(block.inputs[key])) findings.problem(`inputs.${key}`, "required; the path this run read, from the repository root");
    }
  }
  for (const [field, message] of context.inputProblems || []) findings.problem(field, message);
  validateBudget(findings, block.budget, context.caps || {}, ["page_opens"], "every recommend run");

  const rows = new Map();
  for (const row of context.researchers || []) {
    if (isMapping(row) && isFilledString(row.researcher_key)) rows.set(row.researcher_key, row);
  }
  // The pool's confirmed host candidates, each with the pool entry that found
  // them, and the ones the summaries report described. An entry judges someone
  // in both; a confirmed host candidate the summaries carried is carried here.
  const confirmed = new Map((context.pool && Array.isArray(context.pool.host_candidates) ? context.pool.host_candidates : [])
    .filter((entry) => isMapping(entry) && entry.status === "confirmed" && isFilledString(entry.researcher_key))
    .map((entry) => [entry.researcher_key, entry]));
  const summarised = new Set((context.summaries && Array.isArray(context.summaries.summaries) ? context.summaries.summaries : [])
    .filter((entry) => isMapping(entry) && isFilledString(entry.researcher_key))
    .map((entry) => entry.researcher_key));
  const seen = new Map();
  const account = (key, at) => {
    if (seen.has(key)) {
      findings.problem(at, `${key} already appears at ${seen.get(key)}; each host candidate is judged or carried, once`);
      return false;
    }
    seen.set(key, at);
    if (context.pool && !confirmed.has(key)) {
      findings.problem(at, `${key} is not a confirmed host candidate in ${context.poolPath || "the pool this run names"}; a recommendation judges someone the pool confirmed`);
      return false;
    }
    return true;
  };

  if (!Array.isArray(block.entries)) {
    findings.problem("entries", "must be a list (empty when the summaries described nobody)");
  } else {
    block.entries.forEach((entry, index) => {
      const at = `entries[${index}]`;
      if (!isMapping(entry)) return findings.problem(at, "must be a mapping with researcher_key, name, institution, fit, host_strength, constraint_flags and status");
      for (const key of Object.keys(entry)) {
        if (!RECOMMENDATION_ENTRY_KEYS.includes(key)) {
          findings.problem(`${at}.${key}`, `is not a recommendation entry field (${RECOMMENDATION_ENTRY_KEYS.join(", ")}); the two axes are never combined into a score or a rank, and a fact about the person is the row's`);
        }
      }
      for (const key of ["name", "institution"]) {
        if (!isFilledString(entry[key])) findings.problem(`${at}.${key}`, "required");
      }
      let row = null;
      if (!isFilledString(entry.researcher_key)) {
        findings.problem(`${at}.researcher_key`, "required; the row this entry judges");
      } else if (account(entry.researcher_key, `${at}.researcher_key`)) {
        if (context.summaries && !summarised.has(entry.researcher_key)) {
          findings.problem(`${at}.researcher_key`, `${entry.researcher_key} has no summary in ${context.summariesPath || "the summaries report this run names"}; a judgement follows the description it rests on, so carry the host candidate instead`);
        }
        row = rows.get(entry.researcher_key) || null;
        if (!row) {
          findings.problem(`${at}.researcher_key`, `${entry.researcher_key} has no row in the researcher registry this run names`);
        } else {
          for (const key of POOL_LABELS) {
            if (isFilledString(entry[key]) && isFilledString(row[key]) && entry[key].trim() !== row[key].trim()) {
              findings.problem(`${at}.${key}`, `${JSON.stringify(entry[key])} disagrees with the row's ${JSON.stringify(row[key])}`);
            }
          }
        }
      }
      const found = confirmed.get(entry.researcher_key);
      const hostList = found && found.found_at === "host_list" ? found.source : null;
      validateAxis(findings, entry.fit, `${at}.fit`, "fit", row, { fields: AXIS_FIELDS.fit, who: "a fit" });
      validateAxis(findings, entry.host_strength, `${at}.host_strength`, "host_strength", row, { fields: AXIS_FIELDS.host_strength, who: "a host_strength call", hostList });
      validateFlags(findings, entry.constraint_flags, `${at}.constraint_flags`, row);
      if (requireEnum(findings, entry.status, `${at}.status`, vocabulary.recommendation.status)
        && entry.status === "dropped" && !isFilledString(entry.status_reason)) {
        findings.problem(`${at}.status_reason`, "required when the applicant drops a host candidate; the reason is the applicant's, recorded beside the entry");
      }
    });
  }

  if (!Array.isArray(block.carried)) {
    findings.problem("carried", "must be a list (empty when every confirmed host candidate was judged); nobody leaves a run silently");
  } else {
    block.carried.forEach((key, index) => {
      if (!isFilledString(key)) findings.problem(`carried[${index}]`, "must be a researcher_key");
      else account(key, `carried[${index}]`);
    });
  }
  // An omission is never how the list narrows; a drop is.
  for (const key of confirmed.keys()) {
    if (!seen.has(key)) {
      findings.problem("entries", `${key} is a confirmed host candidate in the pool with no entry and not carried; every one is judged, and a drop is the applicant's status on an entry, never an omission`);
    }
  }
  validateProposed(findings, block.proposed, Array.isArray(block.entries) ? block.entries : []);

  requireOptionalStringList(findings, block.gaps, "gaps", "what the run could not establish");
  for (const { at, text } of voiceStrings(block, VOICE_KEYS.recommendation)) {
    const script = findNonEnglishScriptDeep(text, at);
    if (script) findings.problem(script.path, nonEnglishScriptReason(script));
  }
  reportBannedPhrases(findings, block, VOICE_KEYS.recommendation);
  return findings;
}

// The set the report proposes the applicant name, sized to what the
// fellowship asks for, each member with the need of the brief it covers.
// A set and not an order: it carries no position, and the guard checks only
// that each member is an entry the applicant has not dropped.
function validateProposed(findings, proposed, entries) {
  if (!Array.isArray(proposed)) {
    return findings.problem("proposed", "must be a list (empty when nobody was judged): the set the report proposes to name, each member with the need of the brief it covers");
  }
  const statuses = new Map(entries.filter(isMapping).map((entry) => [entry.researcher_key, entry.status]));
  const members = new Set();
  proposed.forEach((member, index) => {
    const at = `proposed[${index}]`;
    if (!isMapping(member)) return findings.problem(at, "must be a mapping with researcher_key and covers");
    for (const key of Object.keys(member)) {
      if (!["researcher_key", "covers"].includes(key)) findings.problem(`${at}.${key}`, "is not a proposed-set field; the set is researcher_key, covers, and carries no order or score");
    }
    if (!isFilledString(member.covers)) findings.problem(`${at}.covers`, "required; the need of the brief this member covers");
    const key = member.researcher_key;
    if (!isFilledString(key)) return findings.problem(`${at}.researcher_key`, "required");
    if (members.has(key)) findings.problem(`${at}.researcher_key`, `${key} is proposed twice`);
    members.add(key);
    if (!statuses.has(key)) findings.problem(`${at}.researcher_key`, `${key} is not an entry in this report; the set is drawn from the judged host candidates`);
    else if (statuses.get(key) === "dropped") findings.problem(`${at}.researcher_key`, `${key} is proposed, but the applicant dropped this entry; the drop is the applicant's and stands`);
  });
}

// One judgement: a value, the tier its reasons rest on, the reasons, and what
// they cite. The basis is the agent's call, and the guard holds it to the
// cites: a call said to rest on an official or linked page or on a
// bibliographic record cites at least one fact of that tier, and one resting on
// general knowledge alone is never `strong` (AGENTS.md -> The Two Judgement
// Axes).
function validateAxis(findings, axis, at, name, row, options) {
  if (!isMapping(axis)) {
    return findings.problem(at, `required as {${AXIS_KEYS.join(", ")}}; both axes are judged on every entry`);
  }
  for (const key of Object.keys(axis)) {
    if (!AXIS_KEYS.includes(key)) findings.problem(`${at}.${key}`, `is not an axis field (${AXIS_KEYS.join(", ")})`);
  }
  const value = requireEnum(findings, axis.value, `${at}.value`, vocabulary.recommendation[name]) ? axis.value : null;
  const basis = requireEnum(findings, axis.evidence_basis, `${at}.evidence_basis`, vocabulary.recommendation.evidence_basis) ? axis.evidence_basis : null;
  if (!Array.isArray(axis.reasons) || axis.reasons.length === 0) {
    findings.problem(`${at}.reasons`, "must list at least one reason; a judgement shows its reasons (principle 6), and unclear says why it is unclear");
  } else {
    axis.reasons.forEach((reason, index) => {
      if (!isFilledString(reason)) findings.problem(`${at}.reasons[${index}]`, "must be a non-empty string");
    });
  }
  if (value === "strong" && basis === "inferred") {
    findings.problem(`${at}.value`, "strong on an inferred basis; neither axis is strong on general knowledge alone");
  }
  if (!Array.isArray(axis.cites)) {
    return findings.problem(`${at}.cites`, "must be a list (empty only when the call rests on general knowledge)");
  }
  const tiers = row ? axis.cites.map((cite, index) => joinCite(findings, cite, `${at}.cites[${index}]`, row, options)) : [];
  if (row && basis && basis !== "inferred" && !tiers.includes(basis)) {
    findings.problem(`${at}.evidence_basis`, `is ${basis}, but nothing this call cites is ${basis === "bibliographic" ? "a publication record or a metric" : `a fact read from ${basis === "linked" ? "a linked site" : "an official page"}`}; cite the fact the call rests on, or name the basis it does rest on`);
  }
}

// The closed flag list. Two flags are facts the row settles rather than
// readings of it, so they are joined to the row both ways: a stated_closed
// availability is always flagged, and never otherwise; a row with no
// published contact address is flagged, and a row with one is not.
function validateFlags(findings, flags, at, row) {
  if (!Array.isArray(flags)) return findings.problem(at, "must be a list (empty when none applies)");
  const listed = new Set();
  flags.forEach((flag, index) => {
    if (!requireEnum(findings, flag, `${at}[${index}]`, vocabulary.recommendation.constraint_flags)) return;
    if (listed.has(flag)) findings.problem(`${at}[${index}]`, `${flag} is listed twice`);
    listed.add(flag);
  });
  if (!row) return;
  const closed = isMapping(row.availability) && row.availability.value === "stated_closed";
  if (closed !== listed.has("availability_stated_closed")) {
    findings.problem(at, closed
      ? "must carry availability_stated_closed: the row states the group is closed, which is a flag for the applicant to weigh, not a removal"
      : "carries availability_stated_closed, but the row states no closure; unknown is not a flag and lowers nothing");
  }
  const noContact = row.contact === undefined;
  if (noContact !== listed.has("no_published_contact_route")) {
    findings.problem(at, noContact
      ? "must carry no_published_contact_route: the row records no published contact address"
      : "carries no_published_contact_route, but the row records a published contact address");
  }
}

function requireOptionalStringList(findings, value, field, what) {
  if (!Array.isArray(value)) return findings.problem(field, `must be a list (empty when there is nothing): ${what}`);
  value.forEach((item, index) => {
    if (!isFilledString(item)) findings.problem(`${field}[${index}]`, "must be a non-empty string");
  });
  return true;
}

// ----------------------------------------------------------- institutions ---

// The English-script sweep runs because a registry row is read by the guards
// and is English (AGENTS.md -> Language). The sweep reads the row's own words and skips `aliases`, where an institution's name in
// its own script belongs. There is no banned-phrase scan: a row has no prose to
// carry a claim, so the scan could only reject a real name.
function validateInstitutions(data, context = {}) {
  const findings = new Findings(context.label);
  const layer = context.layer || "local";
  if (!isMapping(data)) {
    findings.problem("(root)", "must parse to a mapping with an institutions list");
    return findings;
  }
  if (layer === "seed" && !DATE.test(String(data.source_version || ""))) {
    findings.problem("source_version", `a seed file carries a dated source_version${found(data.source_version)}`);
  }
  if (!Array.isArray(data.institutions)) {
    findings.problem("institutions", "must be a list of institution rows");
    return findings;
  }
  if (layer === "seed" && data.institutions.length === 0) {
    findings.problem("institutions", "a seed file with no rows admits nothing; delete it instead");
  }

  const seenRor = new Map();
  const seenDomain = new Map();

  data.institutions.forEach((row, index) => {
    const field = `institutions[${index}]`;
    if (!isMapping(row)) {
      findings.problem(field, "must be a mapping");
      return;
    }
    const label = isFilledString(row.name) ? row.name : `row ${index}`;

    if (!isFilledString(row.name)) findings.problem(`${field}.name`, "required; the official English name");
    if (!isFilledString(row.country)) findings.problem(`${field}.country`, "required");

    if (row.aliases !== undefined && row.aliases !== null) {
      if (!Array.isArray(row.aliases)) findings.problem(`${field}.aliases`, "must be a list (empty when there are none)");
      else row.aliases.forEach((alias, position) => {
        if (!isFilledString(alias)) findings.problem(`${field}.aliases[${position}]`, "must be a non-empty string");
      });
    }

    if (!Array.isArray(row.official_domains) || row.official_domains.length === 0) {
      findings.problem(`${field}.official_domains`, "required; a row with no domain admits no host");
    } else {
      row.official_domains.forEach((domain, position) => {
        const at = `${field}.official_domains[${position}]`;
        if (!isFilledString(domain)) return findings.problem(at, "must be a non-empty string");
        if (domain !== domain.trim().toLowerCase()) findings.problem(at, `must be lowercase and untrimmed of spaces${found(domain)}`);
        if (/[/:?#]/.test(domain)) findings.problem(at, `must be a bare host, not a URL${found(domain)}`);
        if (/^www\./.test(domain)) findings.problem(at, `must drop the www. prefix${found(domain)}`);
        const host = normalizeHost(domain);
        if (host && isBarePublicSuffix(host)) {
          findings.problem(at, `${host} is a bare public suffix; the host match is a dot-boundary parent match, so storing it would admit every host under it`);
        }
        if (host) {
          const owner = seenDomain.get(host);
          if (owner && owner !== label) findings.problem(at, `${host} is already an official domain of ${owner}; one domain has one owner`);
          else seenDomain.set(host, label);
        }
      });
    }

    if (row.ror_id !== undefined && row.ror_id !== null) {
      if (!isFilledString(row.ror_id)) findings.problem(`${field}.ror_id`, "must be a ROR id string or null");
      else if (!/^0[a-hj-km-np-z0-9]{8}$/.test(row.ror_id)) findings.problem(`${field}.ror_id`, `does not look like a ROR id${found(row.ror_id)}`);
      else {
        const owner = seenRor.get(row.ror_id);
        if (owner && owner !== label) findings.problem(`${field}.ror_id`, `${row.ror_id} is already used by ${owner}`);
        else seenRor.set(row.ror_id, label);
      }
    }

    requireEnum(findings, row.source, `${field}.source`, vocabulary.institutions.source);
    requireDate(findings, row.retrieved_at, `${field}.retrieved_at`);
    // Who vouched for a row a run discovered. A run writes the row
    // itself, once this guard passes, and the pool report lists it, so the
    // value is `agent`; `applicant` is a row the applicant confirmed. Either
    // way someone did, and the field says who.
    if (row.source === "discovered" && !["agent", "applicant"].includes(row.confirmed_by)) {
      findings.problem(`${field}.confirmed_by`, `a discovered row says who vouched for its domain: agent when a run wrote it, applicant when the applicant confirmed it${found(row.confirmed_by)}`);
    }
  });

  for (const { at, text } of voiceStrings(data, VOICE_KEYS.institutions)) {
    const script = findNonEnglishScriptDeep(text, at);
    if (script) findings.problem(script.path, nonEnglishScriptReason(script));
  }

  return findings;
}

module.exports = {
  KEY_ORDER,
  SUPPORTED_KINDS,
  bannedPhrasesIn,
  found,
  validateBrief,
  validateFellowship,
  validateInstitutions,
  validatePool,
  validateProfile,
  validateRecommendation,
  validateResearchers,
  validateSummaries,
  vocabulary,
};
