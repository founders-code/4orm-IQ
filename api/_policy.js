/**
 * 4orm IQ - THE RULE DECLARATION
 *
 * The rules a check runs under, as one object, versioned by hand.
 *
 * Every run row in the operations log commits to the VERSION string below and
 * never to what these rules said. That separation is the whole point: it is
 * what lets a rule change without disturbing a hash already written. The price
 * is that the version has to point at something, which is what recordPolicy
 * writes into ops_policy on the first check after a deploy.
 *
 * TO CHANGE A RULE:
 *   1. Change it.
 *   2. Bump VERSION to today.
 *   3. Set CHANGE_KIND, SUMMARY, REASON and EVIDENCE_URL to say what and why.
 *
 * Do not edit an entry that has already shipped. A version that changed
 * underneath a run citing it is the one thing this record exists to prevent,
 * and recordPolicy refuses it rather than trusting anybody to remember.
 *
 * EVIDENCE_URL is not decoration. A rule change without a source is an
 * assertion, and asserting without a source is the failure this whole layer
 * was built to make impossible for us as well as for the parties we check.
 */

import fs from 'fs';

function manifest() {
  try {
    return JSON.parse(fs.readFileSync(new URL('./_sr001.json', import.meta.url), 'utf8'));
  } catch { return null; }
}

const M = manifest();

export const POLICY = {
  version: '2026-09-02',
  effective_from: '2026-09-02',
  change_kind: 'RULE_CHANGED',
  summary: 'The corpus stopped keeping the reader\'s search string, the rendered result and '
         + 'every person-level record, and retention became a mechanism rather than a period '
         + 'in a document.',
  reason: 'The published privacy notice said the search string, the result and any person\'s '
        + 'name were not kept. That was true of the operations chain and false of the corpus, '
        + 'which wrote the string on an index, the whole rendered payload beside it, and a '
        + 'persistent person graph the page suppressed only at render. The string is now a '
        + 'salted hash, the payload and the headline are gone, person records are refused on '
        + 'the write path and rejected by a database constraint, the schema lock reads every '
        + 'schema rather than one, and purge_expired enforces twelve and twenty four month '
        + 'periods that nothing enforced before. Two measurement defects were corrected with '
        + 'it: the chain verifier did not read user_assert, so a run that overrode the '
        + 'person-name gate would have been reported as tampered with, and four counters were '
        + 'written as zero having never been measured.',
  evidence_url: null,          /* internal change: no external record to cite */
  author: '4orm Finance',

  /* Read off the register, never typed. If the manifest is missing these are
     zero, which reads as "we do not know" rather than as a number we made up. */
  manifest_generated: M ? M.generated : null,
  sources_total:      M ? (M.total | 0) : 0,
  sources_enabled:    M ? (M.enabled || []).length : 0,
  sources:            M ? (M.enabled || []) : [],
  /* The registers the register itself marks CRITICAL. Read here so that a run
     row's critical_failed count is measured against the manifest rather than
     against a list somebody typed into check.js. */
  critical:           M ? (M.critical || []) : [],
  sources_critical:   M ? (M.critical || []).length : 0,
  enforcement_on:     true,
};

/** The version a run row should cite. One place, so the row and the policy
 *  record can never disagree about which rules governed a check. */
export const POLICY_VERSION = POLICY.version;
