// 한국천문연구원 특일정보 API (공공데이터포털)
// https://www.data.go.kr/data/15012690/openapi.do
const API_KEY = import.meta.env.VITE_HOLIDAY_API_KEY as string;

async function fetchYearHolidays(year: number): Promise<Set<string>> {
  // serviceKey must NOT be URL-encoded — append raw to avoid 403
  const url =
    `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo` +
    `?serviceKey=${API_KEY}&solYear=${year}&numOfRows=50&_type=json`;

  const res = await fetch(url);
  const json = await res.json();
  const raw = json.response?.body?.items?.item;
  if (!raw) return new Set();
  const items = Array.isArray(raw) ? raw : [raw];
  return new Set(
    items.map((item: { locdate: number }) => {
      const d = String(item.locdate); // e.g. "20250101"
      return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    }),
  );
}

export { fetchYearHolidays };
