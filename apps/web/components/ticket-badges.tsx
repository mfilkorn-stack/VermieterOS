import type { Prioritaet, TicketStatus } from '@vermieteros/schema'
import {
  CircleCheck,
  CircleDot,
  CalendarClock,
  HardHat,
  Siren,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { PRIORITAET_TEXT, TICKET_STATUS_TEXT } from '@/lib/betrieb-text'
import { Status } from './status'

const STATUS_TON: Record<TicketStatus, 'rot' | 'gelb' | 'gruen' | 'neutral'> = {
  gemeldet: 'gelb',
  beauftragt: 'neutral',
  termin: 'neutral',
  erledigt: 'gruen',
  abgeschlossen: 'gruen',
  verworfen: 'neutral',
}
const STATUS_ICON = {
  gemeldet: CircleDot,
  beauftragt: HardHat,
  termin: CalendarClock,
  erledigt: CircleCheck,
  abgeschlossen: CircleCheck,
  verworfen: XCircle,
} as const

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <Status ton={STATUS_TON[status]} icon={STATUS_ICON[status]} testId="ticket-status">
      {TICKET_STATUS_TEXT[status]}
    </Status>
  )
}

export function PrioritaetBadge({ p }: { p: Prioritaet }) {
  if (p === 'notfall') {
    return (
      <Status ton="rot" icon={Siren}>
        {PRIORITAET_TEXT[p]}
      </Status>
    )
  }
  if (p === 'hoch') {
    return (
      <Status ton="gelb" icon={TriangleAlert}>
        {PRIORITAET_TEXT[p]}
      </Status>
    )
  }
  return null
}
