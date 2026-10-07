import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from './config'
import { dictionaries, type Dict } from './dictionaries'

export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : DEFAULT_LOCALE
}

// For server components: `const t = await getDict()` then `t.dashboard.title`.
export async function getDict(): Promise<Dict> {
  return dictionaries[await getLocale()]
}
