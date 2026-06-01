import { useQuery } from '@tanstack/react-query';
import { fetchYearHolidays } from '@/lib/holidays';

/** Returns a function: dateStr → holiday name, or null if not a holiday. */
export function useHolidays(year: number) {
  const { data } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => fetchYearHolidays(year),
    staleTime: 1000 * 60 * 60 * 24, // 24h
  });
  return (dateStr: string) => data?.get(dateStr) ?? null;
}
