import { redirect } from "next/navigation";

/** "Esgotados" became "Disponibilidade" (SPEC 6, COM-147): old links still land. */
export default function SoldOutPage() {
  redirect("/admin/disponibilidade");
}
