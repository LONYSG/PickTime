import { supabase } from './supabase';

export async function fetchYearHolidays(year: number): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('holidays')
    .select('date')
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`);

  if (error || !data) return new Set();
  return new Set(data.map((h: { date: string }) => h.date));
}
