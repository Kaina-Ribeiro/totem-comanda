import { getImageProps } from "next/image";

import type { KioskMenu } from "@/lib/kiosk/menu-graph";
import { drain, menuPhotos, PHOTO_PROPS, type PhotoVariant } from "@/lib/kiosk/photos";

type Load = (url: string, variant: PhotoVariant) => Promise<unknown>;

/** Photos fetched at a time: the rest of the connection and the server stay free for the guest's taps. */
const AT_ONCE = 3;

/**
 * Asks the browser for a photo exactly as `<Photo>` will (same srcset, so
 * the same URL), which leaves it in the browser's caches. The
 * element is never drawn, so nothing is decoded until a screen shows it.
 */
function loadPhoto(url: string, variant: PhotoVariant): Promise<void> {
  const { props } = getImageProps({ src: url, alt: "", ...PHOTO_PROPS[variant] });
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Photo not loaded: ${url}`));
    if (props.sizes) image.sizes = props.sizes;
    if (props.srcSet) image.srcset = props.srcSet;
    image.src = props.src;
  });
}

/**
 * Loads a menu's photos in the background (COM-173): every grid thumbnail
 * first, then every item photo, so a category or an item opens with its photo
 * already in the browser. A photo loaded once is not asked for again while the
 * page lives; one that failed is tried again on the next journey.
 */
export function createPhotoPreloader(load: Load = loadPhoto, atOnce = AT_ONCE) {
  const have = new Set<string>();
  return (menu: KioskMenu) => {
    const photos = menuPhotos(menu);
    const wanted = (["thumb", "hero"] as const)
      .flatMap((variant) => photos.map((url) => ({ url, variant, key: `${variant} ${url}` })))
      .filter(({ key }) => !have.has(key));
    return drain(wanted, atOnce, async ({ url, variant, key }) => {
      await load(url, variant);
      have.add(key);
    });
  };
}

/** The page's preloader: the kiosk journey calls it when a menu arrives. */
export const preloadMenuPhotos = createPhotoPreloader();
