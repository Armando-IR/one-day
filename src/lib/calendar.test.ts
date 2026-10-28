import { describe, expect, it } from 'vitest';
import { googleCalendarUrl, toIcs } from './calendar';

const base = { uid: 'x', title: 'Assicurazione, 260 €', date: '2027-03-01' };

describe('aggiungi al calendario', () => {
  it('le spese di ogni anno si ripetono, fino all\'ultimo mese se c\'è', () => {
    expect(toIcs({ ...base, yearly: true })).toContain('RRULE:FREQ=YEARLY\r\n');
    expect(toIcs({ ...base, yearly: true, yearlyCount: 3 })).toContain('RRULE:FREQ=YEARLY;COUNT=3\r\n');
    expect(toIcs({ ...base, yearly: true, yearlyCount: 1 })).not.toContain('RRULE');
    expect(googleCalendarUrl({ ...base, yearly: true, yearlyCount: 3 })).toContain(`recur=${encodeURIComponent('RRULE:FREQ=YEARLY;COUNT=3')}`);
  });
  it('le rate si ripetono ogni mese per il numero di rate', () => {
    expect(toIcs({ ...base, monthlyCount: 12 })).toContain('RRULE:FREQ=MONTHLY;COUNT=12\r\n');
    expect(toIcs(base)).not.toContain('RRULE');
  });
  it('testo con virgole e a capo come vuole il formato', () => {
    const ics = toIcs({ ...base, details: 'Riga uno\nriga, due; tre' });
    expect(ics).toContain('SUMMARY:Assicurazione\\, 260 €');
    expect(ics).toContain('DESCRIPTION:Riga uno\\nriga\\, due\\; tre');
  });
});
