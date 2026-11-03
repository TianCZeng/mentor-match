#!/usr/bin/env node
// validate <fellowship|profile|brief|pool|summaries|recommendation|researchers|institutions> <file> [--applicant <id>] [--json]
//
// The guard every mode runs on what it writes. It rejects and explains; it never
// rewrites what the agent authored (AGENTS.md -> Agent Authorship And
// Deterministic Guards). Exit 0 when the file is clean, 1 with a list of
// problems naming their fields otherwise. Notes are printed but never fail a
// file: they say what a later mode will have to call missing.
//
// The file to validate is a path the applicant typed, and this repository
// reads nothing outside its own root, so it goes through `resolveUnderRepoRoot`
// before it is opened.
//
// Where a file sits decides what it is checked against. In a fellowship folder,
// `applicants/<id>/<fellowship-id>/`, the folder's name is the fellowship's
// id: a folder with no record of that id is refused, and a report there
// reads that record, that folder's brief and that folder's earlier reports.
const fs = require("fs");
const path = require("path");
const {
  REPO_ROOT, REPORT_KINDS, applicationPaths, fellowshipPath, loadConfig, rel, reportPair, resolveUnderRepoRoot, workspaceForPath,
} = require("../lib/workspace");
const { parseArgs } = require("../lib/args");
const { loadYaml, loadYamlFile } = require("../lib/yaml");
const { institutionLayerForFile, loadInstitutions } = require("../lib/registry");
const {
  SUPPORTED_KINDS, found, validateBrief, validateFellowship, validateInstitutions, validatePool, validateProfile, validateRecommendation,
  validateResearchers, validateSummaries,
} = require("../lib/schema");

const ARGS = {
  flags: ["json"],
  values: ["applicant"],
  positional: { max: 2, tooMany: "validate takes one kind and one file" },
};

function main(argv) {
  let options;
  try {
    options = readArgs(argv);
  } catch (error) {
    console.error(error.message);
    printUsage();
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    printUsage();
    return;
  }
  const result = validateFile(options.kind, options.file, options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printResult(result);
  }
  process.exitCode = result.ok ? 0 : 1;
}

function readArgs(argv) {
  const options = parseArgs(argv, ARGS);
  if (options.help) return options;
  const [kind, file] = options.positional;
  if (!kind) throw new Error("Missing kind");
  if (!SUPPORTED_KINDS.includes(kind)) {
    throw new Error(`Unknown kind: ${kind}. This release validates ${SUPPORTED_KINDS.join(", ")}; the other kinds land with their modes.`);
  }
  if (!file) throw new Error(`Missing file to validate as ${kind}`);
  options.kind = kind;
  options.file = file;
  return options;
}

// One file against one kind. Returns a plain object so `doctor` can embed it.
// `options.text` stands in for the file's contents, so verify:validate can check
// a committed fixture with one thing changed without writing a copy of it; the
// path still decides the context, exactly as it does for the file itself. A
// report's prose is never read, so for a report the text counts only when
// the file handed over is its machine record.
function validateFile(kind, file, options = {}) {
  const result = { kind, file: String(file), ok: false, problems: [], notes: [] };
  let resolved;
  try {
    resolved = resolveUnderRepoRoot(file, `validate ${kind}`);
  } catch (error) {
    result.problems.push({ field: "(file)", message: error.message });
    return result;
  }
  const relPath = rel(REPO_ROOT, resolved);
  result.file = relPath;
  const location = workspaceForPath(resolved);
  // A property of the path, so it is checked before the file is opened.
  if (location && location.fellowshipId && !fs.existsSync(fellowshipPath(location.fellowshipId))) {
    result.problems.push({ field: "(folder)", message: `applicants/${location.applicantId}/${location.fellowshipId}/ is named for fellowship ${location.fellowshipId}, but fellowships/${location.fellowshipId}.yml does not exist; a fellowship folder is named for the id of its record, and brief writes the record first` });
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    result.problems.push({ field: "(file)", message: `${relPath}: no such file` });
    return result;
  }
  const applicantId = options.applicant || (location && location.applicantId) || null;
  const context = { label: relPath, applicantId, location };
  try {
    const text = options.text !== undefined ? options.text : readText(resolved, relPath);
    if (kind === "fellowship") {
      // A record's id is its filename, in fellowships/ and nowhere else: under
      // examples/ a file is named as a fixture, not for its id. The trailing
      // .example is stripped so the shipped template demonstrates the rule
      // rather than being exempt from it.
      if (path.dirname(resolved) === path.join(REPO_ROOT, "fellowships")) {
        context.fileId = path.basename(resolved).replace(/\.yml$/, "").replace(/\.example$/, "");
      }
      applyFindings(result, validateFellowship(loadYaml(text, relPath), context));
    } else if (kind === "profile") {
      applyFindings(result, validateProfile(loadYaml(text, relPath), context));
    } else if (kind === "brief") {
      // Same scoping as the fellowship id: inside a workspace the path is the
      // contract, because doctor finds a brief there and nowhere else.
      if (location && (!location.fellowshipId || resolved !== applicationPaths(location.applicantId, location.fellowshipId).briefPath)) {
        result.problems.push({ field: "(file)", message: `a brief is written as applicants/<id>/<fellowship-id>/brief.md, one per fellowship (found ${relPath})` });
      }
      applyFindings(result, validateBrief(text, context));
    } else if (kind === "pool") {
      const block = readReportContext("pool", resolved, text, context, result);
      applyFindings(result, validatePool(block, context));
    } else if (kind === "summaries") {
      const block = readReportContext("summaries", resolved, text, context, result);
      applyFindings(result, validateSummaries(block, context));
    } else if (kind === "recommendation") {
      const block = readReportContext("recommendation", resolved, text, context, result);
      applyFindings(result, validateRecommendation(block, context));
    } else if (kind === "researchers") {
      // Every page a row cites goes through the full gate, which reads both
      // halves of the institution registry.
      context.registry = loadInstitutions().rows;
      applyFindings(result, validateResearchers(loadYaml(text, relPath), context));
    } else if (kind === "institutions") {
      context.layer = options.layer || institutionLayerForFile(resolved);
      applyFindings(result, validateInstitutions(loadYaml(text, relPath), context));
    }
  } catch (error) {
    result.problems.push({ field: "(file)", message: error.message });
  }
  result.ok = result.problems.length === 0;
  return result;
}

function readText(resolved, relPath) {
  try {
    return fs.readFileSync(resolved, "utf8");
  } catch (error) {
    throw new Error(`${relPath}: cannot read file (${error.code || error.message})`);
  }
}

// What a report is read against. A report is two files under one name: the
// prose, which no guard reads, and the machine record, which every
// guard reads. Either may be handed over, and both must exist: a record never
// stands without the report it records, nor a report without the record that
// checks it. Inside a workspace the pair is named YYYY-MM-DD-<suffix>, it reads
// the one researcher registry there is, and its budget answers to the
// applicant's config.yml. Under examples/ a fixture names its own fixture files
// and answers to config.example.yml, so that no test of a rule depends on a
// user-layer file. A pool also reads its fellowship record; a
// summaries report reads the pool it summarises; a recommendation reads both,
// and holds them to one another, because a judgement joins the description it
// follows and both must describe the same run. Returns the parsed record.
function readReportContext(kind, resolved, text, context, result) {
  const kindEntry = REPORT_KINDS.find((entry) => entry.kind === kind);
  const ext = path.extname(resolved);
  if (ext !== ".md" && ext !== ".yml") {
    throw new Error(`a ${kind} report is validated through its report (.md) or its machine record (.yml) (found ${path.basename(resolved)})`);
  }
  const pair = reportPair(kindEntry, resolved, context.location);
  if (pair.workspace) {
    const match = new RegExp(`^(\\d{4}-\\d{2}-\\d{2})-${kindEntry.suffix}\\${ext}$`).exec(path.basename(resolved));
    if (match) context.fileDate = match[1];
    else result.problems.push({ field: "(file)", message: `a ${kind} report is written as applicants/<id>/<fellowship-id>/${kindEntry.dir}/YYYY-MM-DD-${kindEntry.suffix}.md, with its machine record at applicants/<id>/<fellowship-id>/machine/YYYY-MM-DD-${kindEntry.suffix}.yml (found ${path.basename(resolved)})` });
  } else if (context.location) {
    result.problems.push({ field: "(file)", message: `a ${kind} report in a workspace sits in a fellowship folder, as applicants/<id>/<fellowship-id>/${kindEntry.dir}/YYYY-MM-DD-${kindEntry.suffix}.md (found ${rel(REPO_ROOT, resolved)})` });
  }
  const recordPath = rel(REPO_ROOT, pair.record);
  if (!fs.existsSync(pair.record)) {
    throw new Error(`${recordPath} does not exist; every report has a machine record under its own name, and the record is what the guards read (DATA_CONTRACT.md -> Reports)`);
  }
  if (!fs.existsSync(pair.report)) {
    result.problems.push({ field: "(file)", message: `${rel(REPO_ROOT, pair.report)} does not exist; a machine record is written with the report it records, and neither stands alone (DATA_CONTRACT.md -> Reports)` });
  }
  const block = loadYaml(ext === ".yml" ? text : readText(pair.record, recordPath), recordPath);
  const inputs = block && typeof block.inputs === "object" && block.inputs ? block.inputs : {};
  context.inputProblems = [];
  if (pair.workspace) folderInputs(kind, inputs, context.location, context);
  // A report's inputs name machine records, because the joins run between them.
  // A report's prose is refused by name rather than parsed as YAML.
  const readRecord = (value, field) => {
    if (typeof value === "string" && value.endsWith(".md")) {
      context.inputProblems.push([field, `${value} is a report, which no guard reads; name its machine record, the .yml the joins run on`]);
      return null;
    }
    const data = readInput(value, field, context);
    return data && typeof data === "object" ? data : null;
  };
  if (kind === "pool") context.fellowship = readInput(inputs.fellowship, "inputs.fellowship", context);
  if (kind === "summaries" || kind === "recommendation") {
    context.pool = readRecord(inputs.pool, "inputs.pool");
    context.poolPath = inputs.pool;
  }
  if (kind === "recommendation") {
    context.summaries = readRecord(inputs.summaries, "inputs.summaries");
    context.summariesPath = inputs.summaries;
    readInput(inputs.fellowship, "inputs.fellowship", context);
    const read = (report) => (report && typeof report.inputs === "object" && report.inputs) || {};
    if (context.summaries && read(context.summaries).pool !== inputs.pool) {
      context.inputProblems.push(["inputs.summaries", `${inputs.summaries} summarises ${JSON.stringify(read(context.summaries).pool)}, not ${inputs.pool}; the judgements and the descriptions they rest on come from one pool`]);
    }
    if (context.pool && read(context.pool).fellowship !== inputs.fellowship) {
      context.inputProblems.push(["inputs.fellowship", `${inputs.pool} was read against ${JSON.stringify(read(context.pool).fellowship)}, not ${inputs.fellowship}`]);
    }
  }
  const registry = readInput(inputs.researchers, "inputs.researchers", context);
  context.researchers = registry && Array.isArray(registry.researchers) ? registry.researchers : [];
  context.registry = loadInstitutions().rows;
  // A cap config.yml lacks is the shipped one, key by key: a config written
  // before a mode added its cap still bounds that mode's run.
  const shipped = loadYamlFile(path.join(REPO_ROOT, "config.example.yml"), "config.example.yml");
  const config = pair.workspace ? loadConfig().data : shipped;
  context.caps = { ...((shipped && shipped.budgets) || {}), ...((config && config.budgets) || {}) };
  return block;
}

// In a fellowship folder, what a report read is fixed by where it sits:
// the one researcher registry, the applicant's profile, and this folder's
// record, brief and earlier reports. A report that read another fellowship's
// pool, or its brief, would answer the wrong application.
function folderInputs(kind, inputs, { applicantId, fellowshipId }, context) {
  const folder = rel(REPO_ROOT, applicationPaths(applicantId, fellowshipId).root);
  const fixed = {
    researchers: ["registry/researchers.yml", "the one researcher registry there is"],
    profile: [`applicants/${applicantId}/profile.yml`, "the profile this workspace holds"],
    brief: [`${folder}/brief.md`, "this folder's brief"],
    fellowship: [`fellowships/${fellowshipId}.yml`, "the record this folder is named for"],
  };
  for (const [key, [expected, what]] of Object.entries(fixed)) {
    if (inputs[key] !== undefined && inputs[key] !== expected) {
      context.inputProblems.push([`inputs.${key}`, `must be ${expected}, ${what}, for a ${kind} report in ${folder}/${found(inputs[key])}`]);
    }
  }
  if (inputs.researchers === undefined) {
    context.inputProblems.push(["inputs.researchers", `must be registry/researchers.yml; a ${kind} report in a workspace joins the one researcher registry there is`]);
  }
  const records = [["inputs.pool", inputs.pool], ["inputs.summaries", inputs.summaries]];
  if (Array.isArray(inputs.prior_pools)) inputs.prior_pools.forEach((value, index) => records.push([`inputs.prior_pools[${index}]`, value]));
  for (const [field, value] of records) {
    if (typeof value === "string" && !value.startsWith(`${folder}/machine/`)) {
      context.inputProblems.push([field, `${value} is not a machine record in ${folder}/machine/; a report reads the reports of its own fellowship folder only`]);
    }
  }
}

// A YAML input, read once it is proved inside the root and present.
function readInput(value, field, context) {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const file = resolveUnderRepoRoot(value, field);
    if (!fs.existsSync(file)) {
      context.inputProblems.push([field, `${value} does not exist`]);
      return null;
    }
    return loadYamlFile(file, value);
  } catch (error) {
    context.inputProblems.push([field, error.message]);
    return null;
  }
}

function applyFindings(result, findings) {
  result.problems.push(...findings.problems);
  result.notes.push(...findings.notes);
}

function printResult(result) {
  if (result.ok) {
    console.log(`validate ${result.kind} ${result.file}: ok`);
  } else {
    console.error(`validate ${result.kind} ${result.file}: ${result.problems.length} problem${result.problems.length === 1 ? "" : "s"}`);
    for (const problem of result.problems) console.error(`  ${problem.field}: ${problem.message}`);
  }
  for (const note of result.notes) console.log(`  note  ${note.field}: ${note.message}`);
}

function printUsage() {
  console.log(`Usage: node scripts/cli/validate.js <${SUPPORTED_KINDS.join("|")}> <file> [--applicant <id>] [--json]

  fellowship     fellowships/<fellowship-id>.yml
  profile        applicants/<id>/profile.yml
  brief          applicants/<id>/<fellowship-id>/brief.md
  pool           applicants/<id>/<fellowship-id>/pool/YYYY-MM-DD-pool.md
  summaries      applicants/<id>/<fellowship-id>/summaries/YYYY-MM-DD-summaries.md
  recommendation applicants/<id>/<fellowship-id>/recommendations/YYYY-MM-DD-recommendation.md
  researchers    registry/researchers.yml
  institutions   registry/institutions.seed.yml or registry/institutions.yml

A report may be handed over as its machine record instead,
applicants/<id>/<fellowship-id>/machine/YYYY-MM-DD-<pool|summaries|recommendation>.yml;
either way the record is what is checked, and both files must exist.

Exit 0 when the file is clean, 1 with a list of problems naming their fields.`);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { validateFile };
