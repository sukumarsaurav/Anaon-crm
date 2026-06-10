'use client'

import { createContext, useContext } from 'react'

type ProfileData = {
  userId: string
  fullName: string
  role: string
  email: string
  branchId: string | null
}

const ProfileContext = createContext<ProfileData | null>(null)

export function ProfileProvider({
  profile,
  children,
}: {
  profile: ProfileData
  children: React.ReactNode
}) {
  return (
    <ProfileContext.Provider value={profile}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}
