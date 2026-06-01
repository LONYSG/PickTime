/**
 * Weekly batch: fetch Korean public holidays from 한국천문연구원 특일정보 API
 * and upsert into the Supabase `holidays` table.
 *
 * Run via GitHub Actions (see .github/workflows/sync-holidays.yml).
 * Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, HOLIDAY_API_KEY
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const API_KEY = process.env.HOLIDAY_API_KEY?.trim();

async function fetchYear(year) {
  const url =
    `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo` +
    `?serviceKey=${API_KEY}&solYear=${year}&numOfRows=50&_type=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${year}: ${res.status} ${res.statusText}`);
  const json = await res.json();
  const raw = json.response?.body?.items?.item;
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map((item) => {
    const d = String(item.locdate);
    return {
      date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      name: item.dateName,
    };
  });
}

async function main() {
  const base = new Date().getFullYear();
  const years = [base, base + 1, base + 2];
  const rows = [];

  for (const year of years) {
    const h = await fetchYear(year);
    rows.push(...h);
    console.log(`${year}: ${h.length}건`);
  }

  const { error } = await supabase
    .from('holidays')
    .upsert(rows, { onConflict: 'date' });

  if (error) throw error;
  console.log(`완료: 총 ${rows.length}건 upsert`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
