'use client'

import { useRouter } from 'next/navigation'
import ClientForm from '@/components/clients/client-form'
import type { OrgBankAccount } from '@/types'

export default function NewClientForm({ bankAccounts }: { bankAccounts: OrgBankAccount[] }) {
  const router = useRouter()

  return (
    <ClientForm
      bankAccounts={bankAccounts}
      onSuccess={(id) => router.push(`/clients/${id}`)}
      onCancel={() => router.push('/clients')}
    />
  )
}
