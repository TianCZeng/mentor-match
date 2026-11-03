// The official-domain gate against its cases.
//
// The first block pins the rules every URL meets: a seed row placing a domain
// under an open country ending, the restricted academic endings, HTTPS, the
// dot-boundary parent match, and the aggregators. "Not admitted" is
// `needs_registry_row` -- the verdict that hands the domain to the registry row
// flow instead of dropping it.
//
// The second block pins the wider blocklist, the search engines and caches,
// the restricted / open registry split, `--institution`, and the warnings.
//
// The third block is about people: the profile aggregators and bibliographic
// indexes a run would otherwise take an identity from, the social platforms a
// linked site may not be read from, and the two host prefixes that do not warn.
const { domainExplainedByName, gateUrl, isBarePublicSuffix, normalizeHost, registrableDomain, registrableLabel } = require("../lib/gate");
const { loadInstitutions } = require("../lib/registry");
const { runGate } = require("../cli/gate");
const { loadYaml } = require("../lib/yaml");
const { validateInstitutions } = require("../lib/schema");

// The seed half alone. `loadInstitutions()` merges in the gitignored local
// half, and then a row the applicant confirmed on their own machine could
// change what this target asserts about the gate's rules.
const registry = loadInstitutions().entries.filter((entry) => entry.layer === "seed").map((entry) => entry.row);

// [url, options, expected verdict, expected warning codes]
const HOST_RULE_CASES = [
  // seed-anchored hosts: non-restricted country domains the registry places
  ["https://www.tum.de/en/studies", {}, "official", []],
  ["https://finance.tum.de/funding", {}, "official", []],
  ["https://ethz.ch/en/studies", {}, "official", []],
  ["https://www.epfl.ch/education", {}, "official", []],
  // ... and the heuristic stays narrow for everything else under the same TLD
  ["https://random.de/foo", {}, "needs_registry_row", []],
  ["https://random.ch/foo", {}, "needs_registry_row", []],
  // the restricted-TLD heuristic, seeded or not
  ["https://berkeley.edu/admissions", {}, "official", []],
  ["https://example.edu/programs/ms-cs", {}, "official", []],
  ["https://gradschool.example.edu/apply", {}, "official", []],
  ["https://cs.example.edu/graduate/ms", {}, "official", []],
  // HTTPS is required for an official claim
  ["http://example.edu/programs", {}, "blocked", []],
  ["http://www.tum.de/en/studies", {}, "blocked", []],
  // dot-boundary parent match: a lookalike that merely ends with the name fails
  ["https://mit.edu.evil.com/programs", {}, "needs_registry_row", []],
  ["https://programs.aggregator.example.com/ms-cs", {}, "needs_registry_row", []],
  ["https://tracker.example.com/click?to=example.edu", {}, "needs_registry_row", []],
  ["https://elsewhere.example.com/programs", {}, "needs_registry_row", []],
  // Aggregators, forums, directories and ranking sites
  ["https://en.wikipedia.org/wiki/MIT", {}, "blocked", []],
  ["https://www.reddit.com/r/gradadmissions", {}, "blocked", []],
  ["https://www.mastersportal.com/studies/1", {}, "blocked", []],
  ["https://www.topuniversities.com/rankings", {}, "blocked", []],
  ["https://www.shiksha.com/abroad", {}, "blocked", []],
  ["https://www.educations.com/x", {}, "blocked", []],
  ["https://www.hotcoursesabroad.com/x", {}, "blocked", []],
  ["https://www.studyportals.com/x", {}, "blocked", []],
];

const REGISTRY_CASES = [
  // A directory on a restricted registry: the blocklist runs before the TLD
  // heuristic, or this one would be admitted as official.
  ["https://www.prospects.ac.uk/postgraduate-courses", {}, "blocked", []],
  ["https://www.findamasters.com/masters-degrees/", {}, "blocked", []],
  ["https://www.timeshighereducation.com/world-university-rankings", {}, "blocked", []],
  ["https://www.usnews.com/best-graduate-schools", {}, "blocked", []],
  // Search engines, proxies, and caches wrap a target that must be unwrapped.
  ["https://www.google.com/url?q=https://mit.edu/x", {}, "blocked", []],
  ["https://www.google.co.uk/search?q=msc+cs", {}, "blocked", []],
  ["https://www.bing.com/search?q=msc", {}, "blocked", []],
  ["https://duckduckgo.com/?q=msc", {}, "blocked", []],
  ["https://yandex.ru/search/?text=msc", {}, "blocked", []],
  ["https://r.jina.ai/https://mit.edu", {}, "blocked", []],
  ["https://web.archive.org/web/2020/https://mit.edu", {}, "blocked", []],
  // A host under no academic registry. The first is deliberately not a real
  // institution: a real one can be seeded later, and then the case would be
  // pinning this registry's contents rather than the rule.
  ["https://www.some-university.nl/opleidingen", {}, "needs_registry_row", []],
  ["https://www.hku.hk/research/", {}, "needs_registry_row", []],
  // Restricted endings outside the US, the UK and Australasia, each admitted
  // without a row; and two academic endings whose registry is not restricted.
  ["https://www.u-tokyo.ac.jp/en/", {}, "official", []],
  ["https://www.pku.edu.cn/", {}, "official", []],
  ["https://www.kaist.ac.kr/en/", {}, "official", []],
  ["https://www.cuhk.edu.hk/english/", {}, "official", []],
  ["https://www.ntu.edu.tw/english/", {}, "official", []],
  ["https://iisc.ac.in/research/", {}, "official", []],
  ["https://www.ia.ac.cn/", {}, "needs_registry_row", []],
  ["https://www.weizmann.ac.il/", {}, "needs_registry_row", []],
  // Restricted registry, host the seed does not place: --institution never
  // lowers the verdict, it warns. A URL is not page text, and an acronym domain
  // names no institution, so downgrading here would only teach the caller to
  // drop the flag.
  ["https://gradschool.example.edu/apply", { institution: "Riverton College" }, "official", ["institution_unconfirmed_by_url"]],
  ["https://www.sussex.ac.uk/study", { institution: "University of Leeds" }, "official", ["institution_unconfirmed_by_url"]],
  // ... and stays quiet when the domain is the institution's name, spelled out
  // or as its acronym.
  ["https://www.exeter.ac.uk/postgraduate", { institution: "University of Exeter" }, "official", []],
  ["https://www.lancaster.ac.uk/study", { institution: "Lancaster University" }, "official", []],
  ["https://gradschool.example.edu/apply", { institution: "Example State University" }, "official", []],
  // A seeded host resolves through the registry first, so no heuristic and no
  // warning: the registry is the cheaper and the stronger answer.
  ["https://gatech.edu/grad", { institution: "Georgia Institute of Technology" }, "official", []],
  ["https://www.ucl.ac.uk/prospective-students", { institution: "University College London" }, "official", []],
  // Open registry: anyone may register a .ca, so the name check decides.
  ["https://someagency.ca/programs", { institution: "University of British Columbia" }, "needs_registry_row", []],
  ["https://someagency.ca/programs", {}, "needs_registry_row", []],
  // Containing the name is not being the name: an agency domain that borrows a
  // university's name must still go through the registry row flow.
  ["https://toronto-admissions-agency.ca/apply", { institution: "University of Toronto" }, "needs_registry_row", []],
  ["https://exeter.ca/graduate", { institution: "University of Exeter" }, "official", []],
  // ... unless the registry already places it.
  ["https://cs.utoronto.ca/graduate", {}, "official", []],
  // Warnings that do not change a verdict.
  ["https://cs.illinois.edu/~bob/ms-notes", {}, "official", ["personal_page_path"]],
  ["https://blogs.cornell.edu/grad/2027", {}, "official", ["informal_subdomain"]],
  ["https://sites.mit.edu/someone/ms", {}, "official", ["informal_subdomain"]],
  // Not a URL the gate can work with.
  ["berkeley.edu/admissions", {}, "blocked", []],
  ["", {}, "blocked", []],
  ["not a url", {}, "blocked", []],
];

const PEOPLE_CASES = [
  // The tool's whole job is reading about people, so the aggregators that
  // publish people are the ones it must refuse. None of these may say who a
  // person is, what unit they are in, or what their role is; that comes from
  // the institution's own page (AGENTS.md -> Sources and Trust).
  ["https://www.researchgate.net/profile/Jane-Doe", {}, "blocked", []],
  ["https://independent.academia.edu/JaneDoe", {}, "blocked", []],
  ["https://scholar.google.com/citations?user=abcdef", {}, "blocked", []],
  // Google Sites hosts a lab's own site and is not a search engine, so
  // it is readable as a linked site, never as an official page.
  ["https://sites.google.com/site/example-lab/", {}, "needs_registry_row", ["informal_subdomain"]],
  ["https://www.semanticscholar.org/author/2100", {}, "blocked", []],
  ["https://openalex.org/A5000000", {}, "blocked", []],
  ["https://orcid.org/0000-0002-1825-0097", {}, "blocked", []],
  ["https://www.scopus.com/authid/detail.uri?authorId=7004", {}, "blocked", []],
  ["https://www.linkedin.com/in/jane-doe", {}, "blocked", []],
  ["https://x.com/janedoe", {}, "blocked", []],
  // A social platform is not read, linked from an official page or not.
  ["https://www.facebook.com/example.lab", {}, "blocked", []],
  ["https://www.instagram.com/examplelab/", {}, "blocked", []],
  ["https://www.threads.net/@examplelab", {}, "blocked", []],
  ["https://www.threads.com/@examplelab", {}, "blocked", []],
  ["https://bsky.app/profile/examplelab.bsky.social", {}, "blocked", []],
  ["https://weibo.com/u/1234567890", {}, "blocked", []],
  // GitHub hosts real lab sites, so it stays open: such a site is read only
  // as a linked site, from an official page that links to it.
  ["https://github.com/example-lab", {}, "needs_registry_row", []],
  ["https://example-lab.github.io/", {}, "needs_registry_row", []],
  ["https://www.findaphd.com/phds/project/x/?p123", {}, "blocked", []],
  // Two directories on restricted registries. academia.edu is the sharpest:
  // it ends in .edu, so without the blocklist running first the heuristic would
  // admit every profile on it as an official page about a person.
  ["https://www.jobs.ac.uk/job/ABC123", {}, "blocked", []],
  ["https://www.academia.edu/12345/A_Paper", {}, "blocked", []],
  // A fellowship's page and its people page on a university's own .edu
  // subdomain. Neither needs a registry row: .edu is restricted.
  ["https://kempnerinstitute.harvard.edu/kempner-institute-research-fellowship/", { institution: "Harvard University" }, "official", []],
  ["https://kempnerinstitute.harvard.edu/people/our-people/", {}, "official", []],
  // people. and users. do not warn: the page this tool wants *is* the
  // institution's page for one member, so a warning on it would be noise.
  ["https://people.eecs.berkeley.edu/~someone/", {}, "official", ["personal_page_path"]],
  ["https://users.example.edu/someone/", {}, "official", []],
];

// A handful of seed rows must actually resolve, or the port silently lost them.
const SEED_SPOT_CHECKS = [
  ["https://www.mit.edu/admissions", "Massachusetts Institute of Technology"],
  ["https://graduate.cornell.edu/admissions", "Cornell University"],
  ["https://www.ox.ac.uk/admissions", "University of Oxford"],
  ["https://www.nus.edu.sg/graduate", "National University of Singapore"],
  ["https://www.unimelb.edu.au/study", "The University of Melbourne"],
  ["https://engineering.purdue.edu/graduate", "Purdue University West Lafayette"],
  ["https://www.umontreal.ca/etudes", "Université de Montréal"],
  ["https://www.uni-saarland.de/en/study", "Saarland University"],
  ["https://www.kth.se/en/studies", "KTH Royal Institute of Technology"],
  ["https://www.dtu.dk/english/education", "Technical University of Denmark"],
  ["https://www.tue.nl/en/education", "Eindhoven University of Technology"],
  // The row VUB needs ac.be in PUBLIC_HOST_SUFFIXES for: a department host that
  // serves directly rather than redirecting to the vub.be site.
  ["https://ai.vub.ac.be/education", "Vrije Universiteit Brussel"],
];

// The pieces the verdicts are built from, pinned on their own so a failure
// above says which one moved.
const HELPERS = [
  ["normalizeHost", () => normalizeHost("https://WWW.Example.EDU:8443/x?y") === "example.edu"],
  ["normalizeHost strips a trailing dot", () => normalizeHost("https://example.edu./x") === "example.edu"],
  ["registrableLabel under a one-label suffix", () => registrableLabel("gradschool.example.edu") === "example"],
  ["registrableLabel under a two-label suffix", () => registrableLabel("cs.exeter.ac.uk") === "exeter"],
  ["registrableLabel under ac.be", () => registrableLabel("ai.vub.ac.be") === "vub"],
  // validate researchers compares two hosts by this to hold a contact address
  // to the institution the row was read from.
  ["registrableDomain under a one-label suffix", () => registrableDomain("kempnerinstitute.harvard.edu") === "harvard.edu"],
  ["registrableDomain under a two-label suffix", () => registrableDomain("cs.exeter.ac.uk") === "exeter.ac.uk"],
  ["isBarePublicSuffix rejects ac.uk", () => isBarePublicSuffix("ac.uk") === true],
  ["isBarePublicSuffix rejects ac.cn and ac.il", () => isBarePublicSuffix("ac.cn") && isBarePublicSuffix("ac.il")],
  ["registrableDomain under ac.cn", () => registrableDomain("www.iphy.ac.cn") === "iphy.ac.cn"],
  ["isBarePublicSuffix rejects a dotless host", () => isBarePublicSuffix("edu") === true],
  ["isBarePublicSuffix admits a real domain", () => isBarePublicSuffix("exeter.ac.uk") === false],
  ["domainExplainedByName: acronym", () => domainExplainedByName("Massachusetts Institute of Technology", "mit.edu") === true],
  ["domainExplainedByName: acronym with a stopword dropped", () => domainExplainedByName("University of British Columbia", "ubc.ca") === true],
  ["domainExplainedByName: the distinctive token", () => domainExplainedByName("University of Exeter", "exeter.ac.uk") === true],
  ["domainExplainedByName: containing is not being", () => domainExplainedByName("University of Toronto", "toronto-admissions-agency.ca") === false],
  ["domainExplainedByName: an unrelated name", () => domainExplainedByName("Riverton College", "example.edu") === false],
  // An institute on its university's domain: the label under .edu is
  // `harvard`, so the institute's own subdomain is explained by the
  // university's name and earns no warning.
  ["domainExplainedByName: an institute on its university's domain", () => domainExplainedByName("Harvard University", "kempnerinstitute.harvard.edu") === true],
];

function main() {
  let checked = 0;
  for (const [label, check] of HELPERS) {
    assert(check() === true, `helper: ${label}`);
    checked += 1;
  }
  const blocks = [["host rules", HOST_RULE_CASES], ["registries", REGISTRY_CASES], ["people", PEOPLE_CASES]];
  for (const [label, cases] of blocks) {
    for (const [url, options, expectedVerdict, expectedWarnings] of cases) {
      const result = gateUrl(url, { ...options, registry });
      assert(result.verdict === expectedVerdict,
        `${label}: ${url || "(empty)"} must be ${expectedVerdict}, got ${result.verdict} (${result.reason})`);
      assert(typeof result.reason === "string" && result.reason.trim() !== "",
        `${label}: ${url || "(empty)"} returned a verdict with no reason`);
      const codes = result.warnings.map((warning) => warning.code).sort();
      assert(codes.join(",") === [...expectedWarnings].sort().join(","),
        `${label}: ${url} must warn [${expectedWarnings.join(", ")}], got [${codes.join(", ")}]`);
      checked += 1;
    }
  }
  for (const [url, institution] of SEED_SPOT_CHECKS) {
    const result = gateUrl(url, { registry });
    assert(result.verdict === "official" && result.match === "registry" && result.institution === institution,
      `seed spot check: ${url} must resolve to ${institution} through the registry, got ${result.verdict}/${result.match}/${result.institution}`);
    checked += 1;
  }
  checkRegistryRowTemplate();
  checked += 1;
  console.log(`Gate verifies (${checked} cases: ${HELPERS.length} helpers, ${HOST_RULE_CASES.length + REGISTRY_CASES.length + PEOPLE_CASES.length} URLs, ${SEED_SPOT_CHECKS.length} seed rows)`);
}

// The row the gate hands back on `needs_registry_row` must be a row the
// institutions guard would accept once its placeholders are filled, or the
// registry row flow would produce a file that fails validate.
function checkRegistryRowTemplate() {
  // This one goes through the CLI, which reads both registry halves the way the
  // real command does, so the host must be one no row will ever claim.
  const { payload } = runGate({ url: "https://www.some-university.nl/en/people" });
  assert(payload.registry_row_template, "needs_registry_row must hand back a registry row template");
  const data = loadYaml(payload.registry_row_template, "registry row template");
  const row = data.institutions[0];
  assert(row.official_domains[0] === "some-university.nl", `the template must carry the host it gated, got ${row.official_domains[0]}`);
  // A run writes the row itself once validate passes, so the agent vouches for it.
  assert(row.source === "discovered" && row.confirmed_by === "agent", "a template row is discovered and confirmed_by agent");
  assert(Object.keys(row).join(",") === "name,country,aliases,official_domains,ror_id,source,retrieved_at,confirmed_by",
    `the template must use the canonical key order, got ${Object.keys(row).join(",")}`);
  // Filled in the way the mode asks, it validates.
  row.name = "Some University";
  row.country = "Netherlands";
  const findings = validateInstitutions(data, { label: "registry row template", layer: "local" });
  assert(findings.problems.length === 0,
    `a filled template must validate: ${findings.problems.map((p) => `${p.field}: ${p.message}`).join("; ")}`);
  assert(runGate({ url: "https://mit.edu/x" }).payload.registry_row_template === undefined,
    "an official host must not be handed a registry row template");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`verify:gate failed: ${message}`);
    process.exit(1);
  }
}

main();
