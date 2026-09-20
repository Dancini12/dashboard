/* global process */
// Contador de visitantes únicos: cada IP conta uma vez (só o hash é gravado).
// Variáveis na Vercel: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e, opcional, VISITOR_IP_SALT.
import crypto from 'node:crypto';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ ok: false, error: 'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel.' });
  }

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  try {
    const upsert = await fetch(`${supabaseUrl}/rest/v1/site_visitors?on_conflict=ip_hash`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ ip_hash: hashIp(getClientIp(req)), last_seen_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(10000),
    });
    if (!upsert.ok) throw new Error(`upsert ${upsert.status}`);

    const countRes = await fetch(`${supabaseUrl}/rest/v1/site_visitors?select=ip_hash`, {
      method: 'HEAD',
      headers: { ...headers, Prefer: 'count=exact' },
      signal: AbortSignal.timeout(10000),
    });
    if (!countRes.ok) throw new Error(`count ${countRes.status}`);

    const total = Number((countRes.headers.get('content-range') || '').split('/')[1]) || 0;
    return res.status(200).json({ ok: true, count: total });
  } catch {
    return res.status(502).json({ ok: false, error: 'Contador indisponível.' });
  }
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function hashIp(ip) {
  const salt = process.env.VISITOR_IP_SALT || 'agroinfo-visitor-salt';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}
