// Structural guard for the mentor-match repository. Dependency-free on purpose
// so it runs before `npm install`.
//
// It asserts only what code or the harness depends on: which files exist and
// which must never exist, the skill symlinks and frontmatter the loader reads,
// the mode set the router routes over, the package script chain, the
// user-layer rules that keep a real person's data out of the index, that no
// guard writes, and the containment rule. It does not assert documentation
// phrasing. A sentence no program reads is the author's to write; pinning it
// here buys a broken build instead of a working rule. Where a document must
// hold a rule, the rule is enforced on the thing the document describes --
// which is why the personal data boundary is enforced by the closed field
// set in `validate researchers` and not by a grep for a heading here.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const MODES = ["brief", "list", "summarize", "recommend"];
const SKILLS = ["mentor-match"];
// Names that would mean this repository had reached outside itself. The
// standalone decision is the one boundary that a convenience makes attractive,
// so it is checked rather than remembered.
//
// A literal that *embeds* one of these is a path to that repository; a literal
// that *is* one is only the name, which is why this file can hold the list at
// all. A bare name cannot address a sibling on its own -- getting there needs a
// parent escape or an absolute path, and both are rejected below.
const SIBLINGS = ["admissions-ops", "admissions-scout", "EduNexus"];

function main() {
  validateRequiredFiles();
  validateForbiddenFiles();
  validateClaudeImportsAgents();
  validateSkillLinks();
  validateModes();
  validatePackageScripts();
  validateUserLayerSafety();
  validateClaudePermissions();
  validateScriptWrites();
  validateScriptContainment();
  console.log("Repository layout verifies");
}

// Every file code, the harness or the published repository depends on. A
// change that adds one adds it here in the same change.
function validateRequiredFiles() {
  const required = [
    "AGENTS.md", "CLAUDE.md", "DATA_CONTRACT.md", "README.md", "README.zh-CN.md",
    "CONTRIBUTING.md", "LICENSE", "NOTICE", "package.json", ".gitignore",
    "config.example.yml",
    "fellowships/example-institute-research-fellowship.example.yml",
    "applicants/profile.example.yml", "applicants/brief.example.md",
    "modes/_shared.md",
    // The deterministic floor.
    "knowledge/vocabulary.json", "registry/institutions.seed.yml",
    "examples/README.md", "examples/containment-cases.json",
    "scripts/lib/args.js", "scripts/lib/gate.js", "scripts/lib/language.js",
    "scripts/lib/registry.js", "scripts/lib/schema.js", "scripts/lib/workspace.js",
    "scripts/lib/yaml.js",
    "scripts/cli/doctor.js", "scripts/cli/gate.js", "scripts/cli/validate.js",
    "scripts/verify/layout.js", "scripts/verify/yaml.js", "scripts/verify/knowledge.js",
    "scripts/verify/gate.js", "scripts/verify/validate.js", "scripts/verify/generated.js",
    // The unit-reading procedure and Claude Code's wrapper.
    ".agents/skills/mentor-match/references/pool-worker.md",
    ".claude/agents/pool-worker.md",
    // The bibliographic tier's shape check.
    "scripts/lib/identifiers.js",
    // What the published repository needs: a private route for a security
    // report or exposed personal data, the CI that runs this suite, and the
    // issue form that warns against pasting a real person's data.
    "SECURITY.md", ".github/workflows/verify.yml",
    ".github/ISSUE_TEMPLATE/bug_report.md", ".github/ISSUE_TEMPLATE/config.yml",
    // The guard permissions shipped for Claude Code.
    ".claude/settings.json",
  ];
  for (const rel of required) {
    assert(fs.existsSync(path.join(repoRoot, rel)), `missing required file: ${rel}`);
  }
}

// A refusal, not a convention. The institution registry has two halves and the
// people registry deliberately has one, so the twin file is the mistake this
// repository is most likely to make: the pattern makes it structurally obvious,
// and nothing else in the tree argues against it. An institution's domain is a
// public fact about an organisation; a researcher row is personal data about a
// named person who did not agree to be catalogued.
function validateForbiddenFiles() {
  const forbidden = [
    ["registry/researchers.seed.yml", "there is no seed half of the people registry and there never will be; see AGENTS.md -> Personal Data"],
    ["registry/researchers.example.yml", "a shipped example of a researcher row would be a shipped person; the field set is documented in AGENTS.md instead"],
  ];
  for (const [rel, why] of forbidden) {
    assert(!fs.existsSync(path.join(repoRoot, rel)), `${rel} must not exist: ${why}`);
  }
}

function validateClaudeImportsAgents() {
  const firstLine = read("CLAUDE.md").split("\n")[0].trim();
  assert(firstLine === "@AGENTS.md", "CLAUDE.md must begin with `@AGENTS.md`; AGENTS.md is the single source of policy");
}

function validateSkillLinks() {
  for (const skill of SKILLS) {
    const canonical = path.join(repoRoot, ".agents", "skills", skill, "SKILL.md");
    assert(fs.existsSync(canonical), `missing skill file: .agents/skills/${skill}/SKILL.md`);
    const link = path.join(repoRoot, ".claude", "skills", skill);
    assert(fs.existsSync(link), `missing .claude/skills/${skill}`);
    assert(fs.lstatSync(link).isSymbolicLink(), `.claude/skills/${skill} must be a symlink, not a copy`);
    const target = fs.readlinkSync(link);
    assert(target === `../../.agents/skills/${skill}`, `.claude/skills/${skill} must point at ../../.agents/skills/${skill} (got ${target})`);
    const text = fs.readFileSync(canonical, "utf8");
    assert(text.startsWith("---\n"), `${skill}/SKILL.md must start with YAML frontmatter`);
    assert(new RegExp(`^name: ${skill}$`, "m").test(text), `${skill}/SKILL.md frontmatter must declare name: ${skill}`);
  }
}

// The router routes over exactly these files, so the set is structural. What
// each mode file says inside is the author's.
function validateModes() {
  const present = fs.readdirSync(path.join(repoRoot, "modes"))
    .filter((file) => file.endsWith(".md") && !file.startsWith("_"))
    .map((file) => file.replace(/\.md$/, ""));
  assert(present.sort().join(",") === [...MODES].sort().join(","),
    `modes/ must hold exactly ${MODES.join(", ")} (got ${present.join(", ")})`);
}

function validatePackageScripts() {
  const pkg = JSON.parse(read("package.json"));
  const scripts = pkg.scripts || {};
  assert(scripts.verify, "package.json must define a verify script");
  assert(scripts.test === "npm run verify", "package.json test must alias verify");
  const verifyTargets = Object.keys(scripts).filter((key) => key.startsWith("verify:"));
  assert(verifyTargets.length >= 1, "package.json must define at least one verify:* script");
  for (const target of verifyTargets) {
    assert(scripts.verify.includes(`npm run ${target}`), `verify must chain ${target}`);
    const file = scripts[target].replace(/^node\s+/, "");
    assert(fs.existsSync(path.join(repoRoot, file)), `${target} points at a missing file: ${file}`);
  }
  // A script entry pointing at a command that does not exist is a claim about
  // what is built. The guards get their entries in the phase that writes them.
  for (const [name, command] of Object.entries(scripts)) {
    const match = /^node\s+(\S+)/.exec(command);
    if (!match) continue;
    assert(fs.existsSync(path.join(repoRoot, match[1])), `package.json script "${name}" points at a missing file: ${match[1]}`);
  }
  assert(pkg.license === "MIT", "package.json license must be MIT");
  assert(pkg.engines && pkg.engines.node, "package.json must declare engines.node");
}

// The rules that keep a real person's data out of the index. In a clone,
// applicants/ holds the applicant's own profile and project and fellowships/
// holds a real fellowship's rules, so unlike the sibling repositories there is
// no synthetic workspace to whitelist. Presence is not
// the test -- config.yml and both local registry halves are files a working
// clone is meant to have. Entering the index is.
function validateUserLayerSafety() {
  const gitignore = read(".gitignore").split("\n").map((line) => line.trim());
  const rules = [
    "/config.yml",
    "/applicants/*",
    "/fellowships/*",
    "/registry/researchers.yml",
    "/registry/institutions.yml",
  ];
  for (const rule of rules) {
    assert(gitignore.includes(rule), `.gitignore must ignore ${rule} (user layer)`);
  }
  for (const rel of ["config.yml", "registry/researchers.yml", "registry/institutions.yml"]) {
    assert(!isTracked(rel), `${rel} is user layer and must not be committed; run git rm --cached ${rel}`);
  }
  assert(gitignore.includes(".claude/settings.local.json"),
    ".gitignore must ignore .claude/settings.local.json, where an applicant allows the network tools for their own clone");
  // Only the flat templates may be tracked under the two user-layer trees. A
  // committed workspace here would be a real person's files.
  for (const dir of ["applicants", "fellowships"]) {
    for (const tracked of trackedUnder(dir)) {
      assert(/\.example\.(yml|md)$/.test(tracked),
        `${tracked} is tracked under ${dir}/, where only flat *.example.* templates may be; no workspace in this tree is synthetic`);
    }
  }
}

// This adapter grants Claude Code access to the offline guards only. Other
// agents use their own permissions; no agent's prompts replace the source gate.
const GUARD_PERMISSIONS = ["doctor", "validate", "gate"].map((name) => `Bash(node scripts/cli/${name}.js:*)`);

function validateClaudePermissions() {
  const settings = JSON.parse(read(".claude/settings.json"));
  assert(Object.keys(settings).join(",") === "permissions",
    `.claude/settings.json may hold only permissions (got ${Object.keys(settings).join(", ")})`);
  assert(Object.keys(settings.permissions || {}).join(",") === "allow",
    `.claude/settings.json permissions may hold only allow (got ${Object.keys(settings.permissions || {}).join(", ")})`);
  const allow = settings.permissions.allow;
  assert(Array.isArray(allow) && [...allow].sort().join("\n") === [...GUARD_PERMISSIONS].sort().join("\n"),
    `.claude/settings.json must allow exactly the three guards: ${GUARD_PERMISSIONS.join(", ")}`);
}

// No guard writes, anywhere. A guard returns findings and exits; every write is
// the agent's, checked by a guard before the applicant is pointed to it
// (AGENTS.md principle 8). This
// is what makes "guards flag, never rewrite" enforced rather than true by
// luck: the first guard that grows a writer fails here, and
// admitting one is a decision that names its file below, not a grep a comment
// can satisfy. The one name there now is this file's, because the pattern is in
// it.
const WRITE_SCAN_EXEMPT = ["scripts/verify/layout.js"];
// Every fs call that changes the disk, by name, with or without `Sync`; `write`
// only as `fs.write` or `writeSync`, so a CLI printing to stdout is not a writer.
const WRITE_API = /\b(?:writeFile|appendFile|mkdir|mkdtemp|rm|rmdir|unlink|rename|copyFile|cp|symlink|link|truncate|ftruncate|chmod|chown|utimes)(?:Sync)?\s*\(|\bwritev?Sync\s*\(|\bfs\.writev?\s*\(|\bcreateWriteStream\b|\bfs\.promises\b|fs\/promises["']/;

function validateScriptWrites() {
  for (const rel of scriptFiles()) {
    if (WRITE_SCAN_EXEMPT.includes(rel)) continue;
    const match = WRITE_API.exec(stripComments(read(rel)));
    assert(!match, `${rel} calls ${match && match[0].trim()}; no guard writes, and a guard that must is admitted by name in verify:layout`);
  }
}

// The standalone decision, enforced structurally rather than remembered: no
// path outside this repository root is referenced anywhere under scripts/.
//
// This checks what the source *references*. Containment of a path a user
// passes on the command line is a runtime job: `resolveUnderRepoRoot` in
// scripts/lib/workspace.js, checked by verify:generated. What is caught here is the convenience that makes the sibling path
// attractive in the first place: a hardcoded checkout, a home directory, a
// parent-escaping relative path, or a sibling repository named as a location.
function validateScriptContainment() {
  for (const rel of scriptFiles()) {
    const source = stripComments(read(rel));

    // Every guard reaches its own root with exactly this idiom. Removing it
    // first is what lets the `..` rule below be absolute.
    const code = source.replace(/path\.resolve\(\s*__dirname\s*,\s*"\.\."\s*,\s*"\.\."\s*\)/g, "REPO_ROOT");

    const dir = path.dirname(path.join(repoRoot, rel));
    for (const { path: literal, raw } of stringLiterals(code)) {
      // A path a guard uses is one whitespace-free token; an assertion message
      // is prose that may quote one. Scanning only the first keeps the rule on
      // paths the code resolves, which is what the standalone decision is
      // about, and lets a failure message name the path it is complaining of.
      if (/\s/.test(literal)) continue;

      // A relative literal is judged by where it lands, not by whether it
      // contains "..". An earlier form banned the characters, which held only
      // while no module required another: `require("../lib/gate")` and
      // `relative.startsWith("..")` are both contained and both would fail
      // that rule. Resolving asks the question the standalone decision
      // actually asks -- can this path, used from this file, leave the tree --
      // and still refuses every escape, because depth is what decides. It also
      // retires the one hand-written exception, the skill symlink target: it
      // lands inside the root on the same rule as everything else.
      if (/^\.\.?(\/|$)/.test(literal)) {
        const landing = path.resolve(dir, literal);
        assert(landing === repoRoot || isInside(landing, repoRoot),
          `${rel} references ${JSON.stringify(literal)}, which resolves to ${landing}, outside the repository root; nothing under scripts/ may resolve outside it`);
      }

      // `~/` and not a bare `~`: Node never expands a tilde, so `~` alone names
      // nothing.
      assert(!/^(~\/|\/(Users|home|root|etc|var|tmp|private|opt|usr|mnt|Volumes)(\/|$))/.test(literal),
        `${rel} references an absolute path outside the repository ${JSON.stringify(literal)}`);

      // The sibling check reads the literal *before* its holes collapse.
      // Collapsing is right for resolving a path and wrong for finding a name:
      // `../${"admissions-scout"}-dev/x` resolves to a contained path and
      // reaches a sibling, and the earlier ban on ".." caught it only by
      // accident. Judging the shape and the name on different text is what
      // keeps both rules honest.
      for (const sibling of SIBLINGS) {
        assert(!raw.includes(sibling) || raw === sibling,
          `${rel} embeds the sibling repository ${sibling} in ${JSON.stringify(raw)}; this repository is standalone and reads nothing from one`);
      }
    }

    // The locations outside the root a guard could reach without writing a
    // path: the home directory and the system temp directory. Banned as
    // identifiers rather than by refusing the `os` module, which kept
    // `os.EOL` and `os.platform()` from a guard with no interest in either, and
    // which a destructured `homedir` still cannot slip past. This file names
    // them in order to ban them, so it is exempt by name.
    if (rel === "scripts/verify/layout.js") continue;
    for (const escape of ["homedir", "tmpdir", "process.env.HOME", "process.env.USERPROFILE"]) {
      assert(!new RegExp(`\\b${escape.replace(/\./g, "\\.")}\\b`).test(code),
        `${rel} uses ${escape}; nothing under scripts/ may address a location outside the repository root`);
    }
  }
}

function isInside(value, root) {
  const relative = path.relative(root, value);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

// Every .js under scripts/, at any depth, as repo-relative paths.
function scriptFiles() {
  const out = [];
  walk(path.join(repoRoot, "scripts"));
  return out;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) out.push(path.relative(repoRoot, full));
    }
  }
}

// A comment may name a sibling or quote a path to explain a rule, as this file
// does, so comments are removed before the scans rather than being caught by
// them. Only a comment that opens its line, or a `//` after
// whitespace, counts as one. The earlier form took any `/*` for a block
// comment, so the literal "/applicants/*" opened one that ran on to the next
// `*/` and blanked 143 lines of this file, its own escape list among them: the
// scan passed on text it never read.
function stripComments(text) {
  return text
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .replace(/(^|[ \t])\/\/[^\n]*/gm, "$1");
}

// Single-quoted, double-quoted and backtick literals, each as { path, raw }.
// `path` has a template's `${...}` holes collapsed to `@`, which is the shape
// the code resolves; `raw` is what was written. Templates are scanned rather
// than skipped because most path building in these guards is interpolated, so a
// scanner that skipped them would be checking the least of the code.
function stringLiterals(code) {
  const out = [];
  const pattern = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
  let match;
  while ((match = pattern.exec(code)) !== null) {
    const raw = match[1] !== undefined ? match[1] : match[2] !== undefined ? match[2] : match[3];
    out.push({ raw, path: raw.replace(/\$\{[^}]*\}/g, "@") });
  }
  return out;
}

// Tracked by git, not merely present. Empty when git cannot answer -- a tree
// unpacked from `git archive` has no index to read, and the public tree is
// built that way -- which is safe, because nothing can have been committed into
// a tree that is not a checkout, and the `.gitignore` assertions above still
// pin the lines that keep these paths out of an index in the first place.
function trackedUnder(dir) {
  try {
    // stderr is discarded, not inherited: in a tree with no index git prints
    // `fatal: not a git repository`, and this target is meant to be silent
    // there rather than to look like it failed.
    const out = execFileSync("git", ["ls-files", "--", dir], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split("\n").filter(Boolean);
  } catch (error) {
    return [];
  }
}

function isTracked(rel) {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", rel], { cwd: repoRoot, stdio: "ignore" });
    return true;
  } catch (error) {
    return false;
  }
}

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`verify:layout failed: ${message}`);
    process.exit(1);
  }
}

main();
