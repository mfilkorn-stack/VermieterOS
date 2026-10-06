'use client'

import { createAuthClient } from 'better-auth/react'
import { magicLinkClient, organizationClient, twoFactorClient } from 'better-auth/client/plugins'
import { ac, roles } from './rechte'

export const authClient = createAuthClient({
  plugins: [organizationClient({ ac, roles }), twoFactorClient(), magicLinkClient()],
})
