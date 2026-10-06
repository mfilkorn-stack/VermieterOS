import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace-Pakete werden direkt aus TypeScript gebündelt.
  transpilePackages: ['@vermieteros/db', '@vermieteros/rechenkern'],
  serverExternalPackages: ['postgres'],
  output: 'standalone',
}

export default nextConfig
