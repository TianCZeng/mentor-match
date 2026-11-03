// Shared YAML I/O for the guards. One place decides how a file is read, how a
// parse failure is reported, and what a written block looks like, so every
// guard fails the same way and every printed row is byte-stable.
//
// `scripts/verify/yaml.js` requires it rather than making the same CORE_SCHEMA choice inline, so the
// choice has one owner.
const fs = require("fs");

let yaml;
try {
  yaml = require("js-yaml");
} catch (error) {
  console.error("js-yaml is not installed; run `npm install` first");
  process.exit(1);
}

const DUMP_OPTIONS = { lineWidth: -1, noRefs: true, sortKeys: false };

// CORE_SCHEMA, not the default one, on purpose. Under js-yaml's default schema
// an unquoted `retrieved_at: 2026-09-22` parses to a JavaScript Date, so a
// guard would compare a Date against `YYYY-MM-DD` and reject a correct record
// unless the author remembered to quote it. Every date in this repository is a
// written calendar date and never an instant -- the date a page was read is a
// claim about a day, not about a moment -- so the schema that leaves it a
// string is the honest one. CORE_SCHEMA also drops `!!binary`, `!!omap`,
// `!!set` and `!!pairs`, none of which any contract here uses.
const LOAD_OPTIONS = { schema: yaml.CORE_SCHEMA };

function loadYaml(text, label) {
  try {
    return yaml.load(text, LOAD_OPTIONS);
  } catch (error) {
    throw new Error(`${label}: YAML did not parse (${error.reason || error.message})`);
  }
}

function loadYamlFile(file, label) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    throw new Error(`${label || file}: cannot read file (${error.code || error.message})`);
  }
  return loadYaml(text, label || file);
}

function dumpYaml(value) {
  return yaml.dump(value, DUMP_OPTIONS);
}

// A new object whose keys follow `order` first (when present), then any
// remaining keys in their original order. Registry rows go through this so a
// regenerated file diffs against the old one line by line.
function orderKeys(value, order) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const out = {};
  for (const key of order) {
    if (Object.prototype.hasOwnProperty.call(value, key)) out[key] = value[key];
  }
  for (const key of Object.keys(value)) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = value[key];
  }
  return out;
}

module.exports = { CORE_SCHEMA: yaml.CORE_SCHEMA, dumpYaml, loadYaml, loadYamlFile, orderKeys };
