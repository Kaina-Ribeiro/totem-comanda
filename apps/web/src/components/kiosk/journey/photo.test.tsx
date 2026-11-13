// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Photo } from "./photo";

const picture = { url: "/media/croissant.jpg", alt: "Croissant" };

/** jsdom never loads images: this says whether the browser already had the photo. */
function browserHasPhoto(has: boolean) {
  Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => has });
  Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", { configurable: true, get: () => (has ? 324 : 0) });
}

describe("Photo", () => {
  afterEach(() => browserHasPhoto(false));

  it("stays hidden until the photo arrives, then fades in", () => {
    browserHasPhoto(false);
    render(<Photo picture={picture} variant="thumb" />);
    const photo = screen.getByRole("img", { name: "Croissant" });
    expect(photo.className).toContain("opacity-0");

    fireEvent.load(photo);

    expect(photo.className).toContain("opacity-100");
    expect(photo.className).toContain("transition-opacity");
  });

  it("shows a photo the browser already has at once, without the fade", () => {
    browserHasPhoto(true);
    render(<Photo picture={picture} variant="thumb" />);
    const photo = screen.getByRole("img", { name: "Croissant" });

    expect(photo.className).toContain("opacity-100");
    expect(photo.className).not.toContain("transition-opacity");
  });

  it("asks for the thumbnail in one fixed width and for the item photo by the stage's width", () => {
    render(
      <>
        <Photo picture={picture} variant="thumb" />
        <Photo picture={{ url: "/media/b.jpg", alt: "Baguete" }} variant="hero" />
      </>,
    );
    const thumb = screen.getByRole("img", { name: "Croissant" });
    const hero = screen.getByRole("img", { name: "Baguete" });
    expect([thumb.getAttribute("width"), thumb.getAttribute("sizes")]).toEqual(["384", null]);
    expect([hero.getAttribute("width"), hero.getAttribute("sizes")]).toEqual([null, "1080px"]);
  });

  it("has no alt text when it only decorates", () => {
    const { container } = render(<Photo picture={picture} variant="thumb" decorative />);
    expect(container.querySelector("img")!.getAttribute("alt")).toBe("");
  });

  it("keeps the caller's classes", () => {
    render(<Photo picture={picture} variant="thumb" className="grayscale" />);
    expect(screen.getByRole("img", { name: "Croissant" }).className).toContain("grayscale");
  });
});
