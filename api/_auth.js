/**
 * 4orm IQ - ADMIN AUTHENTICATION
 *
 * Clerk verifies who somebody is. It does not decide whether they may see the
 * back office, so this file does both and keeps them separate: verify, then
 * authorise against an allowlist.
 *
 * Required environment:
 *   CLERK_SECRET_KEY        server side, verifies the session token
 *   ADMIN_EMAILS            comma separated allowlist of who may sign in
 * Optional:
 *   ADMIN_ORG_ROLE          if set, an org role that also grants access
 *
 * With CLERK_SECRET_KEY unset the route is DISABLED, not open. That direction
 * matters: a misconfigured deployment must lock the door rather than remove it.
 */

export async function requireAdmin(req) {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) return { ok: false, status: 503, error: 'admin_disabled',
                        reason: 'CLERK_SECRET_KEY is not set' };

  const allow = String(process.env.ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const role = String(process.env.ADMIN_ORG_ROLE || '').trim();
  if (!allow.length && !role)
    return { ok: false, status: 503, error: 'admin_disabled',
             reason: 'no ADMIN_EMAILS allowlist and no ADMIN_ORG_ROLE configured' };

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, status: 401, error: 'no_token' };

  let claims;
  try {
    const { verifyToken } = await import('@clerk/backend');
    claims = await verifyToken(token, { secretKey: secret });
  } catch (e) {
    return { ok: false, status: 401, error: 'bad_token',
             reason: String(e.message || e).slice(0, 140) };
  }

  /* Clerk puts the primary email on the session token only when the JWT
     template is configured to include it. Both shapes are read, and if neither
     is present the answer is no rather than a guess. */
  const email = String(claims.email || claims.primary_email_address || '').toLowerCase();
  const orgRole = String(claims.org_role || (claims.o && claims.o.rol) || '');

  const byEmail = !!email && allow.includes(email);
  const byRole  = !!role && !!orgRole && orgRole === role;
  if (!byEmail && !byRole)
    return { ok: false, status: 403, error: 'not_authorised',
             reason: email ? 'not on the allowlist' : 'the session token carries no email claim' };

  return { ok: true, subject: claims.sub, email: email || null, role: orgRole || null };
}
