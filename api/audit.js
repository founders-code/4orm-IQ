/**
 * GET /api/audit
 *
 * The change register, merged: the reviewed copy in docs/change-register.json
 * and whatever the system has written about itself since.
 *
 * It returns the register and it never returns a check. There is no identifier
 * anybody searched in here, no party any check was about, and no result any
 * check returned, because the table it reads has no column for any of them.
 *
 * BEHIND THE GATE. That paragraph is about what the register cannot leak of a
 * consumer's search, and it is still true. It says nothing about the register
 * itself, which is an internal record: what changed in this product, when, by
 * whom, how severe, and why. This route served all of it to anybody who asked,
 * with no token, while the same file was being held off the deployment as
 * internal. A static file excluded and an API route left open are the same
 * disclosure with different plumbing. requireAdmin now stands in front of it,
 * which means no allowlist configured closes the route rather than opening it.
 */
import { merge, sortEntries, KIND_LABEL, SEVERITY_LABEL } from './_audit.js';
import { requireAdmin } from './_auth.js';
import { logFault } from './_log.js';
import { readFile } from 'fs/promises';
import path from 'path';

export const config = { maxDuration: 15 };

async function fileRegister() {
  try {
    const p = path.join(process.cwd(), 'docs', 'change-register.json');
    return JSON.parse(await readFile(p, 'utf8'));
  } catch { return { entries: [] }; }
}

/* THIS HALF HAD NEVER RUN. It imported @neondatabase/serverless, which is not in
   package.json and is imported nowhere else in the repository: every call landed
   in the catch below and the route reported its own register as unreachable,
   truthfully and for a reason nobody had read. The rest of the repository talks
   to Postgres through pg, which IS a dependency, so this now does the same, in
   the shape api/retain.js uses. */
async function dbRows() {
  if (!process.env.POSTGRES_URL) return { rows: [], state: 'no database configured' };
  let client;
  try {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
      max: 1, connectionTimeoutMillis: 5000
    });
    client = await pool.connect();
    const out = await client.query(
      'select id, at, kind, area, title, why, detail, actor, build, severity, report '
      + 'from audit_changes order by at desc limit 500');
    return { rows: out.rows, state: 'read' };
  } catch (e) {
    logFault('audit.register', e);
    /* A register that cannot reach its runtime half says so. Reporting a
       partial register as a whole one would be the same failure this page
       exists to catch, committed by the page itself. */
    return { rows: [], state: 'unreachable' };
  } finally {
    if (client) { try { client.release(); } catch {} }
  }
}

export default async function handler(req, res) {
  /* Same gate as the other internal routes: Clerk verifies identity, the
     allowlist decides access, and an unconfigured allowlist returns 503. */
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error, reason: auth.reason });

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
