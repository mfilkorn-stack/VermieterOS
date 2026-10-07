import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { createHash } from 'node:crypto'

/**
 * Object Storage, inhaltsadressiert: Der Schlüssel enthält die SHA-256 des Inhalts.
 * Gleiche Datei = gleicher Schlüssel, nie überschrieben, nie gelöscht.
 */
export type Speicher = {
  /** Legt den Inhalt ab, falls noch nicht vorhanden. Liefert Schlüssel, Prüfsumme, Größe. */
  ablegen(
    mandantId: string,
    art: 'roh' | 'anhang' | 'dokument',
    inhalt: Buffer,
    mimeTyp: string,
  ): Promise<{ schluessel: string; sha256: string; groesse: number }>
  holen(schluessel: string): Promise<Buffer>
}

export type SpeicherKonfig = {
  endpoint: string
  region: string
  bucket: string
  accessKey: string
  secretKey: string
}

export function speicherKonfigAusUmgebung(env = process.env): SpeicherKonfig {
  const fehlt = ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'].filter(
    (k) => !env[k],
  )
  if (fehlt.length > 0) throw new Error(`Object Storage nicht konfiguriert: ${fehlt.join(', ')}`)
  return {
    endpoint: env['S3_ENDPOINT']!,
    region: env['S3_REGION'] ?? 'eu-central',
    bucket: env['S3_BUCKET']!,
    accessKey: env['S3_ACCESS_KEY']!,
    secretKey: env['S3_SECRET_KEY']!,
  }
}

export function sha256(inhalt: Buffer): string {
  return createHash('sha256').update(inhalt).digest('hex')
}

export function s3Speicher(k: SpeicherKonfig): Speicher & { bucketSicherstellen(): Promise<void> } {
  const client = new S3Client({
    endpoint: k.endpoint,
    region: k.region,
    forcePathStyle: true,
    credentials: { accessKeyId: k.accessKey, secretAccessKey: k.secretKey },
  })
  return {
    async bucketSicherstellen() {
      try {
        await client.send(new HeadBucketCommand({ Bucket: k.bucket }))
      } catch {
        await client.send(new CreateBucketCommand({ Bucket: k.bucket }))
      }
    },
    async ablegen(mandantId, art, inhalt, mimeTyp) {
      const hash = sha256(inhalt)
      const schluessel = `mandanten/${mandantId}/${art}/${hash.slice(0, 2)}/${hash}`
      const vorhanden = await client
        .send(new HeadObjectCommand({ Bucket: k.bucket, Key: schluessel }))
        .then(() => true)
        .catch((e: { name?: string; $metadata?: { httpStatusCode?: number } }) => {
          if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) return false
          throw e
        })
      if (!vorhanden) {
        await client.send(
          new PutObjectCommand({
            Bucket: k.bucket,
            Key: schluessel,
            Body: inhalt,
            ContentType: mimeTyp,
            Metadata: { sha256: hash },
          }),
        )
      }
      return { schluessel, sha256: hash, groesse: inhalt.length }
    },
    async holen(schluessel) {
      const r = await client.send(new GetObjectCommand({ Bucket: k.bucket, Key: schluessel }))
      const inhalt = Buffer.from(await r.Body!.transformToByteArray())
      const erwartet = schluessel.split('/').at(-1)
      if (erwartet && sha256(inhalt) !== erwartet)
        throw new Error(`Prüfsumme stimmt nicht: ${schluessel}`)
      return inhalt
    },
  }
}
