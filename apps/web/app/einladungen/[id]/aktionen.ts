'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { feld, fehlertext, type FormStatus } from '@/lib/form-status'

export async function einladungAnnehmen(_: FormStatus, daten: FormData): Promise<FormStatus> {
  const h = await headers()
  try {
    const r = await auth.api.acceptInvitation({
      body: { invitationId: feld(daten, 'id') },
      headers: h,
    })
    const orgId = r?.invitation.organizationId
    if (orgId) await auth.api.setActiveOrganization({ body: { organizationId: orgId }, headers: h })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect('/')
}
