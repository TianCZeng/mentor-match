// One argument parser for every command under `scripts/cli/`. A command
// declares its switches; anything undeclared is an error, so no guard silently
// ignores a typo and all three fail the same way.
//
//   flags       boolean switches, without the dashes: ["json"]
//   values      switches that consume the next argument: ["applicant"]
//   positional  { max, tooMany } — bare arguments the command accepts
//
// `--help` and `-h` are always understood. The parser decides shape only; each
// command checks its own positionals, because "Missing URL to gate" is a better
// message than anything written here could be.
function parseArgs(argv, spec = {}) {
  const flags = spec.flags || [];
  const values = spec.values || [];
  const maxPositional = spec.positional ? spec.positional.max : 0;

  const options = { help: false, positional: [] };
  for (const flag of flags) options[flag] = false;
  for (const value of values) options[value] = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const name = arg.startsWith("--") ? arg.slice(2) : null;
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (name && flags.includes(name)) {
      options[name] = true;
    } else if (name && values.includes(name)) {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} needs a value`);
      options[name] = argv[index];
    } else if (arg.startsWith("-") || maxPositional === 0) {
      throw new Error(`Unknown argument: ${arg}`);
    } else if (options.positional.length >= maxPositional) {
      throw new Error(spec.positional.tooMany);
    } else {
      options.positional.push(arg);
    }
  }
  return options;
}

module.exports = { parseArgs };
