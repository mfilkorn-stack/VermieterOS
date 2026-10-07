import { z } from 'zod'

/** Ganzzahlige Cent, sicherer Integer-Bereich. Negative Werte nur dort, wo das Schema es erlaubt. */
export const Cent = z.number().int().safe()
export const CentNichtNegativ = Cent.nonnegative()

/** ISO-Kalendertag, z. B. 2026-01-01. */
export const Datum = z.iso.date()

/** UUID (v7 bevorzugt, jede gültige UUID akzeptiert). */
export const Uuid = z.uuid()

/** Promille als Integer (20 = 2,0 %). */
export const Promille = z.number().int().min(0).max(1000)

/** Basispunkte als Integer (350 = 3,50 %). */
export const Basispunkte = z.number().int().min(0).max(100_000)

/** Kurzer Freitext ohne führende/folgende Leerzeichen. */
export const Text = z.string().trim().min(1).max(500)
export const Notiz = z.string().trim().max(5000)
export const Plz = z
  .string()
  .trim()
  .regex(/^\d{5}$/, 'PLZ hat fünf Ziffern')
export const Email = z.email()
/** Telefonnummer wie eingegeben; nur Ziffern, Leerzeichen und + / ( ) - */
export const Telefon = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s/()-]{3,30}$/, 'Telefonnummer: Ziffern, Leerzeichen, + / ( ) -')
