import { listeTickets } from '@vermieteros/db'
import { CalendarClock, HardHat, MapPin, Plus, Wrench } from 'lucide-react'
import Link from 'next/link'
import { PrioritaetBadge, TicketStatusBadge } from '@/components/ticket-badges'
import { zeitpunktAnzeige } from '@/lib/format'
import { darf, mitMandant } from '@/lib/sitzung'

export default async function TicketsSeite({
  searchParams,
}: {
  searchParams: Promise<{ alle?: string }>
}) {
  const alle = (await searchParams).alle === '1'
  const tickets = await mitMandant((tx) => listeTickets(tx, { offen: !alle }))
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  return (
    <>
      <div className="seitenkopf">
        <div>
          <h1>Tickets</h1>
          <p className="leise">Mängel von der Meldung bis zur Rechnung.</p>
        </div>
        {schreiben ? (
          <Link className="knopf" href="/tickets/neu" data-testid="ticket-neu">
            <Plus size={18} aria-hidden />
            Ticket anlegen
          </Link>
        ) : null}
      </div>
      <nav
        className="reiter"
        aria-label="Filter"
        style={{ marginBottom: 16, width: 'fit-content' }}
      >
        <Link href="/tickets" aria-current={alle ? undefined : 'page'}>
          Offen
        </Link>
        <Link href="/tickets?alle=1" aria-current={alle ? 'page' : undefined}>
          Alle
        </Link>
      </nav>
      {tickets.length === 0 ? (
        <p className="leise" data-testid="tickets-leer">
          {alle ? 'Noch keine Tickets.' : 'Keine offenen Tickets.'}{' '}
          {schreiben ? <Link href="/tickets/neu">Ticket anlegen</Link> : null}
        </p>
      ) : null}
      <ul className="liste" data-testid="ticketliste">
        {tickets.map((t) => (
          <li key={t.id} className="karte nachricht" data-testid="ticket" data-titel={t.titel}>
            <div className="nachricht-kopf">
              <Link href={`/tickets/${t.id}`}>
                <Wrench size={15} aria-hidden style={{ verticalAlign: '-2px', marginRight: 6 }} />
                {t.titel}
              </Link>
              <span className="meta">
                <PrioritaetBadge p={t.prioritaet} />
                <TicketStatusBadge status={t.status} />
              </span>
            </div>
            <p className="meta">
              <span>
                <MapPin size={14} aria-hidden />
                {t.einheit ? `${t.objekt} · ${t.einheit}` : t.objekt}
              </span>
              {t.auftragnehmer ? (
                <span>
                  <HardHat size={14} aria-hidden />
                  {t.auftragnehmer}
                </span>
              ) : null}
              {t.termin ? (
                <span>
                  <CalendarClock size={14} aria-hidden />
                  {zeitpunktAnzeige(t.termin)}
                </span>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}
