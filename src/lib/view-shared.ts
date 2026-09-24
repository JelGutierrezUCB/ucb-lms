// Which "side" of the portal someone is looking at. Employees only ever have
// the learner view; admins and managers can switch between their own console
// and the learner view (to use training like a learner, or see what one sees).
export type PortalView = 'admin' | 'learner'

export const VIEW_COOKIE = 'ucb_view'
