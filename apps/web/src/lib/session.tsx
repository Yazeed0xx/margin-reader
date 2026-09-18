import { DirectionProvider } from '@base-ui/react/direction-provider'
import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState } from 'react'

import { api, queryClient, tokenStore } from './api'

import type { Data } from './api'
import type { ReactNode } from 'react'

interface Session {
  user: Data.User | undefined
  authenticated: boolean
  loading: boolean
  profileError: unknown
  language: 'en' | 'ar'
  setLanguage: (value: 'en' | 'ar') => void
  login: (token: string) => void
  logout: () => void
  t: (en: string, ar: string) => string
}
const Context = createContext<Session | null>(null)
export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(tokenStore.get)
  const [language, setLanguage] = useState<'en' | 'ar'>(() =>
    localStorage.getItem('margin.language') === 'ar' ? 'ar' : 'en',
  )
  const profile = useQuery({
    queryKey: ['profile', token],
    queryFn: () => api.profile.profile.show({}),
    enabled: !!token,
  })
  const user = profile.data?.data
  useEffect(() => {
    if (user) {
      setLanguage(user.interfaceLanguage)
    }
  }, [user])
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    localStorage.setItem('margin.language', language)
  }, [language])
  function login(next: string) {
    queryClient.clear()
    tokenStore.set(next)
    setToken(next)
  }
  function logout() {
    tokenStore.set(null)
    setToken(null)
    queryClient.clear()
  }
  return (
    <Context.Provider
      value={{
        user,
        profileError: profile.error,
        authenticated: !!token,
        loading: !!token && profile.isPending,
        language,
        setLanguage,
        login,
        logout,
        t: (en, ar) => (language === 'ar' ? ar : en),
      }}
    >
      <DirectionProvider direction={language === 'ar' ? 'rtl' : 'ltr'}>
        {children}
      </DirectionProvider>
    </Context.Provider>
  )
}
export function useSession() {
  const value = useContext(Context)
  if (!value) {
    throw new Error('SessionProvider is required')
  }
  return value
}
