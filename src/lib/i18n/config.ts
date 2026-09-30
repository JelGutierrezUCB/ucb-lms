// English/Spanish support for the learner-facing UI (dashboard, catalog,
// training player, journeys, history, login). This translates the app's own
// interface text only — course titles, descriptions, quiz questions and slide
// narration stay in whatever language the admin who authored them used;
// translating authored content would need per-field translations in the
// database, which is a separate, larger piece of work.
export const LOCALES = ['en', 'es'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'ucb_locale'

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
}

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value)
}
