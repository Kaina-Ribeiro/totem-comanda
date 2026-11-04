/**
 * New-order sound on the kitchen screen (plan G-K1, KDS FEAT-016/017/018).
 * The sounds are synthesised with Web Audio, so there is no audio file to
 * cache and no dependency. The choice is per device, kept in localStorage.
 */

export type SoundId = "sino" | "campainha" | "apito";

export const SOUNDS: { id: SoundId; label: string }[] = [
  { id: "sino", label: "Sino" },
  { id: "campainha", label: "Campainha" },
  { id: "apito", label: "Apito" },
];

export type SoundSettings = {
  /** null until the kitchen answered the first "Ligar o som?" prompt. */
  enabled: boolean | null;
  sound: SoundId;
  /** Repeat until someone touches the screen (our default); off plays once per order. */
  repeat: boolean;
};

export const DEFAULT_SETTINGS: SoundSettings = { enabled: null, sound: "sino", repeat: true };

/** How often a repeating alert plays again while orders are unseen. */
export const REPEAT_MS = 4_000;

const KEY = "comanda.kitchen.sound";

/** Reads the device's settings; defaults when storage is missing, blocked or corrupt. */
export function readSettings(storage: Pick<Storage, "getItem"> | undefined): SoundSettings {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const value = JSON.parse(raw) as Partial<SoundSettings>;
    return {
      enabled: typeof value.enabled === "boolean" ? value.enabled : null,
      sound: SOUNDS.some((s) => s.id === value.sound) ? (value.sound as SoundId) : "sino",
      repeat: typeof value.repeat === "boolean" ? value.repeat : true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(storage: Pick<Storage, "setItem"> | undefined, value: SoundSettings) {
  try {
    storage?.setItem(KEY, JSON.stringify(value));
  } catch {
    // Private mode or blocked storage: the choice lasts until the page reloads.
  }
}

type Note = { at: number; freq: number; length: number; type: OscillatorType; gain: number };

const NOTES: Record<SoundId, Note[]> = {
  // A bright bell with an overtone.
  sino: [
    { at: 0, freq: 1046.5, length: 1.2, type: "sine", gain: 0.5 },
    { at: 0, freq: 2093, length: 0.6, type: "sine", gain: 0.15 },
  ],
  // Ding-dong.
  campainha: [
    { at: 0, freq: 784, length: 0.55, type: "triangle", gain: 0.5 },
    { at: 0.45, freq: 659.3, length: 0.8, type: "triangle", gain: 0.5 },
  ],
  // Three short whistles, cuts through kitchen noise.
  apito: [0, 0.2, 0.4].map((at) => ({ at, freq: 1400, length: 0.12, type: "square", gain: 0.12 })),
};

/** Plays one alert. Needs a running AudioContext (created on a touch). */
export function playSound(context: AudioContext, id: SoundId) {
  const start = context.currentTime + 0.02;
  for (const note of NOTES[id]) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = note.type;
    osc.frequency.value = note.freq;
    const t = start + note.at;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(note.gain, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + note.length);
    osc.connect(gain).connect(context.destination);
    osc.start(t);
    osc.stop(t + note.length + 0.05);
  }
}

/** "44 e 45", "43, 44 e 45": the numbers in the new-orders bar. */
export function listNumbers(numbers: string[]): string {
  if (numbers.length <= 1) return numbers.join("");
  return `${numbers.slice(0, -1).join(", ")} e ${numbers[numbers.length - 1]}`;
}
