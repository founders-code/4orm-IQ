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
  version: '2026-09-01',
  effective_from: '2026-09-01',
  change_kind: 'RULE_CHANGED',
  summary: 'Row hashes carry a schema marker and the recorded fields gained a sector. '
         + 'The console runs live by default rather than reading the seeded corpus.',
  reason: 'Recorded fields have to be able to grow, and growing them used to invalidate '
        + 'every hash already written, which is indistinguishable from tampering. Rows now '
        + 'name the canonical function that produced them and are verified under it. '
        + 'Separately, the console defaulted to the demo corpus, so a visitor sent the bare '
        + 'link got a canned answer that looked like a check and wrote nothing to the log.',
  evidence_url: null,          /* internal change: no external record to cite */
  author: '4orm Finance',

  /* Read off the register, never typed. If the manifest is missing these are
     zero, which reads as "we do not know" rather than as a number we made up. */
  manifest_generated: M ? M.generated : null,
  sources_total:      M ? (M.total | 0) : 0,
  sources_enabled:    M ? (M.enabled || []).length : 0,
  sources:            M ? (M.enabled || []) : [],
  enforcement_on:     true,
};

/** The version a run row should cite. One place, so the row and the policy
 *  record can never disagree about which rules governed a check. */
export const POLICY_VERSION = POLICY.version;
