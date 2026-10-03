function hex(bytes) {
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}

function safeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async request => {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const verifyToken = Deno.env.get('META_VERIFY_TOKEN');
    if (url.searchParams.get('hub.mode') === 'subscribe'
      && verifyToken
      && url.searchParams.get('hub.verify_token') === verifyToken) {
      return new Response(url.searchParams.get('hub.challenge') || '', { status: 200 });
    }
    return new Response('Forbidden.', { status: 403 });
  }

  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const appSecret = Deno.env.get('META_APP_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!appSecret || !supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Webhook is not configured.' }, 503);

  const rawBody = await request.text();
  const suppliedSignature = (request.headers.get('x-hub-signature-256') || '').replace(/^sha256=/, '').toLowerCase();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expectedSignature = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
  if (!suppliedSignature || !safeEqual(suppliedSignature, expectedSignature)) return jsonResponse({ error: 'Invalid signature.' }, 401);

  try {
    const payload = JSON.parse(rawBody);
    const changes = (payload.entry || []).flatMap(entry => entry.changes || []);
    const optOutTerms = new Set(['baja', 'stop', 'cancelar', 'salir']);
    const supabaseHeaders = {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    };

    for (const change of changes) {
      for (const message of change.value?.messages || []) {
        const text = (message.text?.body || message.button?.text || message.interactive?.button_reply?.title || '').trim().toLocaleLowerCase('es');
        if (!optOutTerms.has(text)) continue;
        const phone = `+${String(message.from || '').replace(/\D/g, '')}`;
        if (!/^\+5939\d{8}$/.test(phone)) continue;
        await fetch(`${supabaseUrl}/rest/v1/promotion_subscribers?phone_e164=eq.${encodeURIComponent(phone)}&is_active=eq.true`, {
          method: 'PATCH',
          headers: supabaseHeaders,
          body: JSON.stringify({ is_active: false, unsubscribed_at: new Date().toISOString() })
        });
      }
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('WhatsApp webhook processing failed:', error);
    return jsonResponse({ error: 'Invalid webhook payload.' }, 400);
  }
});