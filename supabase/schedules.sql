create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'jhunay-promotion-dispatch-every-five-minutes',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'jhunay_promotion_function_url'
        limit 1
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-promotion-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'jhunay_promotion_cron_secret'
          limit 1
        )
      ),
      body := '{}'::jsonb
    );
  $$
);