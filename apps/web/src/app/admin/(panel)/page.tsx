import { Card, PageHeader } from "@/components/admin/ui";

export default function AdminHomePage() {
  return (
    <>
      <PageHeader title="Bom dia!" description="O que você quer ajustar na padaria hoje?" />
      <Card>
        <p className="text-sm text-muted">
          Use o menu para cuidar dos cardápios, itens, aparelhos e da loja.
        </p>
      </Card>
    </>
  );
}
