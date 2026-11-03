// Where an applicant's files live, which applicant and which fellowship a
// command is acting for, and the rule that no path a command is handed escapes
// this repository.
//
// A workspace is `applicants/{applicant-id}/`: the profile, which serves every
// fellowship, and one folder per fellowship, `{fellowship-id}/`, holding the
// brief and every report written for it. The folder's name is the
// fellowship record's id, so the join between an application and its rules is
// the path.
//
// No workspace is excluded from selection. None ships with the repository, so
// every one in a clone is the applicant's own, and excluding one would hide a
// real application.
//
// `resolveUnderRepoRoot` takes no root parameter. This repository is
// standalone, which leaves it exactly one root, and a parameter with one
// possible value is an option for a decision already refused.
const fs = require("fs");
const path = require("path");
const { loadYamlFile } = require("./yaml");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const REAL_ROOT = fs.realpathSync(REPO_ROOT);

// Each report kind, its directory, and the dated filename its mode writes
// (DATA_CONTRACT.md -> Reports). `doctor` walks this table; nothing else
// hardcodes a report path.
//
// A report is two files under one name: the prose in the kind's directory, and
// the machine record the guards read, as `.yml` in `machine/`. The two
// pair by name alone, so no guard reads a report's prose to find its record.
const MACHINE_DIR = "machine";
const REPORT_KINDS = [
  { kind: "pool", dir: "pool", suffix: "pool", mode: "list" },
  { kind: "summaries", dir: "summaries", suffix: "summaries", mode: "summarize" },
  { kind: "recommendation", dir: "recommendations", suffix: "recommendation", mode: "recommend" },
];

// Applicant ids and fellowship ids are both path segments this repository
// builds paths from, so both go through here. An id starts with a letter or a
// digit, so `.history/`, where a replaced file is kept, is never one.
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function isSafeId(value) {
  return typeof value === "string" && SAFE_ID.test(value) && !value.includes("..");
}

function assertSafeId(value, what) {
  if (!isSafeId(value)) {
    throw new Error(`Invalid ${what}: ${JSON.stringify(value)}; ids are path-safe strings`);
  }
}

function applicantsDir() {
  return path.join(REPO_ROOT, "applicants");
}

// The directories under `dir` whose names are ids: the workspaces under
// `applicants/`, or the fellowship folders in a workspace. The flat
// `*.example.*` files and `profile.yml` are skipped because they are files, and
// `.history/` because its name is not an id.
function listFolders(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isSafeId(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function listApplicants() {
  return listFolders(applicantsDir());
}

function listFellowships(applicantId) {
  return listFolders(workspacePaths(applicantId).root);
}

// `config.yml` when the applicant has one, otherwise the committed example,
// with which file was read. The router says aloud which one it used.
function loadConfig() {
  const live = path.join(REPO_ROOT, "config.yml");
  const example = path.join(REPO_ROOT, "config.example.yml");
  const file = fs.existsSync(live) ? live : example;
  let data = {};
  let problem = null;
  try {
    const loaded = loadYamlFile(file, rel(REPO_ROOT, file));
    if (loaded && typeof loaded === "object" && !Array.isArray(loaded)) data = loaded;
    else problem = `${rel(REPO_ROOT, file)}: must parse to a mapping`;
  } catch (error) {
    problem = error.message;
  }
  return { file: rel(REPO_ROOT, file), data, problem };
}

// The order `.agents/skills/mentor-match/SKILL.md` -> Applicant Selection
// states: the flag, then the only existing workspace, then `config.yml`
// `default_applicant`, then nothing and the caller asks.
function resolveApplicant(options = {}) {
  const applicants = listApplicants();
  const warnings = [];
  if (options.applicant) {
    assertSafeId(options.applicant, "applicant id");
    if (!applicants.includes(options.applicant)) {
      warnings.push(`applicants/${options.applicant}/ does not exist yet`);
    }
    return { applicantId: options.applicant, source: "flag", applicants, warnings };
  }
  if (applicants.length === 1) {
    return { applicantId: applicants[0], source: "only_workspace", applicants, warnings };
  }
  const config = options.config || loadConfig().data;
  const fallback = config && config.default_applicant;
  if (fallback) {
    assertSafeId(String(fallback), "applicant id");
    if (!applicants.includes(String(fallback))) {
      warnings.push(`config default_applicant is ${fallback} but applicants/${fallback}/ does not exist`);
    }
    return { applicantId: String(fallback), source: "default_applicant", applicants, warnings };
  }
  if (applicants.length === 0) {
    return { applicantId: null, source: "none", applicants, warnings };
  }
  warnings.push(`${applicants.length} workspaces exist and no default_applicant is set; pass --applicant <id>`);
  return { applicantId: null, source: "ambiguous", applicants, warnings };
}

// The fellowship folder a command acts in: the flag, then the only folder
// there is, then nothing and the caller asks. There is no configured
// default, because which application a session is for is the applicant's to
// say, and a second folder is exactly when a guess would write into the wrong
// one.
function resolveFellowship(applicantId, options = {}) {
  const fellowships = applicantId ? listFellowships(applicantId) : [];
  const warnings = [];
  if (options.fellowship) {
    assertSafeId(options.fellowship, "fellowship id");
    if (!fellowships.includes(options.fellowship)) {
      warnings.push(`applicants/${applicantId}/${options.fellowship}/ does not exist yet`);
    }
    return { fellowshipId: options.fellowship, source: "flag", fellowships, warnings };
  }
  if (fellowships.length === 1) {
    return { fellowshipId: fellowships[0], source: "only_folder", fellowships, warnings };
  }
  if (fellowships.length === 0) {
    return { fellowshipId: null, source: "none", fellowships, warnings };
  }
  warnings.push(`${fellowships.length} fellowship folders exist in applicants/${applicantId}/; pass --fellowship <id>`);
  return { fellowshipId: null, source: "ambiguous", fellowships, warnings };
}

function workspacePaths(applicantId) {
  assertSafeId(applicantId, "applicant id");
  const root = path.join(applicantsDir(), applicantId);
  return { applicantId, root, profilePath: path.join(root, "profile.yml") };
}

function applicationPaths(applicantId, fellowshipId) {
  assertSafeId(fellowshipId, "fellowship id");
  const root = path.join(workspacePaths(applicantId).root, fellowshipId);
  return { root, briefPath: path.join(root, "brief.md"), machineDir: path.join(root, MACHINE_DIR) };
}

// The report and the machine record a file handed to a guard belongs to. In a
// fellowship folder the report sits in its kind's directory and the record in
// `machine/`, and `workspace` says so; anywhere else, the fixtures under
// examples/ among them, the two sit side by side. Either file may be the one
// handed over, and neither is opened here. `location` is what
// `workspaceForPath` read off the path.
function reportPair(kindEntry, resolved, location) {
  const ext = path.extname(resolved);
  const name = path.basename(resolved, ext);
  if (location && location.fellowshipId) {
    const { root, machineDir } = applicationPaths(location.applicantId, location.fellowshipId);
    const reportDir = path.join(root, kindEntry.dir);
    if (path.dirname(resolved) === (ext === ".yml" ? machineDir : reportDir)) {
      return { workspace: true, report: path.join(reportDir, `${name}.md`), record: path.join(machineDir, `${name}.yml`) };
    }
  }
  const dir = path.dirname(resolved);
  return { workspace: false, report: path.join(dir, `${name}.md`), record: path.join(dir, `${name}.yml`) };
}

// A fellowship record lives at the repository root rather than in a workspace,
// because two applicants in one clone applying to the same fellowship read the
// same published rules. A fellowship folder is named for the record's id.
function fellowshipPath(fellowshipId) {
  assertSafeId(fellowshipId, "fellowship id");
  return path.join(REPO_ROOT, "fellowships", `${fellowshipId}.yml`);
}

// The newest dated machine record of one kind, the report beside it, and what
// the naming convention does not cover. Pipeline position is read off
// `machine/`, which is what the guards read, never off a report's prose.
// Only `YYYY-MM-DD-<suffix>.yml` there and `YYYY-MM-DD-<suffix>.md` in the
// kind's directory count, so a hand-renamed file is reported rather than
// silently picked up. A dated report with no record beside it is returned as
// `unpaired`, for `validate` to refuse.
function latestReport(applicantId, fellowshipId, kindEntry) {
  const paths = applicationPaths(applicantId, fellowshipId);
  const reportDir = path.join(paths.root, kindEntry.dir);
  const result = { path: null, report: null, date: null, strays: [], unpaired: [] };
  const dated = (dir, ext) => {
    if (!fs.existsSync(dir)) return [];
    const pattern = new RegExp(`^(\\d{4}-\\d{2}-\\d{2})-${kindEntry.suffix}\\.${ext}$`);
    return fs.readdirSync(dir).sort().map((name) => ({ name, match: pattern.exec(name) }));
  };
  const records = dated(paths.machineDir, "yml").filter((entry) => entry.match);
  for (const { name, match } of dated(reportDir, "md")) {
    if (!match) {
      if (name.endsWith(".md")) result.strays.push(rel(REPO_ROOT, path.join(reportDir, name)));
    } else if (!records.some((entry) => entry.match[1] === match[1])) {
      result.unpaired.push(rel(REPO_ROOT, path.join(reportDir, name)));
    }
  }
  if (records.length > 0) {
    const newest = records[records.length - 1];
    const report = path.join(reportDir, newest.name.replace(/\.yml$/, ".md"));
    result.path = rel(REPO_ROOT, path.join(paths.machineDir, newest.name));
    result.report = fs.existsSync(report) ? rel(REPO_ROOT, report) : null;
    result.date = newest.match[1];
  }
  return result;
}

// The applicant id and the fellowship id a path implies, so `validate` can
// check a file against the workspace and the folder it sits in without being
// told. A segment is a fellowship folder only when something sits inside it:
// `profile.yml` is the workspace's own, and `.history/` is no folder's.
function workspaceForPath(filePath) {
  const resolved = path.resolve(filePath);
  const relative = path.relative(applicantsDir(), resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  const [applicantId, folder, ...rest] = relative.split(path.sep);
  if (!applicantId || applicantId.includes(".")) return null;
  return { applicantId, fellowshipId: rest.length > 0 && isSafeId(folder) ? folder : null };
}

// A path a command was handed, resolved and proved to be inside this
// repository, or an error naming what was refused. This is the runtime half of
// the standalone decision: `verify:layout` scans what the source *references*,
// and this is what holds for a path the applicant types. Every command
// that opens a file the applicant named goes through here.
//
// A path that exists is judged by where it really is, links followed, against
// the root's own real path -- so a link inside the tree cannot hand a guard a
// file outside it, and a repository reached through a linked parent (macOS's
// /tmp is one) still contains itself. A path that does not
// exist is judged as written; nothing is opened at it.
function resolveUnderRepoRoot(value, label) {
  const resolved = path.isAbsolute(value) ? path.resolve(value) : path.resolve(REPO_ROOT, value);
  const [target, root] = fs.existsSync(resolved) ? [fs.realpathSync(resolved), REAL_ROOT] : [resolved, REPO_ROOT];
  if (target !== root && !isInside(target, root)) {
    throw new Error(`Refusing ${label} outside this repository: ${target === resolved ? resolved : `${resolved}, which is a link to ${target}`}`);
  }
  return resolved;
}

function isInside(value, root) {
  const relative = path.relative(root, value);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function rel(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

module.exports = {
  MACHINE_DIR,
  REPORT_KINDS,
  REPO_ROOT,
  applicationPaths,
  assertSafeId,
  fellowshipPath,
  latestReport,
  listApplicants,
  listFellowships,
  loadConfig,
  rel,
  reportPair,
  resolveApplicant,
  resolveFellowship,
  resolveUnderRepoRoot,
  workspaceForPath,
  workspacePaths,
};
