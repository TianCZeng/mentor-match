// The official-domain gate: may a URL supply a fact about a person, or a
// fellowship's rules about who may host? The second question needs only the
// first test below: a fellowship's own page is refused when it is `blocked`,
// and the other two verdicts are about people.
//
// Three verdicts. `official`: facts read from the page may enter a record.
// `needs_registry_row`: the domain is not placed yet, and the registry row flow
// decides it. `blocked`: the page never carries a fact about a person. The
// blocklist runs first, the institution registry second, the domain-ending
// rules last.
//
// The blocklist names the profile aggregators and bibliographic indexes a run
// would otherwise take a person's identity from -- ResearchGate, Academia.edu,
// Google Scholar, ORCID, OpenAlex, Scopus. Under `AGENTS.md` -> Sources and
// Trust those are Leads and Bibliographic, and neither tier may say who someone
// is or where they work. Ranking sites are blocked too: there is no ranked
// tier, because an institution's rank says nothing about a person.
//
// `people.` and `users.` hosts earn no warning. A person's own page on their
// institution's domain is the source this tool wants, so a warning on it would
// train the caller to ignore the warnings that matter.
//
// This module is pure: it is handed registry rows and returns a verdict. The
// reading of files lives in `registry.js`, the command in `scripts/cli/gate.js`.

// Domain endings whose registry admits only educational or research
// institutions, each by its operator's own published rule: CERNET for .edu.cn,
// JPRS for .ac.jp, KISA for .ac.kr, HKIRC for .edu.hk, TWNIC and the Ministry
// of Education for .edu.tw, ERNET for .ac.in. Several also admit schools, as
// .edu admits small colleges; the blocklist above still runs first. .ac.cn and
// .ac.il are not here: CNNIC's own rules let anyone register under .cn, and
// ISOC-IL's rules could not be read.
const RESTRICTED_TLDS = [
  ".edu", ".ac.uk", ".edu.au", ".ac.nz", ".edu.sg",
  ".edu.cn", ".ac.jp", ".ac.kr", ".edu.hk", ".edu.tw", ".ac.in",
];

// Open country registries a university may use but anyone may register under.
// Membership here means: university-shaped, identity unproven.
const OPEN_COUNTRY_TLDS = [".ca"];

// Hosts that can never carry an official fact about a person or a fellowship's
// host rules. Suffix-matched on host labels, so `en.wikipedia.org` and
// `www.researchgate.net` are covered. Each entry carries why, because the
// reason is shown to the applicant.
const BLOCKED_HOSTS = [
  // Profile aggregators and bibliographic indexes. A record here may carry a
  // publication with an identifier -- that is the Bibliographic tier, read by
  // `summarize` -- but nothing here establishes who a person is, what unit they
  // are in, or what their role is. Those come from the institution's own page.
  { match: "researchgate.net", why: "a researcher profile aggregator; a lead, and never a fact about a person" },
  { match: "academia.edu", why: "a profile aggregator sitting on a restricted academic registry; a lead only, which is why the blocklist runs before the TLD rule" },
  { match: "scholar.google.com", why: "a bibliographic index; it can supply a publication record with an identifier, never who someone is or where they work" },
  { match: "semanticscholar.org", why: "a bibliographic index; a publication record, never an identity" },
  { match: "openalex.org", why: "a bibliographic index; a publication record, never an identity" },
  { match: "orcid.org", why: "a self-asserted researcher record; the institution's own page says where someone works" },
  { match: "scopus.com", why: "a bibliographic and metric database; a metric here carries its source and date, and says nothing about identity" },
  { match: "webofscience.com", why: "a bibliographic and metric database; a metric here carries its source and date, and says nothing about identity" },
  { match: "publons.com", why: "a reviewer profile aggregator; a lead at best" },
  // Social platforms and forums.
  { match: "wikipedia.org", why: "an encyclopedia; a lead at best, never a fact about a person" },
  { match: "linkedin.com", why: "a social platform; a lead at best, and a personal account is never recorded" },
  { match: "x.com", why: "a social platform; a lead at best, and a personal account is never recorded" },
  { match: "twitter.com", why: "a social platform; a lead at best, and a personal account is never recorded" },
  { match: "facebook.com", why: "a social platform; a lead at best, and a personal account is never recorded" },
  { match: "instagram.com", why: "a social platform; a lead at best, and a personal account is never recorded" },
  // Threads moved from threads.net to threads.com in 2025; the old name
  // redirects, and a link may carry either.
  { match: "threads.net", why: "a social platform; a lead at best, and a personal account is never recorded" },
  { match: "threads.com", why: "a social platform; a lead at best, and a personal account is never recorded" },
  { match: "bsky.app", why: "a social platform; a lead at best, and a personal account is never recorded" },
  { match: "weibo.com", why: "a social platform; a lead at best, and a personal account is never recorded" },
  { match: "reddit.com", why: "a forum; a lead at best" },
  { match: "quora.com", why: "a forum; a lead at best" },
  { match: "zhihu.com", why: "a forum; a lead at best" },
  { match: "xiaohongshu.com", why: "a social platform; a lead at best" },
  { match: "thegradcafe.com", why: "an applicant forum; a lead at best" },
  { match: "collegeconfidential.com", why: "an applicant forum; a lead at best" },
  // Directories and job boards. They name people and programmes; they are still
  // leads, and two of them sit on restricted registries.
  { match: "prospects.ac.uk", why: "a graduate directory on a restricted registry; leads only" },
  { match: "jobs.ac.uk", why: "an academic job board on a restricted registry; leads only" },
  { match: "academicpositions.com", why: "an academic job board; leads only" },
  { match: "mastersportal.com", why: "a programme directory; leads only" },
  { match: "bachelorsportal.com", why: "a programme directory; leads only" },
  { match: "phdportal.com", why: "a programme directory; leads only" },
  { match: "studyportals.com", why: "a programme directory; leads only" },
  { match: "findamasters.com", why: "a programme directory; leads only" },
  { match: "findaphd.com", why: "a project directory; it names supervisors, which makes it a lead and not a source" },
  { match: "gradschools.com", why: "a programme directory; leads only" },
  { match: "petersons.com", why: "a programme directory; leads only" },
  { match: "educations.com", why: "a programme directory; leads only" },
  { match: "hotcoursesabroad.com", why: "a programme directory; leads only" },
  { match: "shiksha.com", why: "an agency directory; leads only" },
  { match: "collegedunia.com", why: "an agency directory; leads only" },
  { match: "leverageedu.com", why: "an agency directory; leads only" },
  // Ranking sites. There is no ranked tier in this repository: an institution's
  // rank says nothing about a person.
  { match: "topuniversities.com", why: "a ranking site (QS); a rank is a fact about an institution and never about a person" },
  { match: "timeshighereducation.com", why: "a ranking site (THE); a rank is a fact about an institution and never about a person" },
  { match: "shanghairanking.com", why: "a ranking site (ARWU); a rank is a fact about an institution and never about a person" },
  { match: "usnews.com", why: "a ranking site; a rank is a fact about an institution and never about a person" },
  { match: "chegg.com", why: "a commercial study site; leads only" },
  { match: "coursera.org", why: "a course platform; not the institution's own page" },
  { match: "edx.org", why: "a course platform; not the institution's own page" },
];

// Search engines, proxies and caches. Their URLs wrap a target that must be
// unwrapped and gated on its own.
//
// `sites.google.com` is carved out of the Google pattern: it hosts sites and
// is no search engine, so "unwrap the target URL" was the wrong reason and the
// block refused a lab's own site that an official page links to. It falls
// through to `needs_registry_row` with the `sites.` warning, and is read only
// as a linked site; it never gets a registry row.
const BLOCKED_WRAPPERS = [
  { match: /^(?!sites\.google\.com$)(?:[a-z0-9-]+\.)*google\.(?:com|[a-z]{2}|com?\.[a-z]{2})$/, why: "a search engine; unwrap the target URL and gate that" },
  { match: "bing.com", why: "a search engine; unwrap the target URL and gate that" },
  { match: "duckduckgo.com", why: "a search engine; unwrap the target URL and gate that" },
  { match: "search.yahoo.com", why: "a search engine; unwrap the target URL and gate that" },
  { match: "baidu.com", why: "a search engine; unwrap the target URL and gate that" },
  { match: /^(?:[a-z0-9-]+\.)*yandex\.[a-z]{2,3}$/, why: "a search engine; unwrap the target URL and gate that" },
  { match: "ecosia.org", why: "a search engine; unwrap the target URL and gate that" },
  { match: "startpage.com", why: "a search engine; unwrap the target URL and gate that" },
  { match: "googleusercontent.com", why: "a cached copy; gate and read the live page" },
  { match: "archive.org", why: "an archived snapshot; an official fact says what the page says on the day it was read" },
  { match: "r.jina.ai", why: "a fetch proxy; gate and read the origin host" },
  { match: "12ft.io", why: "a paywall proxy; gate and read the origin host" },
];

// Registrable public suffixes that must never be stored as an official domain:
// the match below is a dot-boundary parent match, so a bare suffix would
// blanket-admit every host under it. Single-label suffixes (`edu`, `uk`, `de`)
// are covered by the no-dot rule instead. `ac.be` is doing two jobs: keeping the bare
// suffix out of the registry, and letting `registrableLabel` see `vub` rather
// than `ac`.
const PUBLIC_HOST_SUFFIXES = new Set([
  "ac.be", "ac.cn", "ac.il", "ac.in", "ac.jp", "ac.kr", "ac.nz", "ac.uk",
  "co.in", "co.jp", "co.kr", "co.nz", "co.uk",
  "com.au", "com.cn", "com.hk", "com.sg", "com.tw",
  "edu.au", "edu.cn", "edu.hk", "edu.in", "edu.sg", "edu.tw",
  "go.jp", "go.kr",
  "gov.au", "gov.cn", "gov.hk", "gov.in", "gov.sg", "gov.tw", "gov.uk", "govt.nz",
  "ne.jp", "or.jp", "org.au", "org.uk",
]);

const NAME_STOPWORDS = new Set(["a", "an", "and", "at", "for", "in", "of", "the"]);

// Host shapes that usually mean an informally hosted page on an otherwise
// official domain. They do not change the verdict; they tell the agent to
// confirm the page is the institution's own publication about this person
// rather than something a member wrote about themselves elsewhere.
const INFORMAL_HOST_PREFIXES = ["blogs.", "blog.", "sites.", "wiki."];

function normalizeHost(value) {
  if (!value) return null;
  const raw = String(value).trim();
  let host = null;
  try {
    host = new URL(raw).hostname;
  } catch (error) {
    host = raw.split(/[/?#]/)[0];
  }
  if (!host) return null;
  host = host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  return host || null;
}

function isBarePublicSuffix(domain) {
  const host = normalizeHost(domain);
  if (!host) return true;
  return !host.includes(".") || PUBLIC_HOST_SUFFIXES.has(host);
}

function nameTokens(name) {
  return normalizeText(name)
    .split(" ")
    .filter((token) => token && !NAME_STOPWORDS.has(token));
}

// The gate runs *before* the page is fetched, so the only text is the address.
// Against page text, "at least two non-stopword tokens of the name" is a
// reasonable bar; against an address it both misses and over-admits: "University of Exeter" matches one token of
// `exeter.ac.uk` and would fail, while "University of Toronto" matches
// `toronto-admissions-agency.ca` and would pass.
//
// So the URL-time rule asks a different question: is the registrable label *the
// institution's name*, rather than merely containing it? Every part of the
// label must be explained by the name -- a token of it, a prefix of a token, or
// its acronym. `ubc` is explained by University of British Columbia, `mit` by
// Massachusetts Institute of Technology, `exeter` by University of Exeter;
// `toronto-admissions-agency` is not.
function domainExplainedByName(institutionName, host) {
  const label = registrableLabel(host);
  if (!label || !institutionName) return false;
  const all = normalizeText(institutionName).split(" ").filter(Boolean);
  if (all.length === 0) return false;
  const distinctive = nameTokens(institutionName);
  const acronyms = new Set([all, distinctive]
    .filter((tokens) => tokens.length > 1)
    .map((tokens) => tokens.map((token) => token[0]).join("")));
  const parts = label.split(/[^a-z0-9]+/).filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every((part) =>
    acronyms.has(part) ||
    all.some((token) => token === part || (part.length >= 4 && (token.startsWith(part) || part.startsWith(token)))));
}

// Support for the institution from the URL alone: the domain is the name, or
// the name is spelled out somewhere in the address.
function urlSupportsInstitution(institutionName, host, pathname) {
  if (!institutionName) return false;
  if (domainExplainedByName(institutionName, host)) return true;
  const name = normalizeText(institutionName);
  return Boolean(name) && normalizeText(`${host} ${pathname || ""}`).includes(name);
}

// The domain a host is registered under -- `harvard.edu` for
// `kempnerinstitute.harvard.edu` -- counting the suffix as two labels when it
// is one of PUBLIC_HOST_SUFFIXES. `validate researchers` reads it to tell
// whether a contact address sits at the same institution as the page the row
// was read from.
function registrableDomain(host) {
  const labels = normalizeHost(host)?.split(".") || [];
  if (labels.length < 2) return null;
  const twoLabelSuffix = PUBLIC_HOST_SUFFIXES.has(labels.slice(-2).join("."));
  const index = labels.length - (twoLabelSuffix ? 3 : 2);
  return index >= 0 ? labels.slice(index).join(".") : null;
}

function registrableLabel(host) {
  return registrableDomain(host)?.split(".")[0] || null;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.join(" ") || "";
}

// Named hosts before wrappers. Every verdict is the same either way -- both lists return `blocked` -- but the reason is
// not: `scholar.google.com` matches the Google wrapper pattern, and telling the
// caller to "unwrap the target URL" is wrong advice for a bibliographic index.
function blockedEntry(host) {
  for (const entry of [...BLOCKED_HOSTS, ...BLOCKED_WRAPPERS]) {
    if (typeof entry.match === "string") {
      if (host === entry.match || host.endsWith(`.${entry.match}`)) return entry;
    } else if (entry.match.test(host)) {
      return entry;
    }
  }
  return null;
}

// The verdict for one URL. `registry` is the array of institution rows from
// `registry.js` (seed plus local, read as one list). Returns
// { url, host, verdict, reason, warnings[], match, institution }.
function gateUrl(url, options = {}) {
  const registry = options.registry || [];
  const warnings = [];
  const raw = String(url || "").trim();
  const verdict = (name, reason, extra = {}) => ({
    url: raw, host: extra.host ?? null, verdict: name, reason,
    match: extra.match ?? null, institution: extra.institution ?? null, warnings,
  });

  if (!raw) return verdict("blocked", "no URL given");

  let parsed = null;
  try {
    parsed = new URL(raw);
  } catch (error) {
    return verdict("blocked", `not a URL the gate can parse (${raw}); gate the full https:// address`);
  }
  const host = normalizeHost(raw);
  if (!host) return verdict("blocked", "URL has no parseable host");

  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  if (scheme !== "https") {
    return verdict("blocked", `${scheme || "missing"} scheme; an official claim must be served over HTTPS`, { host });
  }

  // Before the TLD heuristics on purpose: prospects.ac.uk, jobs.ac.uk and
  // academia.edu are all directories sitting on restricted registries, and the
  // heuristic would admit every one of them.
  const blocked = blockedEntry(host);
  if (blocked) {
    return verdict("blocked", `${host} is ${blocked.why}`, { host });
  }

  addInformalWarnings(host, parsed, warnings);

  const row = registryRowForHost(host, registry);
  if (row) {
    return verdict("official", `${host} is a known domain of ${row.name} in the institution registry`, {
      host, match: "registry", institution: row.name,
    });
  }

  const institution = options.institution || null;

  if (endsWithAny(host, RESTRICTED_TLDS)) {
    if (institution && !urlSupportsInstitution(institution, host, parsed.pathname)) {
      warnings.push({
        code: "institution_unconfirmed_by_url",
        message: `the domain does not spell out ${institution}; this registry admits only educational and research institutions but does not say which one, so confirm the institution on the page itself before recording a fact`,
      });
    }
    return verdict("official", `${host} sits under ${matchedSuffix(host, RESTRICTED_TLDS)}, a registry restricted to educational and research institutions`, {
      host, match: "restricted_tld", institution: institution || null,
    });
  }

  if (endsWithAny(host, OPEN_COUNTRY_TLDS)) {
    const suffix = matchedSuffix(host, OPEN_COUNTRY_TLDS);
    if (institution && urlSupportsInstitution(institution, host, parsed.pathname)) {
      return verdict("official", `${host} sits under ${suffix}, an open registry, and ${host} is the domain name of ${institution}`, {
        host, match: "open_tld_name_supported", institution,
      });
    }
    return verdict("needs_registry_row", institution
      ? `${host} sits under ${suffix}, which anyone may register, and the domain is not the name of ${institution}; confirm the institution's official domain and append a registry row`
      : `${host} sits under ${suffix}, which anyone may register; pass --institution "<name>" or confirm the domain and append a registry row`, {
      host, match: "open_tld_unsupported", institution: institution || null,
    });
  }

  return verdict("needs_registry_row",
    `${host} is not in the institution registry and sits under no restricted academic registry; tie the domain to the institution from outside it and append a registry row`,
    { host, match: null, institution: institution || null });
}

function registryRowForHost(host, registry) {
  let best = null;
  for (const row of registry) {
    const domains = (row && row.official_domains) || [];
    for (const domain of domains) {
      const normalized = normalizeHost(domain);
      if (!normalized || isBarePublicSuffix(normalized)) continue;
      if (host === normalized || host.endsWith(`.${normalized}`)) {
        // Longest domain wins, so a faculty domain beats a shorter parent.
        if (!best || normalized.length > best.domainLength) best = { ...row, domainLength: normalized.length };
      }
    }
  }
  return best;
}

function addInformalWarnings(host, parsed, warnings) {
  const pathname = parsed.pathname || "";
  if (pathname.includes("/~")) {
    warnings.push({ code: "personal_page_path", message: `the path ${pathname} is a personal directory on this host; it may be the institution's published page for this person, and it may be something they host there themselves, so read the page for the role title and unit rather than assuming either` });
  }
  const prefix = INFORMAL_HOST_PREFIXES.find((item) => host.startsWith(item));
  if (prefix) {
    warnings.push({ code: "informal_subdomain", message: `${host} starts with "${prefix}", which usually hosts member-written pages; confirm this is the institution's own page for this person` });
  }
}

function endsWithAny(host, suffixes) {
  return suffixes.some((suffix) => host.endsWith(suffix));
}

function matchedSuffix(host, suffixes) {
  return suffixes.find((suffix) => host.endsWith(suffix)) || null;
}

module.exports = {
  PUBLIC_HOST_SUFFIXES,
  domainExplainedByName,
  gateUrl,
  isBarePublicSuffix,
  normalizeHost,
  registrableDomain,
  registrableLabel,
};
