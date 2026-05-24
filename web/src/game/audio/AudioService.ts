/**
 * AudioService — Web Audio API-based synthesized SFX.
 *
 * Design principles:
 *  - Pure TypeScript: no React, no Three.js, no DOM framework imports.
 *  - AudioContext is created lazily on the first user gesture (unlock()).
 *  - On context-construction failure (older browsers / denied), available=false
 *    and play() becomes a no-op — the game continues without errors.
 *  - Volume and muted state persist via localStorage['bastion.audio'].
 *  - Accepts opts.contextFactory and opts.storageKey for unit-test injection.
 */

export type SfxId =
  | 'tower_fire_archer'
  | 'tower_fire_cannon'
  | 'enemy_hit'
  | 'enemy_die'
  | 'tower_place'
  | 'wave_start'
  | 'victory'
  | 'defeat';

export interface AudioService {
  play(id: SfxId): void;
  unlock(): void;
  setMasterVolume(v: number): void;
  setMuted(m: boolean): void;
  getMasterVolume(): number;
  getMuted(): boolean;
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

interface AudioPrefs {
  volume: number;
  muted: boolean;
}

function loadPrefs(storageKey: string): AudioPrefs {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AudioPrefs>;
      return {
        volume: typeof parsed.volume === 'number' ? Math.min(1, Math.max(0, parsed.volume)) : 1,
        muted: typeof parsed.muted === 'boolean' ? parsed.muted : false,
      };
    }
  } catch {
    // ignore localStorage errors (private browsing, quota, etc.)
  }
  return { volume: 1, muted: false };
}

function savePrefs(storageKey: string, prefs: AudioPrefs): void {
  try {
    globalThis.localStorage?.setItem(storageKey, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// SFX envelope definitions
// Each entry describes a short synthesized sound.
// ---------------------------------------------------------------------------

interface SfxDef {
  type: OscillatorType;
  freqStart: number;
  freqEnd: number;
  /** seconds */
  duration: number;
  gainPeak: number;
}

const SFX_DEFS: Record<SfxId, SfxDef> = {
  tower_fire_archer: {
    type: 'sawtooth',
    freqStart: 600,
    freqEnd: 300,
    duration: 0.12,
    gainPeak: 0.25,
  },
  tower_fire_cannon: {
    type: 'square',
    freqStart: 120,
    freqEnd: 40,
    duration: 0.22,
    gainPeak: 0.4,
  },
  enemy_hit: {
    type: 'sine',
    freqStart: 440,
    freqEnd: 220,
    duration: 0.08,
    gainPeak: 0.2,
  },
  enemy_die: {
    type: 'sawtooth',
    freqStart: 350,
    freqEnd: 80,
    duration: 0.25,
    gainPeak: 0.35,
  },
  tower_place: {
    type: 'sine',
    freqStart: 520,
    freqEnd: 780,
    duration: 0.18,
    gainPeak: 0.3,
  },
  wave_start: {
    type: 'square',
    freqStart: 200,
    freqEnd: 400,
    duration: 0.3,
    gainPeak: 0.35,
  },
  victory: {
    type: 'sine',
    freqStart: 440,
    freqEnd: 880,
    duration: 0.6,
    gainPeak: 0.5,
  },
  defeat: {
    type: 'sawtooth',
    freqStart: 300,
    freqEnd: 60,
    duration: 0.7,
    gainPeak: 0.45,
  },
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface AudioServiceOptions {
  storageKey?: string;
  contextFactory?: () => AudioContext;
}

export function createAudioService(opts?: AudioServiceOptions): AudioService {
  const storageKey = opts?.storageKey ?? 'bastion.audio';
  const prefs = loadPrefs(storageKey);

  let volume = prefs.volume;
  let muted = prefs.muted;

  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let available = false;
  let unlocked = false;

  function tryCreateContext(): boolean {
    try {
      const factory = opts?.contextFactory ?? (() => new (globalThis.AudioContext as typeof AudioContext)());
      ctx = factory();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : volume;
      masterGain.connect(ctx.destination);
      available = true;
      return true;
    } catch {
      available = false;
      ctx = null;
      masterGain = null;
      return false;
    }
  }

  function applyGain(): void {
    if (masterGain) {
      masterGain.gain.value = muted ? 0 : volume;
    }
  }

  function persistPrefs(): void {
    savePrefs(storageKey, { volume, muted });
  }

  return {
    unlock(): void {
      if (unlocked) return;
      unlocked = true;
      tryCreateContext();
    },

    play(id: SfxId): void {
      if (!available || !ctx || !masterGain) return;

      const def = SFX_DEFS[id];
      if (!def) return;

      // Resume suspended context (e.g. after page was backgrounded)
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = def.type;
      osc.frequency.setValueAtTime(def.freqStart, now);
      osc.frequency.linearRampToValueAtTime(def.freqEnd, now + def.duration);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(def.gainPeak, now + 0.01);
      gain.gain.linearRampToValueAtTime(0, now + def.duration);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + def.duration);

      // Clean up nodes after sound finishes
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    },

    setMasterVolume(v: number): void {
      volume = Math.min(1, Math.max(0, v));
      applyGain();
      persistPrefs();
    },

    setMuted(m: boolean): void {
      muted = m;
      applyGain();
      persistPrefs();
    },

    getMasterVolume(): number {
      return volume;
    },

    getMuted(): boolean {
      return muted;
    },
  };
}
