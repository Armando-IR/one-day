// "Aggiungi al calendario": an event in iCalendar format (.ics) for the phone's calendar,
// or a link that opens Google Calendar with the event already filled in.
// Events are at 9:00 local time, with a reminder the day before at the same hour.

export interface CalEvent {
  /** Stable id, so adding the same event twice updates it instead of duplicating it. */
  uid: string;
  title: string;
  /** 'YYYY-MM-DD' */
  date: string;
  details?: string;
  /** Repeat every month, this many times in all (installments). */
  monthlyCount?: number;
  /** Repeat every year (yearly expenses), this many times in all if given. */
  yearly?: boolean;
  yearlyCount?: number;
}

function rrule(e: CalEvent): string | null {
  if (e.monthlyCount && e.monthlyCount > 1) return `RRULE:FREQ=MONTHLY;COUNT=${Math.round(e.monthlyCount)}`;
  if (!e.yearly) return null;
  if (e.yearlyCount === undefined) return 'RRULE:FREQ=YEARLY';
  return e.yearlyCount > 1 ? `RRULE:FREQ=YEARLY;COUNT=${Math.round(e.yearlyCount)}` : null;
}

declare const __ICS_API__: boolean;

const compact = (date: string) => date.replace(/-/g, '');
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Text escaping required by iCalendar (RFC 5545, 3.3.11). */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Lines longer than 75 bytes are folded, continuing on the next line after a space (RFC 5545, 3.1). */
function fold(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function toIcs(e: CalEvent): string {
  const day = compact(e.date);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Finanze//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}@finanze`,
    `DTSTAMP:${stamp()}`,
    `DTSTART:${day}T090000`,
    `DTEND:${day}T093000`,
    ...(rrule(e) ? [rrule(e) as string] : []),
    `SUMMARY:${esc(e.title)}`,
    ...(e.details ? [`DESCRIPTION:${esc(e.details)}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(e.title)}`,
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function googleCalendarUrl(e: CalEvent): string {
  const day = compact(e.date);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${day}T090000/${day}T093000` });
  if (e.details) q.set('details', e.details);
  const r = rrule(e);
  if (r) q.set('recur', r);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

const fileName = (e: CalEvent) =>
  e.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'evento';

/**
 * Hands the event to the phone's calendar. Published on Vercel, the file comes back from the app's own
 * address (api/ics.js) as a real calendar file, which iPhone opens in Calendar; elsewhere it is downloaded.
 */
export function addToPhoneCalendar(e: CalEvent) {
  const ics = toIcs(e);
  const name = fileName(e);
  if (typeof __ICS_API__ !== 'undefined' && __ICS_API__) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/ics';
    form.target = '_blank';
    form.style.display = 'none';
    // a textarea keeps the line breaks of the file, which an input would drop
    for (const [k, v] of [['ics', ics], ['name', name]]) {
      const field = document.createElement('textarea');
      field.name = k;
      field.value = v;
      form.appendChild(field);
    }
    document.body.appendChild(form);
    form.submit();
    form.remove();
    return;
  }
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
