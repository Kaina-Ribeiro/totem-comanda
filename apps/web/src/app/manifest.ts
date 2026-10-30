import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Comanda",
    short_name: "Comanda",
    start_url: "/kiosk",
    display: "fullscreen",
    orientation: "portrait",
    background_color: "#2a1c16",
    theme_color: "#4e3426",
  };
}
