import { SetupForm } from "./setup-form";

// Provisioning: typed once on each kiosk or kitchen screen (with a USB
// keyboard at install time), using the id and secret from the back office.
export default function SetupPage() {
  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-1 flex-col justify-center gap-12 px-[84px] py-24">
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-[84px] font-semibold leading-none tracking-[-0.02em]">
          Conectar aparelho
        </h1>
        <p className="text-[30px] leading-[1.4] text-muted">
          Use o ID e o código secreto que o back office mostrou ao cadastrar este totem ou
          tela da cozinha. Isso só é feito uma vez.
        </p>
      </div>
      <SetupForm />
    </main>
  );
}
