// The two things that are only true at runtime: that no path a command is
// handed escapes this repository, and that the files the modes actually
// produced still pass their own guards.
//
// The first half runs everywhere. It is the runtime side of the standalone
// rule: `verify:layout` scans what the source *references*, and containment of
// a path the applicant types belongs here, because a source scan never sees an
// argument.
//
// The second half has nothing to check in a fresh clone, and says so rather
// than passing silently. An applicant's workspace is their own real
// application, so `applicants/` is gitignored and no workspace ships; a fresh
// clone, CI, and the public tree all find none. Failing there would break a
// fresh clone's `npm run verify`, and passing quietly would let a real
// workspace rot unnoticed. So it skips out loud, and the thinner guarantee --
// a workspace is checked only on the machine that holds it -- is accepted.
const fs = require("fs");
const path = require("path");
const {
  REPO_ROOT, REPORT_KINDS, applicationPaths, assertSafeId, listApplicants, listFellowships, resolveFellowship, resolveUnderRepoRoot,
  workspaceForPath, workspacePaths,
} = require("../lib/workspace");
const { SUPPORTED_KINDS } = require("../lib/schema");
const { validateFile } = require("../cli/validate");
const { runDoctor } = require("../cli/doctor");

function main() {
  const contained = checkContainment();
  const applicants = listApplicants();
  // The facts layer is runtime state too, gitignored like the workspaces: the
  // pools that name its rows are only as sound as the rows are.
  const researchers = path.join(REPO_ROOT, "registry", "researchers.yml");
  const registryFiles = fs.existsSync(researchers) ? check("researchers", researchers, null) : 0;

  if (applicants.length === 0) {
    console.log(`Generated workspaces verify: ${contained} containment checks; no workspace under applicants/, so nothing was re-validated (applicants/ is gitignored, so only a clone holding a real workspace has one to check)`);
    return;
  }

  let files = registryFiles;
  let folders = 0;
  const notStarted = [];
  for (const applicantId of applicants) {
    const paths = workspacePaths(applicantId);
    const fellowships = listFellowships(applicantId);
    // `brief` tells the applicant to put a CV in their folder before it runs,
    // and writes the profile before any fellowship folder. A folder holding
    // only what the applicant put there has nothing generated to check, so it
    // is named and skipped; one with an application and no profile still fails.
    if (!fs.existsSync(paths.profilePath) && fellowships.length === 0) {
      notStarted.push(`applicants/${applicantId}/`);
      continue;
    }
    assert(fs.existsSync(paths.profilePath), `applicants/${applicantId}/ has no profile.yml`);
    files += check("profile", paths.profilePath, applicantId);

    const report = runDoctor({ applicant: applicantId });
    assert(report.applicant === applicantId, `doctor did not select ${applicantId}`);
    assert(report.profile === `applicants/${applicantId}/profile.yml`, `doctor did not find applicants/${applicantId}/profile.yml`);
    assert(JSON.stringify(report.applications.map((entry) => entry.fellowship_id)) === JSON.stringify(fellowships),
      `doctor reports applications ${report.applications.map((entry) => entry.fellowship_id).join(", ")} for applicants/${applicantId}/, which holds ${fellowships.join(", ")}`);

    // Each fellowship folder is an application of its own: its record,
    // its brief, and every report and machine record, each validated as itself.
    // A report with no record and a record with no report are both refused
    // there. `.history/` holds what a write replaced and is skipped.
    for (const fellowshipId of fellowships) {
      const folder = applicationPaths(applicantId, fellowshipId);
      const where = `applicants/${applicantId}/${fellowshipId}`;
      const application = report.applications.find((entry) => entry.fellowship_id === fellowshipId);
      assert(application.fellowship === `fellowships/${fellowshipId}.yml`, `${where}/ has no fellowship record doctor can open`);
      files += check("fellowship", path.join(REPO_ROOT, application.fellowship), applicantId);
      if (fs.existsSync(folder.briefPath)) files += check("brief", folder.briefPath, applicantId);
      for (const kindEntry of REPORT_KINDS) {
        const dir = path.join(folder.root, kindEntry.dir);
        if (!fs.existsSync(dir)) continue;
        for (const name of fs.readdirSync(dir).sort()) {
          if (!name.endsWith(".md")) continue;
          assert(new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${kindEntry.suffix}\\.md$`).test(name),
            `${where}/${kindEntry.dir}/${name} does not follow YYYY-MM-DD-${kindEntry.suffix}.md, so doctor would ignore it`);
          if (!SUPPORTED_KINDS.includes(kindEntry.kind)) continue;
          files += check(kindEntry.kind, path.join(dir, name), applicantId);
        }
      }
      if (fs.existsSync(folder.machineDir)) {
        for (const name of fs.readdirSync(folder.machineDir).sort()) {
          if (name === ".history") continue;
          const kindEntry = REPORT_KINDS.find((entry) => new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${entry.suffix}\\.yml$`).test(name));
          assert(kindEntry, `${where}/machine/${name} is not a machine record any report kind names, so doctor would ignore it`);
          if (!SUPPORTED_KINDS.includes(kindEntry.kind)) continue;
          files += check(kindEntry.kind, path.join(folder.machineDir, name), applicantId);
        }
      }
      assert(typeof application.next_step_reason === "string" && application.next_step_reason !== "", `doctor gave ${where}/ no next-step reason`);
      folders += 1;
    }

    const failing = report.validation.filter((entry) => !entry.ok);
    assert(failing.length === 0, `doctor re-validation failed for ${applicantId}: ${failing.map((entry) => entry.file).join(", ")}`);
    assert(typeof report.next_step_reason === "string" && report.next_step_reason !== "", `doctor gave ${applicantId} no next-step reason`);
  }

  const skipped = notStarted.length === 0 ? "" : `; ${notStarted.join(", ")} skipped: no profile and no application yet, so brief has not run there`;
  console.log(`Generated workspaces verify: ${contained} containment checks, ${applicants.length - notStarted.length} workspace(s), ${folders} fellowship folder(s), ${files} file(s) re-validated, doctor agrees${skipped}`);
}

// No id may escape its directory, and no path a command is handed may escape
// the repository. Both hold with no workspace present, which is why they run
// before the skip.
function checkContainment() {
  let checked = 0;
  for (const bad of ["../escape", "..", "a/b", "", ".hidden", ".history", "-x"]) {
    throws(() => assertSafeId(bad, "applicant id"), `assertSafeId accepted ${JSON.stringify(bad)}`);
    // The fellowship segment is the second id a path is built from, and
    // the flag that names it is typed by the applicant.
    throws(() => resolveFellowship("demo", { fellowship: bad || "-" }), `resolveFellowship accepted ${JSON.stringify(bad)}`);
    checked += 2;
  }
  const at = (value) => JSON.stringify(workspaceForPath(value));
  for (const [value, expected] of [
    ["applicants/demo/profile.yml", { applicantId: "demo", fellowshipId: null }],
    ["applicants/demo/a-fellowship/brief.md", { applicantId: "demo", fellowshipId: "a-fellowship" }],
    ["applicants/demo/a-fellowship/machine/2026-09-23-pool.yml", { applicantId: "demo", fellowshipId: "a-fellowship" }],
    // A replaced profile is kept beside it, and `.history/` is no fellowship.
    ["applicants/demo/.history/profile.2026-10-22T153012.yml", { applicantId: "demo", fellowshipId: null }],
    ["applicants/demo/a-fellowship/../../../outside.yml", null],
    ["examples/brief-valid.md", null],
  ]) {
    assert(at(value) === JSON.stringify(expected), `workspaceForPath(${JSON.stringify(value)}) must be ${JSON.stringify(expected)}, not ${at(value)}`);
    checked += 1;
  }

  // A sibling checkout, a home directory, an absolute path, a parent escape and
  // a link that leads out once followed: the shapes the standalone rule exists to refuse, and the ones `verify:layout`'s source scan
  // cannot see, because they arrive as arguments rather than as literals.
  // They are read from a fixture file for the same reason -- written here they
  // would be the violations they imitate.
  const cases = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "examples", "containment-cases.json"), "utf8"));
  assert(cases.refused.length > 0 && cases.admitted.length > 0, "examples/containment-cases.json must carry both halves");
  for (const bad of cases.refused) {
    throws(() => resolveUnderRepoRoot(bad, "test"), `resolveUnderRepoRoot accepted ${JSON.stringify(bad)}`);
    checked += 1;
  }
  for (const good of cases.admitted) {
    const resolved = resolveUnderRepoRoot(good, "test");
    assert(resolved.startsWith(REPO_ROOT + path.sep), `resolveUnderRepoRoot must admit ${good}`);
    checked += 1;
  }
  // The command that takes a path from the applicant refuses one outside, and
  // reports it as a problem rather than throwing.
  const escaped = validateFile("institutions", cases.refused[2]);
  assert(!escaped.ok && escaped.problems.some((problem) => /outside this repository/.test(problem.message)),
    "validate must refuse a file outside this repository and say so");
  checked += 1;
  return checked;
}

function throws(fn, message) {
  let threw = false;
  try {
    fn();
  } catch (error) {
    threw = true;
  }
  assert(threw, message);
}

function check(kind, file, applicantId) {
  const result = validateFile(kind, file, { applicant: applicantId });
  assert(result.ok, `${result.file} does not validate as ${kind}: ${result.problems.map((p) => `${p.field}: ${p.message}`).join("; ")}`);
  return 1;
}

function assert(condition, message) {
  if (!condition) {
    console.error(`verify:generated failed: ${message}`);
    process.exit(1);
  }
}

main();
