'use client'

import { useRouter } from 'next/navigation'
import ClientForm from '@/components/clients/client-form'

export default function NewClientForm() {
  const router = useRouter()

  return (
    <ClientForm
      onSuccess={(id) => router.push(`/clients/${id}`)}
      onCancel={() => router.push('/clients')}
    />
  )
}
