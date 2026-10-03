const jsonHeaders = { 'Content-Type': 'application/json' };

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...jsonHeaders,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
      'Vary': 'Origin'
    }
  });
}

function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `593${digits.slice(1)}`;
  else if (digits.length === 9) digits = `593${digits}`;
  return /^5939\d{8}$/.test(digits) ? `+${digits}` : null;
}

Deno.serve(async request => {
  const siteOrigin = Deno.env.get('SITE_ORIGIN');
  const requestOrigin = request.headers.get('origin');

  if (!siteOrigin) return new Response('Server is not configured.', { status: 503 });
  if (requestOrigin && requestOrigin !== siteOrigin) return new Response('Origin not allowed.', { status: 403 });
  if (request.method === 'OPTIONS') return new Response('ok', {
    headers: {
      'Access-Control-Allow-Origin': siteOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
      'Vary': 'Origin'
    }
  });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, siteOrigin);

  try {
    const payload = await request.json();
    if (payload.website) return jsonResponse({ ok: true }, 200, siteOrigin);
    if (payload.consent !== true) return jsonResponse({ error: 'Consent is required.' }, 400, siteOrigin);

    const phone = normalizePhone(payload.phone);
    if (!phone) return jsonResponse({ error: 'Enter a valid Ecuadorian mobile number.' }, 400, siteOrigin);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Registration service is not configured.' }, 503, siteOrigin);

    const response = await fetch(`${supabaseUrl}/rest/v1/promotion_subscribers?on_conflict=phone_e164`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        phone_e164: phone,
        consented_at: new Date().toISOString(),
        is_active: true,
        unsubscribed_at: null,
        source: 'web-menu'
      })
    });

    if (!response.ok) {
      console.error('Subscriber upsert failed:', response.status, await response.text());
      return jsonResponse({ error: 'Registration could not be saved. Try again later.' }, 502, siteOrigin);
    }

    return jsonResponse({ ok: true }, 200, siteOrigin);
  } catch (error) {
    console.error('Subscription request failed:', error);
    return jsonResponse({ error: 'Invalid registration request.' }, 400, siteOrigin);
  }
});