// The institution registry: a seed file the maintainer refreshes plus a local
// file runs append to, read as one list (DATA_CONTRACT.md -> One Registry Ships
// A Seed). A local row that duplicates a seed row is redundant, not a conflict,
// so nothing here shadows or de-duplicates; readers take both halves.
//
// It is the only registry with a seed, so it is read here directly rather than
// through a table of registries. The people registry never gets one: there is
// no `registry/researchers.seed.yml` and there never will be (AGENTS.md ->
// Personal Data).
const fs = require("fs");
const path = require("path");
const { REPO_ROOT, rel } = require("./workspace");
const { loadYamlFile } = require("./yaml");

const SEED = "registry/institutions.seed.yml";
const LOCAL = "registry/institutions.yml";

// { entries, rows, files, problems }. `entries` keep the file and index each
// row came from so a guard can name the exact row it rejects; `rows` is the
// flat list the gate reads. A missing file is not a problem: the local half is
// gitignored and absent from a fresh clone.
function loadInstitutions() {
  const entries = [];
  const files = [];
  const problems = [];
  for (const [layer, relPath] of [["seed", SEED], ["local", LOCAL]]) {
    const file = path.join(REPO_ROOT, relPath);
    if (!fs.existsSync(file)) {
      files.push({ layer, path: relPath, present: false, count: 0, source_version: null });
      continue;
    }
    let data;
    try {
      data = loadYamlFile(file, relPath);
    } catch (error) {
      problems.push(error.message);
      files.push({ layer, path: relPath, present: true, count: 0, source_version: null });
      continue;
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      problems.push(`${relPath}: must parse to a mapping with an institutions list`);
      files.push({ layer, path: relPath, present: true, count: 0, source_version: null });
      continue;
    }
    if (!Array.isArray(data.institutions)) {
      problems.push(`${relPath}: must carry an institutions list`);
      files.push({ layer, path: relPath, present: true, count: 0, source_version: data.source_version || null });
      continue;
    }
    data.institutions.forEach((row, index) => entries.push({ layer, file: relPath, index, row }));
    files.push({ layer, path: relPath, present: true, count: data.institutions.length, source_version: data.source_version || null });
  }
  return { entries, rows: entries.map((entry) => entry.row).filter((row) => row && typeof row === "object"), files, problems };
}

function institutionPaths() {
  return { seed: path.join(REPO_ROOT, SEED), local: path.join(REPO_ROOT, LOCAL), seedRel: SEED, localRel: LOCAL };
}

// Which half a file is, so `validate institutions <file>` can tell a seed file
// (must carry a dated source_version) from a local one (need not).
function institutionLayerForFile(file) {
  const paths = institutionPaths();
  const resolved = path.resolve(file);
  if (resolved === paths.seed) return "seed";
  if (resolved === paths.local) return "local";
  return rel(REPO_ROOT, resolved).endsWith(".seed.yml") ? "seed" : "other";
}

module.exports = { institutionLayerForFile, institutionPaths, loadInstitutions };
