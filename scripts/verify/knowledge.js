// The bundled knowledge: the controlled vocabularies and the institution
// registry. Everything here is data a guard reads, so a broken row is a broken
// guard, and the seed half is hand-refreshed by the maintainer.
const fs = require("fs");
const path = require("path");
const { PUBLIC_HOST_SUFFIXES, isBarePublicSuffix, normalizeHost } = require("../lib/gate");
const { institutionPaths, loadInstitutions } = require("../lib/registry");
const { vocabulary } = require("../lib/schema");
const { validateFile } = require("../cli/validate");

const repoRoot = path.resolve(__dirname, "..", "..");

function main() {
  checkPublicSuffixSet();
  checkVocabulary();
  const institutions = checkInstitutions();
  console.log(`Knowledge verifies (${institutions} institution rows, vocabulary ${vocabulary.source_version})`);
}

// The set the bare-suffix sweep reads: every entry must be a real multi-label
// suffix, or the sweep would quietly stop rejecting the thing it exists to
// reject.
function checkPublicSuffixSet() {
  assert(PUBLIC_HOST_SUFFIXES.size > 0, "PUBLIC_HOST_SUFFIXES is empty; the bare-suffix sweep would be vacuous");
  for (const suffix of PUBLIC_HOST_SUFFIXES) {
    assert(suffix === suffix.toLowerCase() && suffix.includes("."), `PUBLIC_HOST_SUFFIXES holds ${suffix}, which is not a lowercase multi-label suffix`);
    assert(isBarePublicSuffix(suffix), `isBarePublicSuffix must reject the listed suffix ${suffix}`);
  }
}

// The controlled lists `schema.js` validates agent output against. Their
// members and, where a rubric reads them in order, their order, are contract:
// `AGENTS.md` and `modes/*.md` document them and a record is rejected against
// them, so a silent edit here changes what the tool accepts.
const CONTROLLED = [
  [["fellowship", "host_requirement"], ["required", "optional", "none"], "the three host requirements, read off a fellowship's own pages and never assumed (AGENTS.md -> What this project is)"],
  [["researchers", "availability"], ["stated_open", "stated_closed", "unknown"], "the three availability values; the first two need a verbatim quote, and unknown is the normal case and removes nobody"],
  [["publications", "status"], ["published", "preprint", "accepted"], "the publication states, read by the applicant's profile and by a host candidate's registry row alike; only accepted may carry no identifier, because a venue can accept a paper months before it issues a record for it"],
  [["pool", "found_at"], ["host_list", "unit", "single_url"], "the three host candidate sources (AGENTS.md -> Host Candidate Sources)"],
  [["pool", "source_outcome"], ["read", "page_unavailable", "needs_registry_row", "not_opened_budget"], "what happened to a published list or a unit page"],
  [["pool", "status"], ["confirmed", "unconfirmed"], "a host candidate with a registry row, or one named with none"],
  [["pool", "unconfirmed_reason"], ["page_unavailable", "no_statement_of_work", "not_opened_budget"], "why an unconfirmed host candidate has no row"],
  [["pool", "rests_on"], ["list_line", "own_page", "host_rule"], "what a discard's reason stands on; there is no availability value, because unknown removes nobody and stated_closed is a flag"],
  [["recommendation", "fit"], ["strong", "plausible", "weak", "unclear"], "the fit vocabulary"],
  [["recommendation", "host_strength"], ["strong", "plausible", "weak", "unclear"], "the host_strength vocabulary; the same four values on a different question, never averaged with fit"],
  [["recommendation", "evidence_basis"], ["official", "linked", "bibliographic", "inferred"], "the four evidence bases, one per tier that may support a call; no `ranked`, because an institution's rank says nothing about a person"],
  [["recommendation", "status"], ["kept", "dropped", "undecided"], "the keep-or-drop vocabulary"],
  [["institutions", "source"], ["edunexus-seed", "maintainer-run", "discovered"], "the institution row sources"],
  [["gate", "verdicts"], ["official", "needs_registry_row", "blocked"], "the three gate verdicts"],
];

function checkVocabulary() {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(vocabulary.source_version || ""), "knowledge/vocabulary.json needs a dated source_version");
  for (const [keys, expected, what] of CONTROLLED) {
    let node = vocabulary;
    for (const key of keys) node = node && node[key];
    assert(Array.isArray(node) && node.join(",") === expected.join(","),
      `vocabulary ${keys.join(".")} must be ${what}: ${expected.join(", ")} (found ${Array.isArray(node) ? node.join(", ") : JSON.stringify(node)})`);
  }
  assert(Array.isArray(vocabulary.recommendation.constraint_flags) && vocabulary.recommendation.constraint_flags.length >= 9,
    "vocabulary recommendation.constraint_flags must list recommend's closed set of flags");
  assert(vocabulary.recommendation.constraint_flags.includes("availability_stated_closed"),
    "constraint_flags must carry availability_stated_closed; a closed page is a flag the applicant weighs and never a removal");

  // One list, read by two layers. The rule that differs between them is
  // about evidence, not about vocabulary -- a host candidate's accepted paper
  // carries the page that says so, an applicant's carries nothing but a note --
  // so the values must not fork into two lists that drift apart.
  for (const key of ["profile", "researchers"]) {
    assert(!vocabulary[key] || vocabulary[key].publication_status === undefined,
      `vocabulary carries ${key}.publication_status; publication states are one shared list, and two copies would drift`);
  }

  walkLists(vocabulary, "", (values, at) => {
    assert(values.every((value) => typeof value === "string" && value.trim() !== ""), `${at} must hold non-empty strings`);
    assert(new Set(values).size === values.length, `${at} repeats a value`);
  });

  // A banned phrase names the claim, never a bare word this reader uses for
  // something else. A one-word entry that is ordinary vocabulary here would
  // reject a correct record.
  const ORDINARY = ["impact", "citation", "index", "prestige", "likely", "top", "chance", "probability", "odds", "leading", "world"];
  for (const phrase of vocabulary.banned_phrases) {
    assert(typeof phrase === "string" && phrase.trim() !== "", "every banned phrase must be a non-empty string");
    assert(!ORDINARY.includes(phrase.toLowerCase()),
      `banned_phrases holds the bare word "${phrase}", which is ordinary vocabulary for this reader; ban the claim it appears in instead`);
  }
}

function checkInstitutions() {
  const paths = institutionPaths();
  assert(fs.existsSync(paths.seed), "registry/institutions.seed.yml is missing");
  // The local half is user layer: gitignored, and absent from a fresh clone.
  const gitignore = fs.readFileSync(path.join(repoRoot, ".gitignore"), "utf8").split("\n").map((line) => line.trim());
  assert(gitignore.includes("/registry/institutions.yml"), ".gitignore must keep registry/institutions.yml out of the repository");

  const seed = validateFile("institutions", paths.seed, { layer: "seed" });
  assert(seed.ok, `registry/institutions.seed.yml does not validate: ${seed.problems.map((p) => `${p.field}: ${p.message}`).join("; ")}`);

  // No row count is pinned: a refresh that adds a row is correct, and a seed
  // with none already fails its own validation.
  const registry = loadInstitutions();
  assert(registry.problems.length === 0, `institution registry: ${registry.problems.join("; ")}`);

  if (fs.existsSync(paths.local)) {
    const local = validateFile("institutions", paths.local, { layer: "local" });
    assert(local.ok, `registry/institutions.yml does not validate: ${local.problems.map((p) => `${p.field}: ${p.message}`).join("; ")}`);
  }

  // Both halves are read as one list, so the no-bare-suffix and one-owner rules
  // hold across the union, not only inside a file.
  const owners = new Map();
  for (const entry of registry.entries) {
    for (const domain of entry.row.official_domains || []) {
      const host = normalizeHost(domain);
      assert(host && !isBarePublicSuffix(host), `${entry.file} row ${entry.index} (${entry.row.name}) stores ${domain}, a bare public suffix or dotless host`);
      const owner = owners.get(host);
      assert(!owner || owner === entry.row.name, `${host} is claimed by both ${owner} and ${entry.row.name} across the two registry halves`);
      owners.set(host, entry.row.name);
    }
  }
  return registry.entries.length;
}

function walkLists(value, at, visit) {
  if (Array.isArray(value)) return visit(value, at);
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (key.startsWith("_")) continue;
      walkLists(entry, at ? `${at}.${key}` : key, visit);
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    console.error(`verify:knowledge failed: ${message}`);
    process.exit(1);
  }
}

main();
