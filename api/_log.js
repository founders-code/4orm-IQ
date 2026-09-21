/**
 * 4orm IQ - THE ONE PLACE THAT WRITES TO THE LOG
 *
 * Every server-side message goes through here, and this file holds the only
 * console call in api/. That is not tidiness. A log line written at the point
 * of failure is written by somebody holding the failing value, and the failing
 * value on this product is somebody's name, domain or email address. Routing
 * every line through one function means there is one place to check, and one
 * place that scrubs.
 *
 * Three rules.
 *
 *   The caller never sees the exception. A database error carries table names,
 *   column names and sometimes the offending row. The client gets a code.
 *
 *   The log never carries an identifier. Anything shaped like an email address,
 *   a domain, a connection string, a bearer token or a key is replaced before
 *   it is written, whatever it was attached to.
 *
 *   A failure to log is never a failure. Every path here is wrapped.
 */

/* Patterns that must not survive into a log line. Order matters: the longer
   shapes are removed first so a connection string is not left as a bare host. */
const SCRUB = [
  [/\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s'"]+/gi, '<connection>'],
  [/\b(?:sk|pk|rk)[-_][A-Za-z0-9_-]{12,}/g,                      '<key>'],
  [/\bBearer\s+[A-Za-z0-9._-]{10,}/gi,                           'Bearer <token>'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9._-]{8,}/g,                '<token>'],
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,                              '<email>'],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g,                               '<ip>'],
  [/\bhttps?:\/\/[^\s'"]+/gi,                                    '<url>'],
  /* A bare hostname last, so it cannot eat the halves of something already
     replaced above. */
  [/\b(?=[a-z0-9-]{1,63}\.)(?:[a-z0-9-]+\.)+(?:com|net|org|io|co|ca|finance|xyz|app|dev|ai|uk|au)\b/gi,
                                                                 '<host>'],
];

export function scrub(v) {
  let s = typeof v === 'string' ? v : String(v?.message || v || '');
  for (const [re, to] of SCRUB) s = s.replace(re, to);
  return s.slice(0, 300);
}

/**
 * Record a fault. `where` names the route, `err` is the exception. Nothing
 * else is accepted, because a third argument is how a caller ends up passing
 * the value that failed.
 */
export function logFault(where, err) {
  try {
    const code = err && (err.code || err.name) ? String(err.code || err.name).slice(0, 40) : '';
    /* THE ONLY CONSOLE CALL IN api/. Anything else that wants to say something
       says it through this function. tools/scanner.mjs fails the build if a
       second one appears. */
    console.error('[' + String(where).slice(0, 24) + ']'
      + (code ? ' ' + code : '') + ' ' + scrub(err));
  } catch {}
}

/**
 * Record something that is not a failure: a stage reached, a count, a decision.
 * Same scrub, same single writer.
 */
export function logNote(where, message) {
  try {
    console.error('[' + String(where).slice(0, 24) + '] ' + scrub(message));
  } catch {}
}
