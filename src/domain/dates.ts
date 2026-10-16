// Local-calendar dates as YYYY-MM-DD strings; avoids timezone drift from Date#toISOString.
export function toDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseDay(s);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayOf(s: string): number {
  return (parseDay(s).getDay() + 6) % 7;
}

export function today(): string {
  return toDay(new Date());
}
