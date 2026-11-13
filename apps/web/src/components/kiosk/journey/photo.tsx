import Image from "next/image";
import { useState } from "react";

import type { Picture } from "@/lib/kiosk/menu-graph";
import { PHOTO_PROPS, type PhotoVariant } from "@/lib/kiosk/photos";

/**
 * A menu photo filling its (positioned) box, COM-173. One the browser already has
 * (preloaded, or seen before) is on screen from the first frame; any other
 * fades in when it arrives, instead of popping over the box's colour.
 */
export function Photo({
  picture,
  variant,
  preload,
  decorative,
  className = "",
}: {
  picture: Picture;
  variant: PhotoVariant;
  /** For a photo on screen as soon as the screen opens. */
  preload?: boolean;
  /** The product's name is next to it: no alt text. */
  decorative?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<"waiting" | "had" | "arrived">("waiting");
  const settle = (to: "had" | "arrived") => setState((now) => (now === "waiting" ? to : now));
  // The thumbnail has a width of its own (PHOTO_PROPS), so it is stretched over the box here.
  const fit = variant === "thumb" ? "absolute inset-0 size-full object-cover" : "object-cover";
  const shown = state === "waiting" ? "opacity-0" : "opacity-100";
  const fade = state === "had" ? "" : "transition-opacity duration-200";
  return (
    <Image
      ref={(node) => {
        // Already complete when mounted: the browser had it, so no fade.
        if (node?.complete && node.naturalWidth > 0) settle("had");
      }}
      src={picture.url}
      alt={decorative ? "" : (picture.alt ?? "")}
      {...PHOTO_PROPS[variant]}
      preload={preload}
      onLoad={() => settle("arrived")}
      className={`${fit} ${shown} ${fade} ${className}`}
    />
  );
}
