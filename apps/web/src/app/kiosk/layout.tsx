/**
 * The kiosk is drawn for a 1080x1920 portrait screen. It renders on a stage of
 * exactly that size, scaled down to fit any other window (a landscape monitor,
 * the browser pane) with the rest of the window as backdrop. On the real
 * screen the scale is 1 and the stage is the whole viewport. Fixed overlays
 * (dialogs, sheets) stay inside the stage, since `scale` makes it their
 * containing block.
 */
export default function KioskLayout({ children }: LayoutProps<"/kiosk">) {
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#1a120e]">
      <div className="kiosk-stage flex h-[1920px] w-[1080px] shrink-0 flex-col">{children}</div>
    </div>
  );
}
