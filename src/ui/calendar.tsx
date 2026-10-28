import type { CalEvent } from '../lib/calendar';
import { addToPhoneCalendar, googleCalendarUrl } from '../lib/calendar';

// The copy built with `npm run build:demo` runs where downloads are blocked: there only Google Calendar.
const DEMO = import.meta.env.MODE === 'demo';

/** "Aggiungi al calendario", in the forms of entries with a date: the phone's calendar or Google Calendar. */
export function CalendarActions({ event, missing }: { event: CalEvent | null; missing: string }) {
  return (
    <div className="cal">
      <span className="cal-title">Aggiungi al calendario</span>
      {event ? (
        <div className="cal-buttons">
          {!DEMO && (
            <button type="button" className="btn secondary small" onClick={() => addToPhoneCalendar(event)}>
              Calendario del telefono
            </button>
          )}
          <a className="btn secondary small" href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
            Google Calendar
          </a>
        </div>
      ) : (
        <p className="muted small" style={{ margin: 0 }}>{missing}</p>
      )}
      {event && <small className="muted">Con un promemoria il giorno prima, alle 9.</small>}
    </div>
  );
}
