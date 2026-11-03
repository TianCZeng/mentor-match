// Every committed YAML example, seed and fixture must parse to a mapping.
// Extend the list as files land; the `whenPresent` half is checked only where
// the file exists, so the list can name a file before it arrives.
const fs = require("fs");
const path = require("path");
// scripts/lib/yaml.js owns how a file is read and why dates stay strings under
// CORE_SCHEMA. This target requires it rather than repeating the choice, so the
// two cannot disagree. It is the one
// dependency this file has beyond js-yaml, and it is not dependency-free the
// way verify:layout is: a YAML target needs a YAML parser either way.
const { loadYaml, loadYamlFile } = require("../lib/yaml");

const repoRoot = path.resolve(__dirname, "..", "..");

const required = [
  "config.example.yml",
  "fellowships/example-institute-research-fellowship.example.yml",
  "applicants/profile.example.yml",
  "registry/institutions.seed.yml",
  "knowledge/vocabulary.json",
];

const whenPresent = [];

const fixtures = fs.existsSync(path.join(repoRoot, "examples"))
  ? fs.readdirSync(path.join(repoRoot, "examples")).filter((name) => name.endsWith(".yml")).map((name) => `examples/${name}`)
  : [];

// Every committed YAML and JSON the guards read must parse; a broken data file
// is a broken guard, and this target runs before the ones that would crash on
// it.

const files = required
  .concat(whenPresent.filter((rel) => fs.existsSync(path.join(repoRoot, rel))))
  .concat(fixtures);

for (const file of files) {
  let data;
  try {
    data = file.endsWith(".json")
      ? JSON.parse(fs.readFileSync(path.join(repoRoot, file), "utf8"))
      : load(file);
  } catch (error) {
    fail(error.message);
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    fail(`${file} must parse to a mapping`);
  }
}

// Shared manifests use Agent Skills fields. Engine-specific invocation or
// permission keys can be ignored by one loader and rejected by another.
const skillFields = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);
const skillsDir = path.join(repoRoot, ".agents", "skills");
let skills = 0;
for (const name of fs.readdirSync(skillsDir)) {
  const file = path.join(skillsDir, name, "SKILL.md");
  if (!fs.existsSync(file)) continue;
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(fs.readFileSync(file, "utf8"));
  if (!match) fail(`${name}/SKILL.md must have YAML frontmatter`);
  let data;
  try {
    data = loadYaml(match[1], `${name}/SKILL.md`);
  } catch (error) {
    fail(error.message);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) fail(`${name}/SKILL.md frontmatter must be a mapping`);
  if (data.name !== name) fail(`${name}/SKILL.md name must match its directory`);
  if (typeof data.description !== "string" || !data.description.trim() || data.description.length > 1024) {
    fail(`${name}/SKILL.md description must be a nonempty string of at most 1024 characters`);
  }
  for (const key of Object.keys(data)) {
    if (!skillFields.has(key)) fail(`${name}/SKILL.md has nonstandard field ${key}; keep agent-specific settings out of shared frontmatter`);
  }
  skills += 1;
}

// The one content check this target kept when `validate` landed: that a date is
// still a string after parsing. It is a property of the loader rather than of a
// schema, so it belongs to the target that owns loading, and no other check
// here would notice if CORE_SCHEMA were dropped -- `validate` would simply
// start rejecting correct records with a message about the wrong thing.
const fellowship = load("fellowships/example-institute-research-fellowship.example.yml");
if (typeof fellowship.retrieved_at !== "string") {
  fail("a written date must parse to a string, not a Date; scripts/lib/yaml.js loads under CORE_SCHEMA for exactly this");
}

console.log(`YAML and JSON data parses (${files.length} files, ${skills} shared skill manifests)`);

function load(rel) {
  return loadYamlFile(path.join(repoRoot, rel), rel);
}

function fail(message) {
  console.error(`verify:yaml failed: ${message}`);
  process.exit(1);
}
