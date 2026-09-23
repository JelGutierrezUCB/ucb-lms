// Courses the newer learning features (recommendations, "all courses" browsing,
// learning paths, resume-where-you-left-off) must leave completely alone: they
// are never suggested, never offered when building a path, and the player keeps
// its original behavior for them. Their content, sections and assignments are
// managed only through the existing admin screens.
export const PROTECTED_MODULE_IDS: ReadonlySet<string> = new Set([
  // "Onboarding: Standard Office Training Checklist (UCBZW)"
  '21162b7a-f9d9-47e0-99a6-742f6ea10b0c',
])

export const isProtectedModule = (moduleId: string) => PROTECTED_MODULE_IDS.has(moduleId)
