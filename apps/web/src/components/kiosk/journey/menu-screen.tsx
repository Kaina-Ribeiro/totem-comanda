import Image from "next/image";

import { formatMoney } from "@/lib/format/money";
import { basketUnits } from "@/lib/kiosk/basket";
import type { Badge, Product, Section } from "@/lib/kiosk/menu-graph";
import { format, type Strings } from "@/lib/kiosk/strings";

import { Close, Plus } from "../icons";
import { currentTotals, type Journey, lastTotal } from "./journey-state";

/** Pastel tints the prototype rotates through the categories (03-Menu). */
const TINTS = ["bg-butter", "bg-wheat", "bg-sage", "bg-oat"];

/** "A partir de R$ X" when Go sent a display price, else the product's own price. */
export function productPrice(product: Product, strings: Strings): string {
  return product.displayPrice !== null
    ? format(strings["menu.from"], { price: formatMoney(product.displayPrice) })
    : formatMoney(product.price);
}

/**
 * Prototype 03-Menu at 1080x1920 on the v2 menu: top sections on the rail,
 * products and sub-sections in the grid, all from the menu loaded at journey
 * start (changing section never calls the server). The bar's total is Go's,
 * from the last `POST /v2/totals`; it greys out while the basket is re-priced.
 */
export function MenuScreen({
  brand,
  journey,
  strings,
  onPickSection,
  onPickProduct,
  onOpenBasket,
  onCancel,
}: {
  brand: string;
  journey: Journey;
  strings: Strings;
  onPickSection: (sectionId: string) => void;
  onPickProduct: (product: Product) => void;
  onOpenBasket: () => void;
  onCancel: () => void;
}) {
  const sections = journey.menu!.sections;
  const sectionIndex = Math.max(
    0,
    sections.findIndex((s) => s.id === journey.sectionId),
  );
  const section = sections[sectionIndex];
  const tint = TINTS[sectionIndex % TINTS.length];
  const count = section ? countProducts(section) : 0;
  const units = basketUnits(journey.basket);
  const totals = currentTotals(journey);
  const shown = totals?.total ?? lastTotal(journey);

  return (
    <div className="flex h-full flex-col bg-ground text-ink">
      <header className="flex shrink-0 items-center justify-between px-12 pt-[42px] pb-[30px]">
        <div className="flex items-center gap-[30px]">
          <div className="font-display text-[39px] font-medium italic">{brand}</div>
          <span className="flex h-[72px] items-center rounded-full bg-surface px-[27px] text-[25.5px] font-bold">
            {strings["menu.dineIn"]}
          </span>
        </div>
        <button
          onClick={onCancel}
          aria-label={strings["menu.cancel"]}
          className="flex size-[84px] items-center justify-center rounded-full bg-surface"
        >
          <Close size={36} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav aria-label="Categorias" className="flex w-[312px] shrink-0 flex-col gap-[9px] pt-3 pr-[18px] pl-[30px]">
          {sections.map((s, index) => {
            const on = index === sectionIndex;
            const sTint = TINTS[index % TINTS.length];
            return (
              <button
                key={s.id}
                onClick={() => onPickSection(s.id)}
                aria-pressed={on}
                className={`flex min-h-[108px] w-full items-center gap-[18px] rounded-[27px] px-[21px] text-left text-[27px] ${
                  on ? `${sTint} font-extrabold text-ink` : "font-semibold text-muted"
                }`}
              >
                <span className={`size-[15px] shrink-0 rounded-full ${sTint} shadow-[inset_0_0_0_1.5px_rgba(43,33,28,0.15)]`} />
                <span>{s.name}</span>
              </button>
            );
          })}
        </nav>

        <main className="flex min-w-0 flex-1 flex-col gap-9 overflow-y-auto rounded-tl-[48px] bg-surface pt-12 pr-[42px] pb-12 pl-12">
          <div className="flex items-baseline justify-between gap-6">
            <h1 className="font-display text-[72px] font-semibold tracking-[-0.02em]">{section?.name}</h1>
            <div className="shrink-0 text-[25.5px] font-semibold text-muted">
              {count === 1 ? strings["menu.option"] : format(strings["menu.options"], { n: count })}
            </div>
          </div>
          {section?.description && <p className="-mt-6 text-[28.5px] text-muted">{section.description}</p>}
          {!section && <p className="text-[30px] text-muted">{strings["menu.empty"]}</p>}
          {section && (
            <SectionGrid
              section={section}
              tint={tint}
              strings={strings}
              onPickProduct={onPickProduct}
              first
            />
          )}
        </main>
      </div>

      <div className="shrink-0 bg-surface px-12 pt-[30px] pb-12">
        <button
          onClick={onOpenBasket}
          disabled={units === 0}
          className="flex h-button w-full items-center justify-between rounded-full bg-accent px-[66px] text-on-accent transition-opacity disabled:opacity-60"
        >
          <span className="flex flex-col items-start gap-[3px]">
            <span className="text-[24px] font-semibold text-on-accent-muted">
              {units === 0
                ? strings["basketBar.empty"]
                : units === 1
                  ? strings["basketBar.item"]
                  : format(strings["basketBar.items"], { n: units })}
            </span>
            <span className="text-[39px] font-bold">{strings["basketBar.cta"]}</span>
          </span>
          {units > 0 && shown !== null && (
            <span
              className={`font-display text-[54px] font-semibold tracking-[-0.02em] transition-opacity ${
                totals ? "" : "opacity-50"
              }`}
            >
              {formatMoney(shown)}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

const countProducts = (section: Section): number =>
  section.products.length + section.sections.reduce((n, s) => n + countProducts(s), 0);

/** A section's own products, then each sub-section under its heading. */
function SectionGrid({
  section,
  tint,
  strings,
  onPickProduct,
  first,
}: {
  section: Section;
  tint: string;
  strings: Strings;
  onPickProduct: (product: Product) => void;
  first?: boolean;
}) {
  return (
    <>
      {!first && (
        <h2 className="mt-3 font-display text-[48px] font-semibold tracking-[-0.02em]">{section.name}</h2>
      )}
      {section.products.length > 0 && (
        <div className="grid grid-cols-2 gap-x-[30px] gap-y-[42px]">
          {section.products.map((product, index) => (
            <ProductCell
              key={product.id}
              product={product}
              tint={tint}
              priority={first && index < 4}
              strings={strings}
              onPress={() => onPickProduct(product)}
            />
          ))}
        </div>
      )}
      {section.sections.map((sub) => (
        <SectionGrid key={sub.id} section={sub} tint={tint} strings={strings} onPickProduct={onPickProduct} />
      ))}
    </>
  );
}

function ProductCell({
  product,
  tint,
  priority,
  strings,
  onPress,
}: {
  product: Product;
  tint: string;
  priority?: boolean;
  strings: Strings;
  onPress: () => void;
}) {
  const off = !product.available;
  return (
    <button
      onClick={onPress}
      disabled={off}
      aria-label={off ? `${product.name}, ${strings["menu.unavailable"]}` : format(strings["menu.add"], { name: product.name })}
      className="flex flex-col gap-[18px] text-left"
    >
      <div className={`relative flex h-[240px] items-center justify-center overflow-hidden rounded-[30px] ${off ? "bg-ground" : tint}`}>
        {product.picture ? (
          <Image
            src={product.picture.url}
            alt={product.picture.alt ?? ""}
            fill
            sizes="324px"
            priority={priority}
            className={`object-cover ${off ? "opacity-45 grayscale" : ""}`}
          />
        ) : (
          <span className="font-display text-[96px] font-semibold text-ink/25">{product.name.charAt(0)}</span>
        )}
        {off ? (
          <span className="absolute top-[18px] left-[18px] rounded-[18px] bg-surface px-[18px] py-[9px] text-[21px] font-bold text-muted">
            {strings["menu.unavailable"]}
          </span>
        ) : (
          product.badges.length > 0 && <Badges badges={product.badges} />
        )}
      </div>
      <div className="flex items-start justify-between gap-[15px]">
        <div className="flex flex-col gap-[6px]">
          <div className={`text-[30px] leading-[1.2] font-bold ${off ? "text-muted" : ""}`}>{product.name}</div>
          <div className={`text-[28.5px] font-semibold ${off ? "text-muted" : "text-price"}`}>
            {off ? strings["menu.unavailable"] : productPrice(product, strings)}
          </div>
        </div>
        {!off && (
          <span className="flex size-[66px] shrink-0 items-center justify-center rounded-full border-[3px] border-ink">
            <Plus size={30} strokeWidth={2.6} />
          </span>
        )}
      </div>
    </button>
  );
}

export function Badges({ badges, large }: { badges: Badge[]; large?: boolean }) {
  return (
    <div className={`absolute flex flex-wrap gap-2 ${large ? "bottom-9 left-[66px]" : "top-[18px] left-[18px]"}`}>
      {badges.map((badge) => (
        <span
          key={badge.id}
          className={`font-bold ${large ? "rounded-[18px] px-[21px] py-[10px] text-[24px]" : "rounded-[18px] px-[18px] py-[9px] text-[21px]"}`}
          style={{ color: badge.textColour, backgroundColor: badge.backgroundColour }}
        >
          {badge.name}
        </span>
      ))}
    </div>
  );
}
