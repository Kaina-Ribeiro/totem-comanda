"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  DEFAULT_SETTINGS,
  listNumbers,
  playSound,
  readSettings,
  REPEAT_MS,
  type SoundId,
  type SoundSettings,
  SOUNDS,
  writeSettings,
} from "@/lib/kitchen/sound";

// ---------------------------------------------------------------- settings

const listeners = new Set<() => void>();
let cached: SoundSettings | null = null;

const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * What the server renders: sound off and no prompt, since only the tablet
 * knows its choice. The prompt then appears after hydration, never flashes.
 */
const SERVER_SETTINGS: SoundSettings = { ...DEFAULT_SETTINGS, enabled: false };

/** This tablet's sound settings. */
function useSoundSettings(): [SoundSettings, (next: SoundSettings) => void] {
  const settings = useSyncExternalStore(
    subscribe,
    () => (cached ??= readSettings(storage())),
    () => SERVER_SETTINGS,
  );
  const save = (next: SoundSettings) => {
    cached = next;
    writeSettings(storage(), next);
    for (const listener of listeners) listener();
  };
  return [settings, save];
}

// ---------------------------------------------------------------- hook

/**
 * New-order alert (plan G-K1, prototypes K1 and K5): orders that arrive after
 * the board loaded are "unseen" until someone touches the screen. While any
 * is unseen the bar shows, the cards glow, the tab title flashes and, with
 * sound on, the alert plays (again every 4 s when repeating).
 */
export function useNewOrderAlert() {
  const [settings, saveSettings] = useSoundSettings();
  const [unseen, setUnseen] = useState<string[]>([]);
  const [dialog, setDialog] = useState<"auto" | "open" | "closed">("auto");
  const [running, setRunning] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  // `arrived` is called from the board's stream effect, so it reads settings from a ref.
  const latest = useRef(settings);
  useEffect(() => {
    latest.current = settings;
  }, [settings]);

  // Any touch on the screen means someone saw the new orders (K1).
  useEffect(() => {
    const seen = () => setUnseen((current) => (current.length ? [] : current));
    document.addEventListener("pointerdown", seen);
    return () => document.removeEventListener("pointerdown", seen);
  }, []);

  // On load, a tablet that already said yes may be allowed to play without a
  // touch (Chromium with an autoplay policy); otherwise the prompt asks for one.
  useEffect(() => {
    if (readSettings(storage()).enabled !== true) return;
    const context = new AudioContext();
    audio.current = context;
    const sync = () => setRunning(context.state === "running");
    context.addEventListener("statechange", sync);
    void Promise.resolve().then(sync);
    return () => {
      context.removeEventListener("statechange", sync);
      void context.close();
    };
  }, []);

  const dialogOpen =
    dialog === "open" || (dialog === "auto" && settings.enabled !== false && !running);

  /** Creates or resumes audio inside a touch, which is what Chromium requires. */
  async function unlock(): Promise<AudioContext | null> {
    try {
      audio.current ??= new AudioContext();
      if (audio.current.state !== "running") await audio.current.resume();
      setRunning(audio.current.state === "running");
      return audio.current;
    } catch {
      return null;
    }
  }

  // Repeat while anything is unseen.
  const repeating = settings.enabled === true && settings.repeat && unseen.length > 0;
  useEffect(() => {
    if (!repeating) return;
    const timer = setInterval(() => {
      if (audio.current?.state === "running") playSound(audio.current, settings.sound);
    }, REPEAT_MS);
    return () => clearInterval(timer);
  }, [repeating, settings.sound]);

  // Flash the tab title while anything is unseen.
  useEffect(() => {
    if (unseen.length === 0) return;
    const original = document.title;
    const alert = `(${unseen.length}) ${unseen.length === 1 ? "Pedido novo" : "Pedidos novos"}`;
    let on = true;
    document.title = alert;
    const timer = setInterval(() => {
      on = !on;
      document.title = on ? alert : original;
    }, 1_000);
    return () => {
      clearInterval(timer);
      document.title = original;
    };
  }, [unseen.length]);

  return {
    settings,
    unseen,
    dialogOpen,
    soundOn: settings.enabled === true && running,
    /** New paid orders arrived: mark them unseen and play once. */
    arrived(ids: string[]) {
      if (ids.length === 0) return;
      setUnseen((current) => [...current, ...ids.filter((id) => !current.includes(id))]);
      const { enabled, sound } = latest.current;
      if (enabled && audio.current?.state === "running") playSound(audio.current, sound);
    },
    /** Someone touched the screen: everything is seen, the sound stops. */
    acknowledge() {
      setUnseen((current) => (current.length ? [] : current));
    },
    openDialog: () => setDialog("open"),
    dialogProps: {
      settings,
      onPreview: async (id: SoundId) => {
        const context = await unlock();
        if (context) playSound(context, id);
      },
      onChange: (next: SoundSettings) => saveSettings(next),
      onDismiss: () => {
        saveSettings({ ...settings, enabled: false });
        setDialog("closed");
      },
      onConfirm: async () => {
        const context = await unlock();
        saveSettings({ ...settings, enabled: true });
        setDialog("closed");
        if (context) playSound(context, settings.sound);
      },
    },
  };
}

// ---------------------------------------------------------------- pieces

/** The header's sound button: shows on or off, opens the settings. */
export function SoundButton({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <button
      onClick={onPress}
      aria-label={`Som dos pedidos novos: ${on ? "ligado" : "desligado"}`}
      title={`Som dos pedidos novos: ${on ? "ligado" : "desligado"}`}
      className="flex size-11 items-center justify-center rounded-[14px] bg-surface transition-transform active:scale-[.97]"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={on ? undefined : "text-muted"}
      >
        <path d="M11 5L6 9H3v6h3l5 4V5z" />
        {on ? (
          <>
            <path d="M15.5 8.5a5 5 0 010 7" />
            <path d="M18.5 5.5a9 9 0 010 13" />
          </>
        ) : (
          <path d="M16 9l5 6M21 9l-5 6" />
        )}
      </svg>
    </button>
  );
}

/** "2 pedidos novos" bar under the header (K1). */
export function NewOrdersBar({
  numbers,
  repeating,
  onSeen,
}: {
  numbers: string[];
  repeating: boolean;
  onSeen: () => void;
}) {
  const count = numbers.length;
  return (
    <div
      role="alert"
      className="mx-6 flex h-14 shrink-0 items-center justify-between gap-4 rounded-xl bg-accent pr-2 pl-5 text-on-accent"
    >
      <div className="flex min-w-0 items-center gap-3">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-detail-light)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0"
        >
          <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        <span className="shrink-0 text-[17px] font-extrabold">
          {count === 1 ? "1 pedido novo" : `${count} pedidos novos`}
        </span>
        <span className="truncate text-[15px] font-semibold text-on-accent-muted">
          {listNumbers(numbers)}
          {repeating && " · o som para quando alguém tocar na tela"}
        </span>
      </div>
      <button
        onClick={onSeen}
        className="h-10 shrink-0 rounded-xl bg-on-accent px-5 text-[15px] font-extrabold text-accent transition-transform active:scale-[.97]"
      >
        Ok, vi
      </button>
    </div>
  );
}

/** K5: the first-touch prompt and the sound settings. */
export function SoundDialog({
  settings,
  onPreview,
  onChange,
  onDismiss,
  onConfirm,
}: {
  settings: SoundSettings;
  onPreview: (id: SoundId) => void;
  onChange: (next: SoundSettings) => void;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-20 bg-[rgba(28,28,26,.55)]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sound-title"
        className="absolute top-[92px] left-1/2 flex w-[640px] max-w-[calc(100%-32px)] -translate-x-1/2 flex-col items-center gap-[22px] rounded-2xl bg-surface px-10 pt-9 pb-8 text-center shadow-[0_24px_60px_rgba(28,28,26,.25)]"
      >
        <span className="flex size-[88px] items-center justify-center rounded-full bg-wheat text-detail-text">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 01-3.4 0" />
          </svg>
        </span>
        <div className="flex flex-col gap-2">
          <h2 id="sound-title" className="text-[28px] font-bold tracking-[-0.02em]">
            Ligar o som de pedido novo?
          </h2>
          <p className="text-base leading-normal font-semibold text-muted">
            O navegador só toca som depois de um toque na tela. Ligue agora para ouvir quando
            chegar pedido, mesmo de costas para o tablet.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2.5 text-left">
          <span className="text-[15px] font-extrabold">Qual som?</span>
          <div role="radiogroup" aria-label="Som" className="grid grid-cols-3 gap-2.5">
            {SOUNDS.map((sound) => {
              const on = sound.id === settings.sound;
              return (
                <button
                  key={sound.id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    onChange({ ...settings, sound: sound.id });
                    onPreview(sound.id);
                  }}
                  className={`flex h-14 items-center justify-center gap-2 rounded-xl text-base font-extrabold transition-transform active:scale-[.97] ${
                    on
                      ? "border-2 border-accent bg-[#fbf8f3] text-ink"
                      : "border-[1.5px] border-line bg-surface text-muted"
                  }`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {sound.label}
                </button>
              );
            })}
          </div>
          <button
            role="switch"
            aria-checked={settings.repeat}
            onClick={() => onChange({ ...settings, repeat: !settings.repeat })}
            className="mt-1.5 flex min-h-16 items-center justify-between gap-4 rounded-xl bg-ground px-[18px] text-left transition-transform active:scale-[.99]"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-base font-extrabold">Repetir até alguém tocar na tela</span>
              <span className="text-sm font-semibold text-muted">
                Desligado, toca uma vez por pedido.
              </span>
            </span>
            <span
              className={`flex h-[30px] w-[52px] shrink-0 rounded-[15px] p-[3px] transition-colors ${
                settings.repeat ? "justify-end bg-accent" : "justify-start bg-[#c9c1b6]"
              }`}
            >
              <span className="size-6 rounded-full bg-surface" />
            </span>
          </button>
        </div>

        <div className="flex w-full gap-3">
          <button
            onClick={onDismiss}
            className="h-[60px] flex-1 rounded-[30px] bg-ground text-[17px] font-extrabold transition-transform active:scale-[.97]"
          >
            Agora não
          </button>
          <button
            onClick={onConfirm}
            className="h-[60px] flex-[1.4] rounded-[30px] bg-accent text-[17px] font-extrabold text-on-accent transition-transform active:scale-[.97]"
          >
            Ligar som
          </button>
        </div>
        <span className="text-[13px] font-semibold text-muted">
          Dá para mudar depois no ícone de som, no topo. A escolha fica salva neste tablet.
        </span>
      </div>
    </div>
  );
}
