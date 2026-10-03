function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function localScheduleTime(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guayaquil',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    weekday: weekdays[parts.weekday],
    today: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:00`
  };
}

function backendHeaders(serviceRoleKey, extra = {}) {
  return {
    'apikey': serviceRoleKey,
    'Authorization': `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function patchDelivery(supabaseUrl, serviceRoleKey, deliveryId, values) {
  await fetch(`${supabaseUrl}/rest/v1/promotion_deliveries?id=eq.${deliveryId}`, {
    method: 'PATCH',
    headers: backendHeaders(serviceRoleKey, { 'Prefer': 'return=minimal' }),
    body: JSON.stringify(values)
  });
}

async function sendTemplate(phone, campaign, graphUrl, accessToken) {
  const response = await fetch(graphUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone.replace('+', ''),
      type: 'template',
      template: {
        name: campaign.template_name,
        language: { code: campaign.template_language },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: campaign.title },
            { type: 'text', text: campaign.message }
          ]
        }]
      }
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || `WhatsApp API returned ${response.status}.`);
    error.retryable = response.status === 429 || response.status >= 500;
    throw error;
  }
  return result.messages?.[0]?.id || null;
}

async function sendTemplateWithRetry(phone, campaign, graphUrl, accessToken) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const messageId = await sendTemplate(phone, campaign, graphUrl, accessToken);
      return { messageId, attempts: attempt };
    } catch (error) {
      error.attempts = attempt;
      if (error.retryable === false || attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, 300 * (2 ** (attempt - 1))));
    }
  }
}

Deno.serve(async request => {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const cronSecret = Deno.env.get('PROMOTION_CRON_SECRET');
  if (!cronSecret || request.headers.get('x-promotion-cron-secret') !== cronSecret) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const accessToken = Deno.env.get('META_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('META_PHONE_NUMBER_ID');
  const graphVersion = Deno.env.get('META_GRAPH_API_VERSION');
  if (!supabaseUrl || !serviceRoleKey || !accessToken || !phoneNumberId || !graphVersion) {
    return jsonResponse({ error: 'Promotion delivery is not configured.' }, 503);
  }

  try {
    const schedule = localScheduleTime(new Date());
    const claimResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_due_promotions`, {
      method: 'POST',
      headers: backendHeaders(serviceRoleKey),
      body: JSON.stringify({
        p_weekday: schedule.weekday,
        p_local_time: schedule.time,
        p_today: schedule.today
      })
    });
    if (!claimResponse.ok) throw new Error(`Could not claim scheduled promotions (${claimResponse.status}).`);
    const campaigns = await claimResponse.json();
    if (!campaigns.length) return jsonResponse({ sent: 0, campaigns: 0 });

    const graphUrl = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
    let sent = 0;
    let failed = 0;

    for (const campaign of campaigns) {
      for (let offset = 0; ; offset += 500) {
        const subscribersResponse = await fetch(
          `${supabaseUrl}/rest/v1/promotion_subscribers?select=id,phone_e164&is_active=eq.true&order=id&limit=500&offset=${offset}`,
          { headers: backendHeaders(serviceRoleKey) }
        );
        if (!subscribersResponse.ok) throw new Error(`Could not load subscribers (${subscribersResponse.status}).`);
        const subscribers = await subscribersResponse.json();
        if (!subscribers.length) break;

        for (const subscriber of subscribers) {
          const deliveryResponse = await fetch(`${supabaseUrl}/rest/v1/promotion_deliveries?on_conflict=promotion_id,subscriber_id,send_date`, {
            method: 'POST',
            headers: backendHeaders(serviceRoleKey, { 'Prefer': 'resolution=ignore-duplicates,return=representation' }),
            body: JSON.stringify({
              promotion_id: campaign.id,
              subscriber_id: subscriber.id,
              send_date: schedule.today,
              status: 'pending',
              attempted_at: new Date().toISOString()
            })
          });
          if (!deliveryResponse.ok) {
            failed += 1;
            continue;
          }
          const inserted = await deliveryResponse.json();
          if (!inserted.length) continue;

          const delivery = inserted[0];
          try {
            const result = await sendTemplateWithRetry(subscriber.phone_e164, campaign, graphUrl, accessToken);
            await patchDelivery(supabaseUrl, serviceRoleKey, delivery.id, {
              status: 'sent',
              attempt_count: result.attempts,
              provider_message_id: result.messageId,
              sent_at: new Date().toISOString()
            });
            sent += 1;
          } catch (error) {
            await patchDelivery(supabaseUrl, serviceRoleKey, delivery.id, {
              status: 'failed',
              attempt_count: error.attempts || 1,
              error_message: String(error.message || error).slice(0, 500)
            });
            failed += 1;
          }
        }

        if (subscribers.length < 500) break;
      }
    }

    return jsonResponse({ sent, failed, campaigns: campaigns.length });
  } catch (error) {
    console.error('Promotion dispatch failed:', error);
    return jsonResponse({ error: 'Promotion dispatch failed.' }, 500);
  }
});