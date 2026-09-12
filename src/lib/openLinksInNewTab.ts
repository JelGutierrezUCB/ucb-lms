import type { MouseEvent } from 'react'

// Attach as onClick on any container that renders admin-authored or
// converted-from-a-document HTML (dangerouslySetInnerHTML). Those <a> tags
// have no target of their own, so without this a click would navigate the
// training portal itself away to the linked page. Intercepts the click and
// opens it in a new tab instead, leaving the training in place.
export function openLinksInNewTab(e: MouseEvent) {
  const anchor = (e.target as HTMLElement).closest('a')
  if (anchor?.href) {
    e.preventDefault()
    window.open(anchor.href, '_blank', 'noopener,noreferrer')
  }
}
