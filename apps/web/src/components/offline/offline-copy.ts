/** Which screen the offline state covers: one app serves the kiosk, the kitchen and the back office. */
export type OfflineArea = "kiosk" | "kitchen" | "page";

const inArea = (pathname: string, area: string) =>
  pathname === area || pathname.startsWith(`${area}/`);

export function offlineArea(pathname: string): OfflineArea {
  if (inArea(pathname, "/kitchen")) return "kitchen";
  if (inArea(pathname, "/kiosk")) return "kiosk";
  return "page";
}

/** Only the kiosk talks to guests; the kitchen and the back office get plain text (COM-91). */
export const OFFLINE_COPY = {
  kiosk: {
    title: "Temporariamente offline",
    body: "Estamos sem conexão com o servidor. Faça seu pedido no balcão; o totem volta sozinho assim que a conexão voltar.",
  },
  kitchen: {
    title: "Cozinha sem conexão",
    body: "Estamos sem conexão com o servidor. A tela volta sozinha assim que a conexão voltar.",
  },
  page: {
    title: "Sem conexão",
    body: "Estamos sem conexão com o servidor. A página volta sozinha assim que a conexão voltar.",
  },
} as const satisfies Record<OfflineArea, { title: string; body: string }>;
