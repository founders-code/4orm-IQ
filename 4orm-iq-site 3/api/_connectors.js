/**
 * 4orm - Know Before You Send
 * Tier 0: direct connectors.
 *
 * These run before anything is searched. They cost nothing per call, answer in
 * milliseconds, and - the part that matters for this product - when one of them
 * returns you KNOW you reached it. Coverage stops being an estimate.
 *
 * Everything here is a public endpoint with no key and no licence condition.
 * Add a connector to this file and the coverage number goes up permanently.
 */

const UA = { 'User-Agent': '4orm-kbys/1.0 (+https://4ormiq.com)' };

async function withTimeout(url, opts, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctl.signal }); }
  finally { clearTimeout(t); }
}

/* ---------------------------------------------------------------- */
/* ICANN RDAP. The definitive record of when a domain came into      */
/* existence, and the single most decisive check in the sweep.       */
/* rdap.org bootstraps to whichever registry is authoritative.       */
/* ---------------------------------------------------------------- */
export async function rdap(domain) {
  try {
    const r = await withTimeout(`https://rdap.org/domain/${encodeURIComponent(domain)}`,
      { headers: { ...UA, Accept: 'application/rdap+json' }, redirect: 'follow' }, 8000);
    if (!r.ok) return { source: 'ICANN RDAP', status: 'not_found', http: r.status };

    const d = await r.json();
    const ev = Object.fromEntries((d.events || []).map(e => [e.eventAction, e.eventDate]));
    const registrar = (d.entities || [])
      .filter(e => (e.roles || []).includes('registrar'))
      .map(e => (e.vcardArray?.[1] || []).find(f => f[0] === 'fn')?.[3])
      .filter(Boolean)[0] || null;
    const created = ev.registration || null;

    return {
      source: 'ICANN RDAP', status: 'found', tier: 'A',
      url: `https://rdap.org/domain/${domain}`,
      created,
      age_days: created ? Math.floor((Date.now() - Date.parse(created)) / 86400000) : null,
      changed: ev['last changed'] || null,
      expires: ev.expiration || null,
      registrar,
      nameservers: (d.nameservers || []).map(n => n.ldhName).filter(Boolean),
      statuses: d.status || [],
      raw_excerpt: [
        created && `registration ${created}`,
        registrar && `registrar ${registrar}`,
        (d.nameservers || []).length && `nameservers ${(d.nameservers || []).map(n => n.ldhName).join(', ')}`,
        (d.status || []).length && `status ${(d.status || []).join(', ')}`
      ].filter(Boolean).join('; ')
    };
  } catch (e) {
    return { source: 'ICANN RDAP', status: 'unreachable', error: e.message };
  }
}

/* ---------------------------------------------------------------- */
/* Nameserver and registrar cluster.                                 */
/* Two brands on one nameserver set is one operator. This is the     */
/* signal that linked investhelm.com to nexlares.com, and it is      */
/* free to compute once the RDAP record is in hand.                  */
/* ---------------------------------------------------------------- */
export async function siblingCheck(subject, candidates = []) {
  const out = [];
  for (const c of candidates.slice(0, 4)) {
    const r = await rdap(c);
    if (r.status !== 'found') continue;
    const sharedNs = (subject.nameservers || []).filter(n =>
      (r.nameservers || []).map(x => x.toLowerCase()).includes(n.toLowerCase()));
    const sameRegistrar = subject.registrar && r.registrar && subject.registrar === r.registrar;
    if (sharedNs.length || sameRegistrar) {
      out.push({
        domain: c, created: r.created, registrar: r.registrar,
        shared_nameservers: sharedNs, same_registrar: !!sameRegistrar,
        raw_excerpt: `creation ${r.created}; registrar ${r.registrar}; nameservers ${(r.nameservers || []).join(', ')}`
      });
    }
  }
  return out;
}

/* ---------------------------------------------------------------- */
/* DNS over HTTPS. Mail configuration tells you whether anyone is    */
/* actually running a business behind the name.                      */
/* ---------------------------------------------------------------- */
export async function mailConfig(domain) {
  async function q(type) {
    try {
      const r = await withTimeout(
        `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`,
        { headers: UA }, 6000);
      const j = await r.json();
      return (j.Answer || []).map(a => a.data);
    } catch { return null; }
  }
  const [mx, txt] = await Promise.all([q('MX'), q('TXT')]);
  if (mx === null && txt === null) return { source: 'Mail configuration', status: 'unreachable' };
  const spf = (txt || []).find(t => /v=spf1/i.test(t)) || null;
  const dmarcRaw = await q('TXT').catch(() => null);
  return {
    source: 'Mail configuration', status: 'found', tier: 'A',
    mx: mx || [], spf, has_mail: !!(mx && mx.length),
    raw_excerpt: [
      (mx || []).length ? `MX ${(mx || []).join(' | ')}` : 'no MX records published',
      spf ? `SPF ${spf}` : 'no SPF record'
    ].join('; '),
    note: (mx && mx.length)
      ? 'Mail is configured for this domain.'
      : 'No mail is configured. A party soliciting money with no working mailbox on its own domain is worth noting.'
  };
}

/* ---------------------------------------------------------------- */
/* Run everything that is free and certain, in parallel.             */
/* ---------------------------------------------------------------- */
export async function runConnectors(domain) {
  if (!domain) return { reached: [], unreached: ['ICANN RDAP', 'Mail configuration'], records: {} };
  const [d, m] = await Promise.all([rdap(domain), mailConfig(domain)]);
  const records = { rdap: d, mail: m };
  const reached = [], unreached = [];
  (d.status === 'found' ? reached : unreached).push('ICANN RDAP');
  (m.status === 'found' ? reached : unreached).push('Mail configuration');
  return { reached, unreached, records };
}

export default { rdap, siblingCheck, mailConfig, runConnectors };
