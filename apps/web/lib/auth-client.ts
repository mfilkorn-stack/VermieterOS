'use client'

import { createAuthClient } from 'better-auth/react'
import { magicLinkClient, organizationClient, twoFactorClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  plugins: [organizationClient(), twoFactorClient(), magicLinkClient()],
})
