import type { ReactNode } from "react";

/**
 * One wrapper per back office page (COM-140). With cacheComponents, Next keeps pages already
 * visited inside <main>, hidden with display: none. Each page in its own wrapper keeps the
 * entrance cascade (`.page-reveal` in admin.css) counting only that page's blocks, and gives
 * NavProgress one element per page to watch. `contents`: the blocks still sit in <main>'s
 * column and gap as before.
 */
export default function AdminPageTemplate({ children }: { children: ReactNode }) {
  return <div className="page-reveal contents">{children}</div>;
}
