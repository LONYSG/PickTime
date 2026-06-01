import { supabase } from './supabase';

/** Returns a Map of YYYY-MM-DD → holiday name for the given year. */
export async function fetchYearHolidays(year: number): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('holidays')
    .select('date, name')
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`);

  if (error || !data) return new Map();
  return new Map(data.map((h: { date: string; name: string }) => [h.date, h.name]));
}
