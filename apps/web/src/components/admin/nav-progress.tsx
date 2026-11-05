"use client";

import { useEffect, useRef, useState } from "react";

/** Only shows when a navigation takes longer than this, so quick ones never flash the bar. */
const SHOW_AFTER_MS = 150;
/** Gives up if the new page never arrives (a failed navigation), so the bar never sticks. */
const GIVE_UP_AFTER_MS = 15_000;

/** The page on screen: its wrapper from app/admin/(panel)/template.tsx. Visited pages stay
 * in <main>, hidden with display: none (cacheComponents). */
function visiblePage(main: Element) {
  return [...main.querySelectorAll(":scope > .page-reveal")].find(
    (page) => getComputedStyle(page).display !== "none",
  );
}

/**
 * A thin bar at the top while a back office page loads (instead of skeletons, which fought
 * the page entrance). It starts on a click on an internal link, creeps to 85% and completes
 * when another page is the one on screen in <main>: a new one added, or a visited one shown
 * again. Not when the URL changes: Next updates the URL first and can keep the old page on
 * screen for a while after. Styles in app/admin/(panel)/admin.css.
 */
export function NavProgress() {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  // One navigation at a time: its timers and its observer on <main>.
  const pending = useRef<{ show: number; giveUp: number; observer: MutationObserver } | null>(
    null,
  );

  useEffect(() => {
    function stop() {
      if (!pending.current) return;
      clearTimeout(pending.current.show);
      clearTimeout(pending.current.giveUp);
      pending.current.observer.disconnect();
      pending.current = null;
    }

    function finish() {
      stop();
      setState((current) => (current === "loading" ? "done" : "idle"));
    }

    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element).closest("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      const main = document.querySelector("main");
      if (!main) return;

      stop();
      const before = visiblePage(main);
      const observer = new MutationObserver(() => {
        if (visiblePage(main) !== before) finish();
      });
      // Pages are added as children of <main>, or shown again through their style.
      observer.observe(main, { childList: true, subtree: true, attributeFilter: ["style"] });
      pending.current = {
        observer,
        show: window.setTimeout(() => setState("loading"), SHOW_AFTER_MS),
        giveUp: window.setTimeout(finish, GIVE_UP_AFTER_MS),
      };
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      stop();
    };
  }, []);

  useEffect(() => {
    if (state !== "done") return;
    const reset = setTimeout(() => setState("idle"), 450);
    return () => clearTimeout(reset);
  }, [state]);

  return (
    <div
      aria-hidden="true"
      data-state={state}
      className="nav-progress pointer-events-none fixed top-0 left-0 z-50 h-[3px]"
    />
  );
}
