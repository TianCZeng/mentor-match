// Which publication identifier a string is, if any: a DOI, an arXiv id, a PMID
// or an OpenAlex work id, the four AGENTS.md principle 3 accepts.
//
// Offline and deliberately not a resolver. It says a string has the shape of
// an identifier, never that the record exists: a guard that fails because a
// server is down is not a guard.
//
// Every form an identifier is written in is accepted and normalised before the
// shape test, because a check that knows one form refuses correct identifiers:
// `10.…`, `doi:10.…` and `https://doi.org/10.…`; an arXiv id with or without
// `arXiv:`, old style or new, with or without its version.
// A placeholder -- `unknown`, `n/a`, `tbd` -- has no identifier's shape, so it
// fails here with no list of words to keep.
//
// A PMID is the one form written with its scheme: `PMID: 12345678`, or the
// PubMed URL. A bare number says nothing about which identifier it is, and a
// year or a count would pass as one.
const FORMS = [
  {
    scheme: "doi",
    pattern: /^(?:(?:https?:\/\/)?(?:dx\.)?doi\.org\/|doi:\s*)?(10\.\d{4,9}\/\S+)$/i,
    // DOIs are case-insensitive by specification, so the join key is lowercase.
    key: (match) => `doi:${match[1].toLowerCase()}`,
  },
  {
    scheme: "arxiv",
    pattern: /^(?:(?:https?:\/\/)?(?:www\.|export\.)?arxiv\.org\/(?:abs|pdf)\/|arxiv:\s*)?(\d{4}\.\d{4,5}|[a-z-]+(?:\.[a-z]{2})?\/\d{7})(?:v\d+)?(?:\.pdf)?$/i,
    // The version is dropped from the key: v1 and v3 are one paper.
    key: (match) => `arxiv:${match[1].toLowerCase()}`,
  },
  {
    scheme: "pmid",
    pattern: /^(?:(?:https?:\/\/)?pubmed\.ncbi\.nlm\.nih\.gov\/|pmid:\s*)(\d{1,8})\/?$/i,
    key: (match) => `pmid:${match[1]}`,
  },
  {
    scheme: "openalex",
    pattern: /^(?:(?:https?:\/\/)?(?:api\.)?openalex\.org\/(?:works\/)?)?(W\d+)$/i,
    key: (match) => `openalex:${match[1].toUpperCase()}`,
  },
];

// { scheme, key } for an identifier in any written form, or null. `key` is the
// normalised form two layers compare, so a row that writes `doi:10.1038/X` and
// a summary that writes `https://doi.org/10.1038/x` name the same paper.
function parseIdentifier(value) {
  const text = String(value ?? "").trim();
  for (const form of FORMS) {
    const match = form.pattern.exec(text);
    if (match) return { scheme: form.scheme, key: form.key(match) };
  }
  return null;
}

const IDENTIFIER_FORMS = "a DOI (10.…, doi:10.… or https://doi.org/10.…), an arXiv id (2401.12345, arXiv:2401.12345 or its arxiv.org URL), a PMID written as PMID: 12345678 or its PubMed URL, or an OpenAlex work id (W123…)";

module.exports = { IDENTIFIER_FORMS, parseIdentifier };
