import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const APP_URL = 'https://lonysg.github.io/PickTime';
const OG_IMAGE = `${APP_URL}/og-card.png`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
  <title>${title} — PickTime</title>
  <meta property="og:title" content="${title} — PickTime" />
  <meta property="og:description" content="링크 열고 바로 투표 · 로그인 없이 확인" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${appUrl}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta http-equiv="refresh" content="0;url=${appUrl}" />
</head>
<body>
  <script>location.replace(${JSON.stringify(appUrl)})</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
    },
  });
});
