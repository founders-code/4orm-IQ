/**
 * 4orm IQ - THE CHANGE REGISTER
 *
 * Every main change to this product and to the documents that govern it, in one
 * place, each one opening to a report.
 *
 * WHY IT EXISTS. This company sells the ability to prove a record went
 * unaltered. It would be strange to run its own change history on memory. Until
 * now the only account of what changed was a build number and whatever anybody
 * remembered, which is exactly the shape of file a regulator asks for and a
 * company cannot produce.
 *
 * WHERE THE TRUTH LIVES. docs/change-register.json is the source of truth. It
 * is in the repository, it is reviewed like code, and it is embedded into the
 * control panel at build time so the panel reads the same whether it is served
 * or opened as a file. This module is the runtime half: entries the system
 * writes about itself, merged with the file on read.
 *
 * WHAT IT MAY NOT HOLD. No identifier anybody searched, no party any check was
 * about, no result any check returned. Same rule as db/telemetry.sql and for
 * the same reason.
 */

import { logFault } from './_log.js';

export const KINDS = ['code', 'document', 'policy', 'data', 'source'];
export const KIND_LABEL = {
  code:     'Code',
  document: 'Document',
  policy:   'Policy',
  data:     'Data',
  source:   'Source'
};

export const SEVERITY_LABEL = { p0: 'Blocking', p1: 'Structural', p2: 'Recorded' };

/* Nothing in a change entry may carry what a check was about. Enforced rather
   than asked for, because this is the one table somebody would reach for when
   they wanted to know "what did we change after the Acme run". */
const BANNED_KEYS = new Set(['query', 'identifier', 'subject', 'party', 'domain_checked',
                             'search', 'result', 'verdict', 'entity']);

export function sanitise(entry = {}) {
  const out = {};
  Object.keys(entry).forEach(k => { if (!BANNED_KEYS.has(k)) out[k] = entry[k]; });
  return out;
}

export function validate(e = {}) {
  const bad = [];
  if (!/^CR-\d{4}$/.test(String(e.id || ''))) bad.push('id must be CR-0000 form');
  if (!KINDS.includes(e.kind)) bad.push('kind must be one of ' + KINDS.join(', '));
  if (!e.title) bad.push('title is required');
  if (!e.why) bad.push('why is required: a change with no reason is not a record');
  if (!e.at) bad.push('at is required');
  Object.keys(e).forEach(k => { if (BANNED_KEYS.has(k)) bad.push('field not permitted here: ' + k); });
  return bad;
}

/** Newest first, then by id descending so a same-day pair is still ordered. */
export function sortEntries(rows = []) {
  return rows.slice().sort((a, b) => {
    const d = String(b.at || '').localeCompare(String(a.at || ''));
    return d !== 0 ? d : String(b.id || '').localeCompare(String(a.id || ''));
  });
}

/**
 * Merge the file register with the runtime rows. The file wins on a shared id,
 * because it is the reviewed copy. A runtime row with no file entry is kept and
 * marked, because a change the system recorded and nobody wrote down is exactly
 * the gap this register exists to surface.
 */
export function merge(fileRows = [], dbRows = []) {
  const byId = new Map();
  dbRows.forEach(r => byId.set(r.id, { ...r, source: 'runtime', unrecorded: true }));
  fileRows.forEach(r => byId.set(r.id, { ...(byId.get(r.id) || {}), ...r, source: 'register', unrecorded: false }));
  return sortEntries([...byId.values()]);
}

export async function recordChange(entry) {
  const e = sanitise(entry || {});
  const bad = validate(e);
  if (bad.length) { logFault('audit', 'change rejected: ' + bad.join('; ')); return { ok: false, bad }; }
  return { ok: true, entry: e };
}

export default { KINDS, KIND_LABEL, SEVERITY_LABEL, sanitise, validate, sortEntries, merge, recordChange };
