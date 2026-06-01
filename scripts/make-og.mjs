// Generates public/og-card.png — the static social/KakaoTalk preview card.
// Run with: node scripts/make-og.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(__dirname, '../public/og-card.png');

const KR = "'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif";
const dots = ['#ef4444', '#f59e0b', '#22c55e', '#0ea5e9', '#a855f7', '#ec4899'];

const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/>
      <stop offset="1" stop-color="#4338ca"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#1e1b4b" flood-opacity="0.35"/>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- calendar card motif (right) -->
  <g transform="translate(742,128)" filter="url(#shadow)">
    <rect width="330" height="374" rx="28" fill="#ffffff"/>
    <rect width="330" height="78" rx="28" fill="#c7d2fe"/>
    <rect y="50" width="330" height="28" fill="#c7d2fe"/>
    <circle cx="84" cy="30" r="9" fill="#fff"/>
    <circle cx="246" cy="30" r="9" fill="#fff"/>
    ${[0, 1, 2, 3, 4]
      .flatMap((r) =>
        [0, 1, 2, 3, 4].map((c) => {
          const filled = (r * 5 + c) % 3 === 0;
          const color = dots[(r * 5 + c) % dots.length];
          return `<circle cx="${49 + c * 58}" cy="${132 + r * 52}" r="13" fill="${
            filled ? color : '#eef2ff'
          }"/>`;
        }),
      )
      .join('')}
  </g>

  <!-- text (left) -->
  <text x="92" y="250" font-family="${KR}" font-size="104" font-weight="800" fill="#ffffff">PickTime</text>
  <text x="96" y="320" font-family="${KR}" font-size="38" font-weight="600" fill="#e0e7ff">친구들과 약속 시간,</text>
  <text x="96" y="372" font-family="${KR}" font-size="38" font-weight="600" fill="#e0e7ff">가장 빠르게 맞추기</text>

  <!-- brand dots -->
  <g transform="translate(98,440)">
    ${dots.map((c, i) => `<circle cx="${i * 46}" cy="0" r="17" fill="${c}"/>`).join('')}
  </g>

  <text x="96" y="540" font-family="${KR}" font-size="26" font-weight="500" fill="#c7d2fe">링크 열고 바로 투표 · 로그인 없이 확인</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(out);
console.log('wrote', out);
