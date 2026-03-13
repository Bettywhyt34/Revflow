export type UserRole = 'admin' | 'planner' | 'finance_exec' | 'compliance'

export interface Organisation {
  id: string
  name: string
  country: string
  default_currency: string
  created_at: string
}

export interface User {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  role: UserRole | null
  org_id: string
  last_login: string | null
  created_at: string
}

// Stub — expanded in Step 3
export interface Campaign {
  id: string
  org_id: string
  title: string
  created_at: string
}
