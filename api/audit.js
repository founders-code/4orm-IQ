/**
 * GET /api/audit
 *
 * The change register, merged: the reviewed copy in docs/change-register.json
 * and whatever the system has written about itself since.
 *
 * It returns the register and it never returns a check. There is no identifier
 * anybody searched in here, no party any check was about, and no result any
 * check returned, because the table it reads has no column for any of them.
 */
import { merge, sortEntries, KIND_LABEL, SEVERITY_LABEL } from './_audit.js';
import { readFile } from 'fs/promises';
import path from 'path';

export const config = { maxDuration: 15 };

async function fileRegister() {
  try {
    const p = path.join(process.cwd(), 'docs', 'change-register.json');
    return JSON.parse(await readFile(p, 'utf8'));
  } catch { return { entries: [] }; }
}

async function dbRows() {
  if (!process.env.POSTGRES_URL) return { rows: [], state: 'no database configured' };
  try {
    const { neon } = await import('@neondatabase/serverless');
    const q = neon(process.env.POSTGRES_URL);
    const rows = await q('select id, at, kind, area, title, why, detail, actor, build, severity, report '
                       + 'from audit_changes order by at desc limit 500');
    return { rows, state: 'read' };
  } catch (e) {
    /* A register that cannot reach its runtime half says so. Reporting a
       partial register as a whole one would be the same failure this page
       exists to catch, committed by the page itself. */
    return { rows: [], state: 'unreachable: ' + e.message };
  }
}

export default async function handler(req, res) {
  const [file, db] = await Promise.all([fileRegister(), dbRows()]);
  const entries = merge(file.entries || [], db.rows || []);
  res.setHeader('cache-control', 'no-store');
  res.status(200).json({
    register: file.register || 'AUD-CR',
    title: file.title || '4orm IQ change register',
    updated: file.updated || '',
    counts: {
      total: entries.length,
      reviewed: entries.filter(e => e.source === 'register').length,
      unrecorded: entries.filter(e => e.unrecorded).length
    },
    runtime: db.state,
    labels: { kind: KIND_LABEL, severity: SEVERITY_LABEL },
    entries: sortEntries(entries)
  });
}
