// The employee whose learner portal is currently being viewed by an admin/manager,
// mirrored into a cookie (in addition to sessionStorage) so server-rendered
// pages — dashboard, catalog, journeys, history — can all honor it, not just
// the client components that already read ProxyContext directly.
export const PROXY_COOKIE = 'ucb_proxy_id'
