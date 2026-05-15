let HOLIDAY_CACHE: Record<number, Set<string>> = {};

async function fetchHolidays(year: number): Promise<Set<string>> {
  if (HOLIDAY_CACHE[year]) return HOLIDAY_CACHE[year];
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/BR`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`Nager.Date ${res.status}`);
    const data: Array<{ date: string; localName: string; global: boolean; counties: string[] | null }> = await res.json();
    const filtered = data.filter(h => h.global === true || (h.counties && h.counties.includes("BR-SP")));
    const set = new Set(filtered.map(h => h.date));
    HOLIDAY_CACHE[year] = set;
    return set;
  } catch (err) {
    console.warn(`[business-days] Falha ao buscar feriados ${year}, usando Mon-Fri:`, err);
    return new Set();
  }
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export async function businessDaysInMonth(year: number, month: number): Promise<number> {
  const holidays = await fetchHolidays(year);
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const day = date.getDay();
    const iso = isoDate(date);
    if (day !== 0 && day !== 6 && !holidays.has(iso)) count++;
  }
  return count;
}

export async function dateAfterNBusinessDays(year: number, month: number, n: number): Promise<string> {
  const holidays = await fetchHolidays(year);
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const day = date.getDay();
    const iso = isoDate(date);
    if (day !== 0 && day !== 6 && !holidays.has(iso)) {
      count++;
      if (count === n) return iso;
    }
  }
  return isoDate(new Date(year, month - 1, daysInMonth));
}

export async function businessDaysElapsed(year: number, month: number, today: Date): Promise<number> {
  const holidays = await fetchHolidays(year);
  const limit = today.getDate();
  let count = 0;
  for (let d = 1; d <= limit; d++) {
    const date = new Date(year, month - 1, d);
    const day = date.getDay();
    const iso = isoDate(date);
    if (day !== 0 && day !== 6 && !holidays.has(iso)) count++;
  }
  return count;
}
