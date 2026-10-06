import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace-Pakete werden direkt aus TypeScript gebündelt.
  transpilePackages: [
    '@vermieteros/db',
    '@vermieteros/post',
    '@vermieteros/rechenkern',
    '@vermieteros/schema',
  ],
  serverExternalPackages: ['postgres', 'imapflow', 'mailparser', '@aws-sdk/client-s3'],
  output: 'standalone',
}

export default nextConfig
