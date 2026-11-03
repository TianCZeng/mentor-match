#!/usr/bin/env node
// doctor [--applicant <id>] [--fellowship <id>] [--json]
//
// What the router reads on the first message of a session: which applicant is
// selected, which files exist, which guards are installed, whether the latest
// file of each kind still validates, and the one next step. `next_step` comes
// from the fixed table in `nextStep()` over those facts -- file existence and
// the `host_requirement` a fellowship record states -- never from the prose of
// a report and never from the agent's judgement. A report's pipeline position
// is its machine record under `machine/`; `latest` names the record, and
// `modes[].file` the report beside it, which is what the applicant opens.
//
// A workspace holds one folder per fellowship, and each is an
// application with its own position. `applications[]` carries every folder's
// next step; the top-level fields are the selected one's, chosen by
// `--fellowship` or because there is only one. With two and no flag, nothing
// is selected and the next step is to ask which.
const fs = require("fs");
const path = require("path");
const {
  MACHINE_DIR, REPO_ROOT, REPORT_KINDS, applicationPaths, fellowshipPath, latestReport, loadConfig, rel, resolveApplicant,
  resolveFellowship, workspacePaths,
} = require("../lib/workspace");
const { parseArgs } = require("../lib/args");
const { loadYamlFile } = require("../lib/yaml");
const { SUPPORTED_KINDS } = require("../lib/schema");
const { validateFile } = require("./validate");

const ARGS = { flags: ["json"], values: ["applicant", "fellowship"] };

// Each mode, and what has to exist for it to be more than a contract. A mode
// whose guard is missing is shown as not built yet and is never offered as a
// step the applicant can take.
//
// `brief` is the only mode with three outputs, so it is the only one whose
// `done` is not one file: the fellowship record, the profile and the project
// brief are read by every later mode, and two of the three is not a start.
const MODES = [
  { mode: "brief", requires: { validateKind: "fellowship", cli: "gate.js" } },
  { mode: "list", kind: "pool", requires: { validateKind: "pool" } },
  { mode: "summarize", kind: "summaries", requires: { validateKind: "summaries" } },
  { mode: "recommend", kind: "recommendation", requires: { validateKind: "recommendation" } },
];

const REPORT_NAME = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-(${REPORT_KINDS.map((entry) => entry.suffix).join("|")})\\.yml$`);

function main(argv) {
  let options;
  try {
    options = parseArgs(argv, ARGS);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log("Usage: node scripts/cli/doctor.js [--applicant <id>] [--fellowship <id>] [--json]");
    return;
  }
  const report = runDoctor(options);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else printReport(report);
  process.exitCode = 0;
}

function runDoctor(options = {}) {
  const warnings = [];
  const config = loadConfig();
  if (config.problem) warnings.push(config.problem);

  let selection;
  try {
    selection = resolveApplicant({ applicant: options.applicant, config: config.data });
  } catch (error) {
    selection = { applicantId: null, source: "invalid", applicants: [], warnings: [error.message] };
  }
  warnings.push(...selection.warnings);

  const guards = installedGuards();
  const modeState = MODES.map((entry) => ({ ...entry, built: isBuilt(entry.requires, guards) }));

  const report = {
    applicant: selection.applicantId,
    applicant_source: selection.source,
    applicants: selection.applicants,
    config_file: config.file,
    profile: null,
    fellowships: [],
    fellowship_source: null,
    fellowship_id: null,
    fellowship: null,
    host_requirement: null,
    brief: null,
    latest: { pool: null, summaries: null, recommendation: null },
    applications: [],
    guards_installed: guards.commands,
    validate_kinds: guards.validateKinds,
    modes: [],
    validation: [],
    next_step: null,
    next_step_reason: "",
    warnings,
  };

  let selected = null;
  if (selection.applicantId) {
    const paths = workspacePaths(selection.applicantId);
    let profileCheck = null;
    if (fs.existsSync(paths.profilePath)) {
      report.profile = rel(REPO_ROOT, paths.profilePath);
      if (guards.validateKinds.includes("profile")) {
        profileCheck = validateFile("profile", paths.profilePath, { applicant: selection.applicantId });
        report.validation.push(profileCheck);
      }
    }
    let chosen;
    try {
      chosen = resolveFellowship(selection.applicantId, { fellowship: options.fellowship });
    } catch (error) {
      chosen = { ...resolveFellowship(selection.applicantId), fellowshipId: null, source: "invalid", warnings: [error.message] };
    }
    warnings.push(...chosen.warnings);
    report.fellowships = chosen.fellowships;
    report.fellowship_source = chosen.source;
    report.fellowship_id = chosen.fellowshipId;

    // Every folder, and a flagged one that does not exist yet, which is how a
    // second fellowship's `brief` is named before its folder is written.
    const ids = chosen.fellowshipId && !chosen.fellowships.includes(chosen.fellowshipId)
      ? [...chosen.fellowships, chosen.fellowshipId]
      : chosen.fellowships;
    for (const id of ids) {
      const application = readApplication(selection.applicantId, id, guards, warnings);
      report.validation.push(...application.validation);
      application.modes = modeRows(modeState, application, report.profile);
      Object.assign(application, nextStepFor(application, modeState, report.profile, profileCheck));
      report.applications.push(application);
      if (id === chosen.fellowshipId) selected = application;
    }
  }

  if (selected) {
    for (const key of ["fellowship", "host_requirement", "brief", "latest", "modes"]) report[key] = selected[key];
  } else {
    report.modes = modeRows(modeState, emptyApplication(), report.profile);
  }
  const next = nextStep(report, selected);
  report.next_step = next.step;
  report.next_step_reason = next.reason;
  // The JSON names each application's files and position; the working fields
  // stay inside.
  report.applications = report.applications.map((entry) => ({
    fellowship_id: entry.fellowship_id,
    fellowship: entry.fellowship,
    host_requirement: entry.host_requirement,
    brief: entry.brief,
    latest: entry.latest,
    next_step: entry.next_step,
    next_step_reason: entry.next_step_reason,
  }));
  return report;
}

function emptyApplication() {
  return { fellowship_id: null, fellowship: null, host_requirement: null, brief: null, latest: { pool: null, summaries: null, recommendation: null }, reports: {}, validation: [] };
}

// One fellowship folder: the record it is named for, its brief, the latest
// record of each report kind, and every one of them re-validated, so a file
// edited by hand since it was written is the first thing the session hears
// about.
function readApplication(applicantId, fellowshipId, guards, warnings) {
  const application = { ...emptyApplication(), fellowship_id: fellowshipId };
  const paths = applicationPaths(applicantId, fellowshipId);
  const folder = rel(REPO_ROOT, paths.root);
  const record = fellowshipPath(fellowshipId);
  if (fs.existsSync(record)) {
    application.fellowship = rel(REPO_ROOT, record);
    try {
      const data = loadYamlFile(record, application.fellowship);
      if (data && typeof data.host_requirement === "string") application.host_requirement = data.host_requirement;
    } catch (error) {
      warnings.push(error.message);
    }
  } else if (fs.existsSync(paths.root)) {
    warnings.push(`${folder}/ is named for fellowship ${fellowshipId}, but fellowships/${fellowshipId}.yml does not exist`);
  }
  if (fs.existsSync(paths.briefPath)) application.brief = rel(REPO_ROOT, paths.briefPath);

  const unpaired = [];
  for (const kindEntry of REPORT_KINDS) {
    const latest = latestReport(applicantId, fellowshipId, kindEntry);
    application.latest[kindEntry.kind] = latest.path;
    application.reports[kindEntry.kind] = latest.report;
    for (const stray of latest.strays) {
      warnings.push(`${stray} does not follow YYYY-MM-DD-${kindEntry.suffix}.md and is ignored`);
    }
    for (const file of latest.unpaired) unpaired.push([kindEntry.kind, file]);
  }
  // `.history/` holds the versions a write replaced, and is read by no one.
  if (fs.existsSync(paths.machineDir)) {
    for (const name of fs.readdirSync(paths.machineDir).sort()) {
      if (name !== ".history" && !REPORT_NAME.test(name)) {
        warnings.push(`${folder}/${MACHINE_DIR}/${name} is not a machine record any report kind names and is ignored`);
      }
    }
  }

  const check = (kind, file) => {
    if (file && guards.validateKinds.includes(kind)) {
      application.validation.push(validateFile(kind, path.join(REPO_ROOT, file), { applicant: applicantId }));
    }
  };
  check("fellowship", application.fellowship);
  check("brief", application.brief);
  // A report with no machine record is refused by `validate`, which is where
  // that rule lives; handing it over puts the refusal first.
  for (const kindEntry of REPORT_KINDS) check(kindEntry.kind, application.latest[kindEntry.kind]);
  for (const [kind, file] of unpaired) check(kind, file);
  return application;
}

function modeRows(modeState, application, profile) {
  return modeState.map((entry) => ({
    mode: entry.mode,
    built: entry.built,
    done: modeIsDone(entry, application, profile),
    file: entry.mode === "brief" ? application.brief : application.reports[entry.kind] || application.latest[entry.kind] || null,
    missing: entry.mode === "brief" ? briefMissing(application, profile) : [],
  }));
}

function briefMissing(application, profile) {
  const missing = [];
  if (!application.fellowship) missing.push("fellowship record");
  if (!profile) missing.push("profile");
  if (!application.brief) missing.push("project brief");
  return missing;
}

function modeIsDone(entry, application, profile) {
  if (entry.mode === "brief") return briefMissing(application, profile).length === 0;
  return Boolean(application.latest[entry.kind]);
}

// The fixed table for the workspace. Read top to bottom; the first row that
// matches wins. A failing file anywhere comes first, whichever application it
// belongs to, because a file that no longer validates is read by the modes
// that follow it.
function nextStep(report, selected) {
  if (!report.applicant) {
    return report.applicants.length > 1
      ? { step: null, reason: `${report.applicants.length} workspaces exist and no default_applicant is set; ask which applicant, then pass --applicant <id>` }
      : { step: "brief", reason: "no applicant workspace exists yet; build the fellowship record, the profile and the brief in conversation" };
  }
  const failing = report.validation.find((entry) => !entry.ok);
  if (failing) return fixStep(failing);
  if (selected) return { step: selected.next_step, reason: selected.next_step_reason };
  if (report.applications.length === 0) {
    return { step: "brief", reason: `applicants/${report.applicant}/ has no fellowship folder yet; brief records a fellowship and writes its brief in applicants/${report.applicant}/<fellowship-id>/` };
  }
  const each = report.applications.map((entry) => `${entry.fellowship_id} (next: ${entry.next_step || "none"})`).join(", ");
  return { step: null, reason: `${report.applications.length} applications: ${each}; ask which, then pass --fellowship <id>` };
}

// The fixed table for one application.
function nextStepFor(application, modeState, profile, profileCheck) {
  const failing = [profileCheck, ...application.validation].find((entry) => entry && !entry.ok);
  if (failing) {
    const fix = fixStep(failing);
    return { next_step: fix.step, next_step_reason: fix.reason };
  }
  for (const entry of modeState) {
    if (modeIsDone(entry, application, profile)) continue;
    if (entry.mode === "brief") {
      return { next_step: "brief", next_step_reason: `brief has no ${briefMissing(application, profile).join(", no ")} yet` };
    }
    // `none` means the fellowship has no mentor or host component at all, so
    // there is nobody to look for and the pipeline ends at `brief`
    // (AGENTS.md -> What this project is).
    if (application.host_requirement === "none") {
      return { next_step: null, next_step_reason: `${application.fellowship} records host_requirement: none, so this fellowship has no host to look for; brief recorded that and the pipeline stops` };
    }
    if (!entry.built) {
      // Named rather than offered: the applicant is told what comes next and
      // why it will not run, and never handed a command that stops.
      return { next_step: null, next_step_reason: `the next step is ${entry.mode}, which is not built yet; the pipeline stops here in this release` };
    }
    return { next_step: entry.mode, next_step_reason: `${entry.mode} has no file yet` };
  }
  return { next_step: null, next_step_reason: "every mode has a file; re-run any mode to refresh it" };
}

function fixStep(failing) {
  return { step: `fix:${failing.kind}`, reason: `${failing.file} does not validate (${failing.problems.length} problem${failing.problems.length === 1 ? "" : "s"}); fix it before anything else` };
}

function installedGuards() {
  const cliDir = path.join(REPO_ROOT, "scripts", "cli");
  const files = fs.existsSync(cliDir) ? fs.readdirSync(cliDir).filter((name) => name.endsWith(".js")) : [];
  return {
    files,
    commands: files.map((name) => name.replace(/\.js$/, "")).sort(),
    validateKinds: files.includes("validate.js") ? SUPPORTED_KINDS : [],
  };
}

function isBuilt(requires, guards) {
  if (requires.cli && !guards.files.includes(requires.cli)) return false;
  if (requires.validateKind && !guards.validateKinds.includes(requires.validateKind)) return false;
  return true;
}

function printReport(report) {
  const header = report.applicant ? `applicant: ${report.applicant}` : "applicant: none yet";
  const config = report.config_file === "config.example.yml" ? "config.example.yml, the shipped defaults" : report.config_file;
  console.log(`mentor-match  ${header}  (config: ${config})`);
  if (report.applications.length > 1) {
    for (const entry of report.applications) {
      const marker = entry.fellowship_id === report.fellowship_id ? "*" : " ";
      console.log(`  ${marker} ${entry.fellowship_id.padEnd(40)} next: ${entry.next_step || entry.next_step_reason}`);
    }
  }
  if (report.fellowship) {
    console.log(`  fellowship  ${report.fellowship_id} (host_requirement: ${report.host_requirement || "unrecorded"})`);
  }
  const nextMode = typeof report.next_step === "string" && !report.next_step.startsWith("fix:") ? report.next_step : null;
  for (const entry of report.modes) {
    const marker = entry.done ? "done" : entry.mode === nextMode ? "next" : "    ";
    const detail = entry.done
      ? entry.file || "complete"
      : entry.built
        ? (entry.missing.length > 0 ? `missing: ${entry.missing.join(", ")}` : "")
        : "not built yet";
    console.log(`  ${marker}  ${entry.mode.padEnd(10)} ${detail}`.trimEnd());
  }
  if (report.next_step && report.next_step.startsWith("fix:")) {
    console.log(`Next: fix ${report.next_step.slice(4)} -- ${report.next_step_reason}`);
  } else if (report.next_step) {
    console.log(`Next mode: ${report.next_step}`);
  } else {
    console.log(`Next: ${report.next_step_reason}`);
  }
  for (const entry of report.validation.filter((item) => !item.ok)) {
    console.log(`\n${entry.file}: ${entry.problems.length} problem${entry.problems.length === 1 ? "" : "s"}`);
    for (const problem of entry.problems) console.log(`  ${problem.field}: ${problem.message}`);
  }
  if (report.warnings.length > 0) {
    console.log("");
    for (const warning of report.warnings) console.log(`  warning  ${warning}`);
  }
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { runDoctor };
