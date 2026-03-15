'use client'

import { createContext, useContext, useState } from 'react'

export interface OrgBrandState {
  primaryColor: string
  secondaryColor: string
  logoUrl: string | null
  orgName: string
}

interface OrgSettingsContextValue extends OrgBrandState {
  setOrgSettings: (patch: Partial<OrgBrandState>) => void
}

const OrgSettingsContext = createContext<OrgSettingsContextValue>({
  primaryColor: '#0D9488',
  secondaryColor: '#065F59',
  logoUrl: null,
  orgName: 'Revflow',
  setOrgSettings: () => {},
})

export function OrgSettingsProvider({
  children,
  initial,
}: {
  children: React.ReactNode
  initial: OrgBrandState
}) {
  const [state, setState] = useState<OrgBrandState>(initial)

  function setOrgSettings(patch: Partial<OrgBrandState>) {
    setState((prev) => ({ ...prev, ...patch }))
  }

  return (
    <OrgSettingsContext.Provider value={{ ...state, setOrgSettings }}>
      {children}
    </OrgSettingsContext.Provider>
  )
}

export function useOrgSettings(): OrgSettingsContextValue {
  return useContext(OrgSettingsContext)
}
