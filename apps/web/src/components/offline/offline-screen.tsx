import { UnavailableScreen } from "@/components/kiosk/unavailable-screen";

/** "Temporarily offline": the server cannot be reached. No offline order queue in the MVP. */
export function OfflineScreen() {
  return (
    <UnavailableScreen
      title="Temporariamente offline"
      body="Estamos sem conexão com o servidor. Faça seu pedido no balcão; o totem volta sozinho assim que a conexão voltar."
    />
  );
}
