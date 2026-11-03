// Language guard for the English-record rule.
//
// See `AGENTS.md` -> Language and `modes/_shared.md` -> Language: chat and
// report prose follow the applicant, but registry rows and a report's machine
// record are English, because the guards read them.
// "English" here means *script, not ASCII* -- `Universite de Montreal` written
// as `Université de Montréal`, `Saarbrücken` and `Košice` are valid content and
// must keep working. Only Han, Kana and Hangul are rejected.
//
// One thing is deliberately *not* checked here:
// a person's name, their unit and their role title keep the form the page
// published them in, in every script. That rule cannot live in a character
// sweep, so it lives in the schema, which applies this sweep field by field
// -- to the keys each kind writes in its own words, `VOICE_KEYS` -- rather
// than to a whole record.

const NON_ENGLISH_SCRIPT =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

const SCRIPT_LABELS = [
  ["Han (Chinese/Japanese)", /\p{Script=Han}/u],
  ["Hiragana (Japanese)", /\p{Script=Hiragana}/u],
  ["Katakana (Japanese)", /\p{Script=Katakana}/u],
  ["Hangul (Korean)", /\p{Script=Hangul}/u],
];

const NON_ENGLISH_SCRIPT_HINT =
  "this field is English throughout (script, not ASCII, so accented Latin is fine); " +
  "write the applicant's language in the report prose, and keep the English form here";

// { script, sample } for the first blocked character, or null.
function findNonEnglishScript(value) {
  if (typeof value !== "string") return null;
  const match = NON_ENGLISH_SCRIPT.exec(value);
  if (!match) return null;
  const label = SCRIPT_LABELS.find(([, pattern]) => pattern.test(match[0]));
  return { script: label ? label[0] : "non-English script", sample: sampleAround(value, match.index) };
}

// Recursive walk over strings, arrays and plain objects. Returns
// { path, script, sample } for the first blocked character, or null. The path
// is dotted so the failure message names the offending field.
function findNonEnglishScriptDeep(value, basePath = "") {
  if (typeof value === "string") {
    const hit = findNonEnglishScript(value);
    return hit ? { path: basePath, ...hit } : null;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const hit = findNonEnglishScriptDeep(value[index], `${basePath}[${index}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      const hit = findNonEnglishScriptDeep(entry, basePath ? `${basePath}.${key}` : key);
      if (hit) return hit;
    }
    return null;
  }
  return null;
}

function nonEnglishScriptReason(hit) {
  return `${hit.path || "value"} contains ${hit.script} characters ("${hit.sample}"); ${NON_ENGLISH_SCRIPT_HINT}`;
}

function sampleAround(value, index) {
  const start = Math.max(0, index - 12);
  return value.slice(start, start + 32).replace(/\s+/g, " ").trim();
}

module.exports = { findNonEnglishScriptDeep, nonEnglishScriptReason };
