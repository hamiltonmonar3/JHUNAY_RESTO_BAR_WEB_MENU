# JHUNAY_RESTO_BAR_WEB_MENU

El menú digital toma el orden de categorías del documento oficial y conserva los productos y precios detallados del CSV. Los datos se empaquetan en `js/menu-data.js`, por lo que `index.html` también puede abrirse directamente como archivo. Si modificas el CSV, ejecuta `node scripts/build-menu-data.js` para actualizar los datos incluidos antes de publicar.

## Promociones por WhatsApp

El menú incluye un formulario de suscripción con consentimiento explícito. La automatización usa Supabase para almacenar teléfonos y horarios con acceso restringido, y WhatsApp Business Platform para enviar plantillas aprobadas. **Los mensajes no se enviarán hasta desplegar y configurar los servicios siguientes.** No pongas tokens ni la clave `service_role` en `js/promotions-config.js`.

### Activación

1. Crea un proyecto de Supabase y aplica `supabase/migrations/20261003000000_promotions.sql` con la CLI (`supabase link` y `supabase db push`) o desde el SQL Editor. La migración crea las tablas protegidas, registra el consentimiento y carga dos promociones: martes, alitas 2x1; sábado, 20% en menestras. El horario inicial es 10:00, hora de Ecuador.
2. Despliega las funciones `subscribe-promotions`, `dispatch-promotions` y `whatsapp-webhook` desde la carpeta `supabase/functions`.
3. En Supabase, configura estos secretos de Edge Functions: `SITE_ORIGIN` (origen exacto del sitio, sin `/` al final), `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_GRAPH_API_VERSION`, `META_VERIFY_TOKEN`, `META_APP_SECRET` y `PROMOTION_CRON_SECRET`. Supabase proporciona `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` a las funciones; nunca los publiques en el frontend.
4. Configura en Meta una plantilla de marketing aprobada llamada `jhunay_weekly_promo_es`, en idioma `es_EC`, con dos variables en el cuerpo: `{{1}}` para el título y `{{2}}` para el mensaje. Incluye una instrucción para responder **BAJA**. Las promociones se envían mediante esa plantilla, como exige WhatsApp fuera de la ventana de atención al cliente.
5. En `js/promotions-config.js`, establece `subscribeUrl` como `https://<project-ref>.supabase.co/functions/v1/subscribe-promotions`. Esa URL es pública; no agregues claves a ese archivo.
6. Configura en Meta el webhook `https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook`, usa el mismo `META_VERIFY_TOKEN` y suscribe el evento `messages`. La función verifica la firma de Meta y desactiva la suscripción al recibir **BAJA**, **STOP**, **CANCELAR** o **SALIR**.
7. Habilita las extensiones `pg_cron`, `pg_net` y Vault en Supabase. En Vault, guarda `jhunay_promotion_function_url` (la URL de `dispatch-promotions`) y `jhunay_promotion_cron_secret` (el mismo valor configurado como secreto `PROMOTION_CRON_SECRET`). Ejecuta `supabase/schedules.sql` desde el SQL Editor para llamar al dispatcher cada cinco minutos.

Las promociones y horas se pueden cambiar en `public.promotion_schedules`; `weekday` usa 0 para domingo y 6 para sábado. Las imágenes y el frontend pueden validarse localmente, pero el alta y los envíos automáticos requieren el proyecto de Supabase, las credenciales de Meta y la plantilla aprobada.
