'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LOCALE_COOKIE, type Locale } from '@/lib/i18n/config'
import { dictionaries, fmt, type Dict } from '@/lib/i18n/dictionaries'

interface LocaleContextType {
  locale: Locale
  t: Dict
  fmt: typeof fmt
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'en',
  t: dictionaries.en,
  fmt,
  setLocale: () => {},
})

// Client-side counterpart to getDict() (server components read the cookie
// directly). Used by client components — the language switcher, and any
// learner-facing client component that renders translated text.
export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const router = useRouter()
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  useEffect(() => setLocaleState(initialLocale), [initialLocale])

  const setLocale = (next: Locale) => {
    if (next === locale) return
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    setLocaleState(next)
    router.refresh()
  }

  return (
    <LocaleContext.Provider value={{ locale, t: dictionaries[locale], fmt, setLocale }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}
