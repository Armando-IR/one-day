// Vercel Function: gives back, as a real calendar file, the event built by the app
// ("Aggiungi al calendario"). On iPhone a file served like this opens straight in Calendar.
// Nothing is saved: the event arrives in the request and goes back in the response.
export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).send('Usa il pulsante «Calendario del telefono» nell\'app.');
    return;
  }
  const body = req.body ?? {};
  const raw = typeof body.ics === 'string' ? body.ics : '';
  const ics = raw.replace(/\r?\n/g, '\r\n');
  const valid = ics.startsWith('BEGIN:VCALENDAR') && ics.trimEnd().endsWith('END:VCALENDAR') && ics.length <= 20000;
  if (!valid) {
    res.status(400).send('Evento non valido.');
    return;
  }
  const name = (typeof body.name === 'string' ? body.name : 'evento').replace(/[^a-z0-9-]/gi, '').slice(0, 60) || 'evento';
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${name}.ics"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(ics);
}
