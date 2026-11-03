#!/usr/bin/env node
// gate <url> [--institution <name>] [--json]
//
// May this URL supply a fact about a person, or a fellowship's rules about who
// may host? The gate admits or rejects a host; it never opens the page and
// never says anything about the person or the programme. Three verdicts
// (knowledge/vocabulary.json -> gate.verdicts):
//
//   official            the host is admitted; facts read from this page may
//                       enter a record
//   needs_registry_row  university-shaped but unplaced; write a registry row
//                       from the evidence that identifies the domain, validate
//                       it, and re-gate (modes/_shared.md -> Registry row flow)
//   blocked             can never carry a fact about a person
//
// Exit 0 official, 3 needs_registry_row, 1 blocked, 2 bad usage, so a caller can
// branch on the code without parsing the output. For a fellowship's own page
// only `blocked` refuses it; `needs_registry_row` is about a person's page,
// and `validate fellowship` reads it that way.
const { gateUrl, normalizeHost } = require("../lib/gate");
const { loadInstitutions } = require("../lib/registry");
const { dumpYaml, orderKeys } = require("../lib/yaml");
const { KEY_ORDER } = require("../lib/schema");
const { parseArgs } = require("../lib/args");

const ARGS = {
  flags: ["json"],
  values: ["institution"],
  positional: { max: 1, tooMany: "Gate one URL at a time; the verdict and the exit code are about one host" },
};

const EXIT = { official: 0, blocked: 1, needs_registry_row: 3 };

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

  const { result, payload, registry } = runGate(options);

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`${result.verdict}  ${result.url}`);
    console.log(`  ${result.reason}`);
    for (const warning of result.warnings) console.log(`  warning  ${warning.code}: ${warning.message}`);
    for (const problem of registry.problems) console.error(`  registry  ${problem}`);
    if (payload.registry_row_template) {
      console.log("\n  Fill this row once a page the gate admits links to the domain, or the");
      console.log("  institution's ROR record lists the domain and a page on it names the");
      console.log("  institution (then record the ror_id). Append it to");
      console.log("  registry/institutions.yml, validate it, and list it in the pool report");
      console.log("  with that tie:\n");
      console.log(payload.registry_row_template.replace(/^/gm, "    "));
    }
  }
  process.exitCode = EXIT[result.verdict] ?? 1;
}

// The verdict plus what the caller needs around it: which registry halves were
// read, and, when the host is unplaced, the row the registry row flow fills in.
function runGate(options = {}) {
  const registry = loadInstitutions();
  const result = gateUrl(options.url, { institution: options.institution, registry: registry.rows });
  const payload = {
    ...result,
    registry_files: registry.files.filter((file) => file.present).map((file) => `${file.path} (${file.count} rows)`),
  };
  if (registry.problems.length > 0) payload.registry_problems = registry.problems;
  if (result.verdict === "needs_registry_row") payload.registry_row_template = registryRowTemplate(result);
  return { result, payload, registry };
}

// The shape of a registry row, in canonical key order, with the two facts the
// gate actually knows filled in and everything else left as a placeholder. The
// guard owns the form; the agent fills the values and vouches for them, and
// the pool report shows the applicant what it vouched for
// (modes/_shared.md -> Registry row flow).
function registryRowTemplate(result) {
  const row = orderKeys({
    name: "<the institution's official English name>",
    country: "<country>",
    aliases: [],
    official_domains: [normalizeHost(result.url)].filter(Boolean),
    ror_id: null,
    source: "discovered",
    retrieved_at: new Date().toISOString().slice(0, 10),
    confirmed_by: "agent",
  }, KEY_ORDER.institution);
  return dumpYaml({ institutions: [row] });
}

function readArgs(argv) {
  const options = parseArgs(argv, ARGS);
  if (options.help) return options;
  if (options.positional.length === 0) throw new Error("Missing URL to gate");
  options.url = options.positional[0];
  return options;
}

function printUsage() {
  console.log(`Usage: node scripts/cli/gate.js <url> [--institution "<name>"] [--json]

  --institution  the institution the URL is believed to belong to. On a
                 restricted academic registry (.edu, .ac.uk, .edu.au, .ac.nz,
                 .edu.sg, .edu.cn, .ac.jp, .ac.kr, .edu.hk, .edu.tw, .ac.in) a
                 mismatch is a warning, because the registry admits only
                 educational and research institutions but does not say which
                 one. On an open registry (.ca) it decides the verdict.

Exit 0 official, 3 needs_registry_row, 1 blocked, 2 bad usage.`);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { runGate };
