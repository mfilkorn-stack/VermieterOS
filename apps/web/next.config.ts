import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace-Pakete werden direkt aus TypeScript gebündelt.
  transpilePackages: [
    '@vermieteros/db',
    '@vermieteros/ki',
    '@vermieteros/pdf',
    '@vermieteros/post',
    '@vermieteros/rechenkern',
    '@vermieteros/schema',
  ],
  serverExternalPackages: ['postgres', 'imapflow', 'mailparser', '@aws-sdk/client-s3'],
  output: 'standalone',
  // Dokumente bis 20 MB über Server Actions (WP 1.7); Caddy begrenzt davor nicht.
  experimental: { serverActions: { bodySizeLimit: '21mb' } },
}

export default nextConfig
