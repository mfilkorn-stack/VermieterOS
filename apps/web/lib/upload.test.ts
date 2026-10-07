import { DOKUMENT_TYPEN } from '@vermieteros/schema'
import { describe, expect, it } from 'vitest'
import { DOKUMENT_GRUPPEN, ERLAUBTE_TYPEN } from './dokument-text'
import { Eingabefehler } from './eingabe'
import { ablegbar, istHeic, mimeErmitteln, mitEndung, uploadVorbereiten } from './upload'

/** 16 × 16 Pixel, rot, mit libheif erzeugt */
const HEIC = Buffer.from(
  'AAAAHGZ0eXBoZWljAAAAAG1pZjFoZWljbWlhZgAAAXxtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAABoAABAAAAAAAAADMAAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABodmMxAAAAAA5waXRtAAAAAAABAAAA/GlwcnAAAADcaXBjbwAAAHVodmNDAQNwAAAAAAAAAAAAHvAA/P34+AAADwNgAAEAGEABDAH//wNwAAADAJAAAAMAAAMAHroCQGEAAQApQgEBA3AAAAMAkAAAAwAAAwAeoCCBBZbqrprm4CGgwIAAAAyAAAADAIRiAAEABkQBwXPBiQAAABNjb2xybmNseAABAA0ABoAAAAAUaXNwZQAAAAAAAABAAAAAQAAAAChjbGFwAAAAEAAAAAEAAAAQAAAAAf///9AAAAAC////0AAAAAIAAAAQcGl4aQAAAAADCAgIAAAAGGlwbWEAAAAAAAAAAQABBYECAwWEAAAAO21kYXQAAAAvKAGvEyFkY0D1JyL//2q6n/rQWf9v9lhZ3K6AwVvy+sD2ZJvA86qRnoCHaacwFXg=',
  'base64',
)
const PDF = Buffer.from('%PDF-1.4\n')

describe('mimeErmitteln', () => {
  it('erkennt HEIC am Dateianfang, auch ohne oder mit falschem Typ', () => {
    expect(istHeic(HEIC)).toBe(true)
    expect(mimeErmitteln('', 'IMG_0815.HEIC', HEIC)).toBe('image/heic')
    expect(mimeErmitteln('application/octet-stream', 'foto', HEIC)).toBe('image/heic')
    expect(mimeErmitteln('image/jpeg', 'falsch.jpg', HEIC)).toBe('image/heic')
  })

  it('vereinheitlicht JPEG-Varianten und nutzt die Endung, wenn der Typ fehlt', () => {
    expect(mimeErmitteln('image/jpg', 'a.jpg', PDF)).toBe('image/jpeg')
    expect(mimeErmitteln('image/pjpeg', 'a.jpg', PDF)).toBe('image/jpeg')
    expect(mimeErmitteln('', 'Scan.JPEG', PDF)).toBe('image/jpeg')
    expect(mimeErmitteln('', 'vertrag.pdf', PDF)).toBe('application/pdf')
    expect(mimeErmitteln('image/heif', 'a.heif', PDF)).toBe('image/heic')
  })

  it('ersetzt die Endung', () => {
    expect(mitEndung('IMG_0815.HEIC', 'jpg')).toBe('IMG_0815.jpg')
    expect(mitEndung('ohne', 'jpg')).toBe('ohne.jpg')
  })

  it('Mail-Anhänge: HEIC ist ablegbar, ZIP nicht', () => {
    expect(ablegbar('image/heic', 'a.heic')).toBe(true)
    expect(ablegbar('application/octet-stream', 'a.HEIC')).toBe(true)
    expect(ablegbar('image/jpg', 'a.jpg')).toBe(true)
    expect(ablegbar('application/zip', 'a.zip')).toBe(false)
  })
})

describe('uploadVorbereiten', () => {
  it('wandelt HEIC in JPEG um', async () => {
    const u = await uploadVorbereiten(new File([HEIC], 'IMG_0815.HEIC'), ERLAUBTE_TYPEN, 'x')
    expect(u.mime).toBe('image/jpeg')
    expect(u.dateiname).toBe('IMG_0815.jpg')
    expect([...u.inhalt.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff])
  })

  it('lässt erlaubte Dateien unverändert', async () => {
    const u = await uploadVorbereiten(
      new File([PDF], 'v.pdf', { type: 'application/pdf' }),
      ERLAUBTE_TYPEN,
      'x',
    )
    expect(u).toMatchObject({ mime: 'application/pdf', dateiname: 'v.pdf' })
    expect(u.inhalt.equals(PDF)).toBe(true)
  })

  it('lehnt andere Typen ab', async () => {
    const f = new File(['x'], 'a.zip', { type: 'application/zip' })
    await expect(uploadVorbereiten(f, ERLAUBTE_TYPEN, 'nein')).rejects.toThrow(Eingabefehler)
  })

  it('meldet kaputtes HEIC verständlich', async () => {
    const kaputt = Buffer.concat([HEIC.subarray(0, 40), Buffer.alloc(20)])
    await expect(
      uploadVorbereiten(new File([kaputt], 'a.heic'), ERLAUBTE_TYPEN, 'x'),
    ).rejects.toThrow(/HEIC/)
  })
})

describe('Dokumentarten', () => {
  it('jede Art steht in genau einer Gruppe', () => {
    const gruppiert = DOKUMENT_GRUPPEN.flatMap(([, t]) => t)
    expect([...gruppiert].sort()).toEqual([...DOKUMENT_TYPEN].sort())
  })
})
