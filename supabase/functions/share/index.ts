import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const APP_URL = 'https://lonysg.github.io/PickTime';
const OG_IMAGE = `${APP_URL}/og-card.png`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const roomId = url.searchParams.get('room');

  if (!roomId) {
    return Response.redirect(`${APP_URL}/`, 302);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: room } = await supabase
    .from('rooms')
    .select('title')
    .eq('id', roomId)
    .single();

  const title = escapeHtml(room?.title ?? 'PickTime');
  const appUrl = `${APP_URL}/#/room/${roomId}`;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - PickTime</title>
  <meta property="og:title" content="${title} - PickTime" />
  <meta property="og:description" content="PickTime" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${appUrl}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
</head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f5f5f5;font-family:sans-serif">
  <div style="text-align:center;padding:32px">
    <div style="font-size:48px;margin-bottom:16px">&#128197;</div>
    <h1 style="margin:0 0 8px;font-size:20px;color:#111">${title}</h1>
    <p style="margin:0 0 24px;color:#666;font-size:14px">PickTime</p>
    <a href="${appUrl}" style="display:inline-block;padding:14px 32px;background:#6366f1;color:#fff;border-radius:12px;text-decoration:none;font-weight:600;font-size:16px">&#128279; PickTime</a>
  </div>
  <script>window.location.replace(${JSON.stringify(appUrl)})</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
    },
  });
});
