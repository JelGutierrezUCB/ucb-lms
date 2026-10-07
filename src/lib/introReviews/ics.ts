// Minimal iCalendar (RFC 5545 / iMIP) builder for review-call invites. Using the
// same UID every time with a rising SEQUENCE is what makes Outlook UPDATE the
// existing event on a reschedule (or remove it on cancel) instead of adding a
// duplicate.

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

const esc = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

function fold(line: string): string {
  const out: string[] = []
  let rest = line
  while (rest.length > 74) {
    out.push(rest.slice(0, 74))
    rest = ' ' + rest.slice(74)
  }
  out.push(rest)
  return out.join('\r\n')
}

export interface IcsOptions {
  uid: string
  sequence: number
  method: 'REQUEST' | 'CANCEL'
  start: Date
  durationMin: number
  summary: string
  description: string
  location?: string | null
  url?: string
  organizerEmail: string
  organizerName: string
  attendees: { email: string; name: string }[]
}

export function buildIcs(o: IcsOptions): string {
  const end = new Date(o.start.getTime() + o.durationMin * 60000)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UCB Training Portal//Introductory Reviews//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${o.method}`,
    'BEGIN:VEVENT',
    `UID:${o.uid}`,
    `SEQUENCE:${o.sequence}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(o.start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(o.summary)}`,
    `DESCRIPTION:${esc(o.description)}`,
    ...(o.location ? [`LOCATION:${esc(o.location)}`] : []),
    ...(o.url ? [`URL:${o.url}`] : []),
    `ORGANIZER;CN=${esc(o.organizerName)}:mailto:${o.organizerEmail}`,
    ...o.attendees.map(
      a => `ATTENDEE;CN=${esc(a.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a.email}`
    ),
    `STATUS:${o.method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}
