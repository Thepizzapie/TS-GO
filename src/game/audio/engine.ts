/**
 * TOMATO STRIKE — audio engine (procedural Web Audio implementation).
 *
 * Every sound is synthesized at runtime with the Web Audio API — no asset
 * files, no network, no extra dependencies — so the game ships in a static
 * export and works offline. The module is SSR-safe: nothing touches `window`
 * or `AudioContext` until `init()`/`resume()`/`play()` runs in the browser.
 *
 * Architecture:
 *   master gain ──► destination
 *     ├─ sfx bus    (all one-shot effects, optionally spatialized)
 *     └─ music bus  (the generative menu/battle loop)
 *
 * Public surface is exactly the `AudioEngine` interface from ./types.
 */
import type { AudioEngine, PlayOpts, SoundId } from "./types";
import type { Vec3 } from "../core/types";

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------
const DEFAULT_MASTER = 0.8;
const DEFAULT_SFX = 1;
const DEFAULT_MUSIC = 0.5;

/** Hard cap on simultaneously decaying SFX voices; oldest is stolen past this. */
const MAX_VOICES = 24;
/** Beyond this distance (m) a positional sound is effectively silent. */
const MAX_AUDIBLE_DIST = 60;
/** Reference distance for the inverse falloff (full level within this radius). */
const REF_DIST = 4;

// ---------------------------------------------------------------------------
// Small math helpers (kept local so the module stays framework-free)
// ---------------------------------------------------------------------------
function clamp(v: number, lo: number, hi: number): number {
  // NaN/Infinity must never reach an AudioParam (values can arrive off the wire)
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

/** A safe minimum for exponential ramps (they cannot target exactly 0). */
const EPS = 0.0001;

// ===========================================================================
// Engine
// ===========================================================================
class TomatoAudio implements AudioEngine {
  private ctx: AudioContext | null = null;

  // Bus graph
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;

  // Mix levels (retained so we can rebuild the graph or apply before init).
  private volMaster = DEFAULT_MASTER;
  private volSfx = DEFAULT_SFX;
  private volMusic = DEFAULT_MUSIC;

  // Shared white-noise buffer (one allocation, reused by every noisy voice).
  private noiseBuffer: AudioBuffer | null = null;

  // Active SFX voices, for the voice cap. Each entry is the per-voice output
  // gain; we track them so we can steal the oldest when over budget.
  private voices: { node: GainNode; endsAt: number }[] = [];

  // Music state
  private music: MusicEngine | null = null;
  private currentTrack: "menu" | "battle" | null = null;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------
  init(): void {
    this.ensureContext();
  }

  resume(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
  }

  setVolumes(master: number, sfx: number, music: number): void {
    this.volMaster = clamp(master, 0, 1);
    this.volSfx = clamp(sfx, 0, 1);
    this.volMusic = clamp(music, 0, 1);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Short ramps avoid zipper noise when the user drags a slider.
    this.master?.gain.setTargetAtTime(this.volMaster, t, 0.02);
    this.sfxBus?.gain.setTargetAtTime(this.volSfx, t, 0.02);
    this.musicBus?.gain.setTargetAtTime(this.volMusic, t, 0.02);
  }

  // -------------------------------------------------------------------------
  // Context / graph bootstrap (lazy + SSR-safe)
  // -------------------------------------------------------------------------
  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined") return null;

    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    let ctx: AudioContext;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
    this.ctx = ctx;

    // Build the bus graph: master -> destination, sfx/music -> master.
    const master = ctx.createGain();
    master.gain.value = this.volMaster;
    master.connect(ctx.destination);

    const sfxBus = ctx.createGain();
    sfxBus.gain.value = this.volSfx;
    sfxBus.connect(master);

    const musicBus = ctx.createGain();
    musicBus.gain.value = this.volMusic;
    musicBus.connect(master);

    this.master = master;
    this.sfxBus = sfxBus;
    this.musicBus = musicBus;

    // Pre-bake the shared noise buffer (1s of white noise, looped as needed).
    this.noiseBuffer = this.makeNoiseBuffer(ctx, 1);

    return ctx;
  }

  private makeNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // -------------------------------------------------------------------------
  // Voice management
  // -------------------------------------------------------------------------
  /**
   * Create the per-voice output gain that every synth routes through. Applies
   * spatialization (pan + distance attenuation) and the caller's volume, then
   * connects into the sfx bus. Returns the node the synth should feed, plus the
   * AudioContext. Returns null when audio is unavailable or the voice is too
   * far away to be worth synthesizing.
   */
  private beginVoice(opts: PlayOpts | undefined): {
    ctx: AudioContext;
    dest: AudioNode;
    out: GainNode;
    spatialGain: number;
  } | null {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return null;

    // Resume opportunistically; some browsers start suspended until a gesture.
    if (ctx.state === "suspended") void ctx.resume();

    const userVol = clamp(opts?.volume ?? 1, 0, 4);

    // Spatialization -------------------------------------------------------
    let pan = 0;
    let spatialGain = 1;
    if (opts?.pos && opts.listener) {
      const s = spatialize(opts.pos, opts.listener);
      if (s.gain <= EPS) return null; // inaudible — skip entirely
      pan = s.pan;
      spatialGain = s.gain;
    }

    const totalGain = userVol * spatialGain;
    if (totalGain <= EPS) return null;

    // Per-voice output node (synth envelopes scale relative to this).
    const out = ctx.createGain();
    out.gain.value = 1;

    let tail: AudioNode = out;
    if (pan !== 0 && typeof ctx.createStereoPanner === "function") {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(pan, -1, 1);
      out.connect(panner);
      tail = panner;
    }

    // A voice-level gain carries the combined volume so individual synth
    // envelopes can stay normalized to ~1.0.
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = totalGain;
    tail.connect(voiceGain);
    voiceGain.connect(this.sfxBus);

    return { ctx, dest: out, out: voiceGain, spatialGain };
  }

  /** Register a voice for the cap and schedule its teardown. */
  private trackVoice(voiceGain: GainNode, durationSec: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const endsAt = ctx.currentTime + durationSec;
    this.voices.push({ node: voiceGain, endsAt });

    // Steal oldest voices if we blew the budget.
    if (this.voices.length > MAX_VOICES) {
      this.voices.sort((a, b) => a.endsAt - b.endsAt);
      while (this.voices.length > MAX_VOICES) {
        const victim = this.voices.shift();
        if (victim) this.killVoice(victim.node);
      }
    }

    // Disconnect when the envelope is done, plus a small safety margin.
    const ms = Math.max(0, durationSec * 1000) + 60;
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        try {
          voiceGain.disconnect();
        } catch {
          /* already gone */
        }
        const i = this.voices.findIndex((v) => v.node === voiceGain);
        if (i >= 0) this.voices.splice(i, 1);
      }, ms);
    }
  }

  private killVoice(voiceGain: GainNode): void {
    const ctx = this.ctx;
    if (ctx) {
      const t = ctx.currentTime;
      try {
        voiceGain.gain.cancelScheduledValues(t);
        voiceGain.gain.setTargetAtTime(0, t, 0.01);
      } catch {
        /* node may be in a bad state */
      }
    }
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        try {
          voiceGain.disconnect();
        } catch {
          /* ignore */
        }
      }, 40);
    }
  }

  // -------------------------------------------------------------------------
  // Low-level synth primitives
  // -------------------------------------------------------------------------
  /** A short noise burst through a filter, with an exponential decay envelope. */
  private noise(
    ctx: AudioContext,
    dest: AudioNode,
    opts: {
      t0: number;
      dur: number;
      type: BiquadFilterType;
      freq: number;
      q?: number;
      gain?: number;
      /** Sweep the filter to this frequency over the duration. */
      freqEnd?: number;
      /** Linear attack time before the decay. */
      attack?: number;
      rate?: number;
    },
  ): void {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.playbackRate.value = opts.rate ?? 1;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.type;
    filter.frequency.setValueAtTime(Math.max(20, opts.freq), opts.t0);
    if (opts.freqEnd != null) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(20, opts.freqEnd),
        opts.t0 + opts.dur,
      );
    }
    filter.Q.value = opts.q ?? 1;

    const g = ctx.createGain();
    const peak = opts.gain ?? 1;
    const atk = opts.attack ?? 0.001;
    g.gain.setValueAtTime(EPS, opts.t0);
    g.gain.exponentialRampToValueAtTime(peak, opts.t0 + atk);
    g.gain.exponentialRampToValueAtTime(EPS, opts.t0 + opts.dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(dest);

    src.start(opts.t0);
    src.stop(opts.t0 + opts.dur + 0.02);
  }

  /** A single oscillator tone with an AD envelope and optional pitch glide. */
  private tone(
    ctx: AudioContext,
    dest: AudioNode,
    opts: {
      t0: number;
      dur: number;
      type: OscillatorType;
      freq: number;
      freqEnd?: number;
      gain?: number;
      attack?: number;
      /** When true use a linear (vs exponential) amplitude decay. */
      linearDecay?: boolean;
    },
  ): void {
    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(Math.max(20, opts.freq), opts.t0);
    if (opts.freqEnd != null) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, opts.freqEnd),
        opts.t0 + opts.dur,
      );
    }

    const g = ctx.createGain();
    const peak = opts.gain ?? 1;
    const atk = opts.attack ?? 0.002;
    g.gain.setValueAtTime(EPS, opts.t0);
    g.gain.exponentialRampToValueAtTime(peak, opts.t0 + atk);
    if (opts.linearDecay) {
      g.gain.linearRampToValueAtTime(0, opts.t0 + opts.dur);
    } else {
      g.gain.exponentialRampToValueAtTime(EPS, opts.t0 + opts.dur);
    }

    osc.connect(g);
    g.connect(dest);
    osc.start(opts.t0);
    osc.stop(opts.t0 + opts.dur + 0.02);
  }

  /** A very short transient "click" (the snap of a trigger / mechanical part). */
  private click(
    ctx: AudioContext,
    dest: AudioNode,
    t0: number,
    freq: number,
    gain = 0.6,
    dur = 0.012,
  ): void {
    this.noise(ctx, dest, {
      t0,
      dur,
      type: "bandpass",
      freq,
      q: 1.2,
      gain,
    });
  }

  // -------------------------------------------------------------------------
  // play()
  // -------------------------------------------------------------------------
  play(id: SoundId, opts?: PlayOpts): void {
    const voice = this.beginVoice(opts);
    if (!voice) return;
    const { ctx, dest, out } = voice;
    const t = ctx.currentTime;
    const rate = clamp(opts?.rate ?? 1, 0.25, 4);

    // Each synth returns the total duration it occupies so we can schedule the
    // voice teardown / voice-cap bookkeeping accurately.
    const dur = this.render(id, ctx, dest, t, rate);
    this.trackVoice(out, dur);
  }

  /**
   * Dispatch table: synthesize `id` into `dest` starting at `t`. Returns the
   * approximate duration (s) of the sound for voice bookkeeping.
   */
  private render(
    id: SoundId,
    ctx: AudioContext,
    dest: AudioNode,
    t: number,
    rate: number,
  ): number {
    switch (id) {
      // ----- gunfire -----------------------------------------------------
      case "shoot_pistol":
        return this.gun(ctx, dest, t, rate, {
          bodyFreq: 1700,
          bodyQ: 0.9,
          dur: 0.13,
          thumpFreq: 150,
          thumpGain: 0.5,
          crackGain: 0.9,
          subBass: true,
        });
      case "shoot_magnum":
        return this.gun(ctx, dest, t, rate, {
          bodyFreq: 1100,
          bodyQ: 0.8,
          dur: 0.2,
          thumpFreq: 95,
          thumpGain: 0.95,
          crackGain: 1.0,
          tail: 0.12,
        });
      case "shoot_smg":
        return this.gun(ctx, dest, t, rate, {
          bodyFreq: 2400,
          bodyQ: 1.1,
          dur: 0.085,
          thumpFreq: 200,
          thumpGain: 0.3,
          crackGain: 0.8,
          subBass: true,
        });
      case "shoot_shotgun":
        return this.shotgun(ctx, dest, t, rate);
      case "shoot_rifle":
        return this.gun(ctx, dest, t, rate, {
          bodyFreq: 1950,
          bodyQ: 1.0,
          dur: 0.14,
          thumpFreq: 130,
          thumpGain: 0.6,
          crackGain: 1.0,
          tail: 0.06,
        });
      case "shoot_sniper":
        return this.sniper(ctx, dest, t, rate);
      case "dryfire":
        this.click(ctx, dest, t, 2600, 0.5, 0.01);
        this.click(ctx, dest, t + 0.012, 1400, 0.3, 0.012);
        return 0.05;

      // ----- reload ------------------------------------------------------
      case "reload_start":
        this.click(ctx, dest, t, 900, 0.5, 0.02);
        this.click(ctx, dest, t + 0.07, 1500, 0.45, 0.02);
        return 0.14;
      case "reload_done":
        this.click(ctx, dest, t, 1200, 0.5, 0.02);
        this.click(ctx, dest, t + 0.05, 700, 0.55, 0.03);
        this.tone(ctx, dest, {
          t0: t + 0.05,
          dur: 0.05,
          type: "square",
          freq: 320,
          gain: 0.15,
        });
        return 0.12;

      // ----- melee / impact ---------------------------------------------
      case "knife_swing":
        // Airy whoosh: filtered noise sweeping up then fading.
        this.noise(ctx, dest, {
          t0: t,
          dur: 0.22,
          type: "bandpass",
          freq: 700,
          freqEnd: 2600,
          q: 0.8,
          gain: 0.5,
          attack: 0.06,
          rate: 1.1,
        });
        return 0.24;
      case "knife_hit":
        // Wet slice: short noisy splat + a quick mid tone "chk".
        this.noise(ctx, dest, {
          t0: t,
          dur: 0.1,
          type: "lowpass",
          freq: 1800,
          freqEnd: 500,
          gain: 0.8,
        });
        this.tone(ctx, dest, {
          t0: t,
          dur: 0.08,
          type: "triangle",
          freq: 420,
          freqEnd: 180,
          gain: 0.35,
        });
        return 0.12;
      case "hitmarker":
        // Layered crunch: sharp high click + mid thock + square blip texture.
        // Layer 1 — high bandpass noise click (~4 kHz, <30 ms).
        this.noise(ctx, dest, {
          t0: t,
          dur: 0.028,
          type: "bandpass",
          freq: 4000 * rate,
          q: 2.5,
          gain: 0.55,
          attack: 0.001,
        });
        // Layer 2 — mid "thock": triangle pitch-drop 750→280 Hz, 60 ms.
        this.tone(ctx, dest, {
          t0: t,
          dur: 0.06,
          type: "triangle",
          freq: 750 * rate,
          freqEnd: 280 * rate,
          gain: 0.42,
          attack: 0.002,
        });
        // Layer 3 — square blip detuned slightly for crunch texture, 35 ms.
        this.tone(ctx, dest, {
          t0: t,
          dur: 0.035,
          type: "square",
          freq: 940 * rate,
          gain: 0.18,
          attack: 0.001,
        });
        return 0.08;
      case "headshot":
        // Same crunch family as hitmarker + an unmistakable bright dink layer.
        // Layer 1 — high bandpass click (slightly brighter, ~4.5 kHz).
        this.noise(ctx, dest, {
          t0: t,
          dur: 0.028,
          type: "bandpass",
          freq: 4500 * rate,
          q: 2.8,
          gain: 0.65,
          attack: 0.001,
        });
        // Layer 2 — mid thock (same pitch contour as hitmarker).
        this.tone(ctx, dest, {
          t0: t,
          dur: 0.06,
          type: "triangle",
          freq: 750 * rate,
          freqEnd: 280 * rate,
          gain: 0.44,
          attack: 0.002,
        });
        // Layer 3 — square crunch blip.
        this.tone(ctx, dest, {
          t0: t,
          dur: 0.035,
          type: "square",
          freq: 940 * rate,
          gain: 0.20,
          attack: 0.001,
        });
        // Layer 4 — the CS-style "dink": bright sine ~2.1 kHz with a longer tail.
        this.tone(ctx, dest, {
          t0: t + 0.005,
          dur: 0.11,
          type: "sine",
          freq: 2100 * rate,
          freqEnd: 1800 * rate,
          gain: 0.38,
          attack: 0.003,
        });
        return 0.13;
      case "hurt":
        // Soft squish/grunt: low filtered noise with a downward pitch.
        this.noise(ctx, dest, {
          t0: t,
          dur: 0.16,
          type: "lowpass",
          freq: 900,
          freqEnd: 300,
          gain: 0.5,
          attack: 0.01,
        });
        this.tone(ctx, dest, {
          t0: t,
          dur: 0.14,
          type: "sawtooth",
          freq: 220,
          freqEnd: 120,
          gain: 0.18,
        });
        return 0.18;
      case "death":
        return this.splat(ctx, dest, t);

      // ----- movement ----------------------------------------------------
      case "footstep": {
        // Soft thud; randomize pitch a touch so steps aren't robotic.
        const j = 0.85 + Math.random() * 0.3;
        this.noise(ctx, dest, {
          t0: t,
          dur: 0.07,
          type: "lowpass",
          freq: 380 * j,
          freqEnd: 160 * j,
          gain: 0.32,
          attack: 0.004,
        });
        return 0.09;
      }
      case "jump":
        // Light upward whuff.
        this.noise(ctx, dest, {
          t0: t,
          dur: 0.12,
          type: "bandpass",
          freq: 500,
          freqEnd: 1100,
          q: 0.7,
          gain: 0.3,
          attack: 0.02,
        });
        return 0.13;
      case "land":
        this.noise(ctx, dest, {
          t0: t,
          dur: 0.1,
          type: "lowpass",
          freq: 300,
          freqEnd: 120,
          gain: 0.45,
        });
        this.tone(ctx, dest, {
          t0: t,
          dur: 0.08,
          type: "sine",
          freq: 110,
          freqEnd: 70,
          gain: 0.3,
        });
        return 0.12;

      // ----- objective ---------------------------------------------------
      case "plant_start":
      case "defuse_start":
        // Beepy mechanical start (two quick rising blips + a click).
        this.click(ctx, dest, t, 1100, 0.35, 0.015);
        this.tone(ctx, dest, {
          t0: t + 0.02,
          dur: 0.06,
          type: "square",
          freq: 660,
          gain: 0.22,
        });
        this.tone(ctx, dest, {
          t0: t + 0.1,
          dur: 0.06,
          type: "square",
          freq: 880,
          gain: 0.22,
        });
        return 0.18;
      case "plant_done":
        return this.twoTone(ctx, dest, t, 700, 1050, "confirm");
      case "defuse_done":
        return this.twoTone(ctx, dest, t, 900, 1350, "confirm");
      case "bomb_beep":
        // Classic rising tension beep.
        this.tone(ctx, dest, {
          t0: t,
          dur: 0.09,
          type: "square",
          freq: 1600 * rate,
          freqEnd: 1900 * rate,
          gain: 0.3,
        });
        return 0.1;
      case "bomb_explode":
        return this.explosion(ctx, dest, t);

      // ----- grenades ----------------------------------------------------
      case "nade_throw":
        this.noise(ctx, dest, {
          t0: t,
          dur: 0.18,
          type: "bandpass",
          freq: 600,
          freqEnd: 1400,
          q: 0.6,
          gain: 0.32,
          attack: 0.05,
        });
        return 0.2;
      case "nade_bounce":
        this.tone(ctx, dest, {
          t0: t,
          dur: 0.05,
          type: "triangle",
          freq: 520 * rate,
          freqEnd: 360 * rate,
          gain: 0.3,
        });
        this.click(ctx, dest, t, 2000, 0.25, 0.008);
        return 0.06;
      case "flash_pop":
        // Bright white-noise pop + a high ringing sine.
        this.noise(ctx, dest, {
          t0: t,
          dur: 0.18,
          type: "highpass",
          freq: 4000,
          gain: 0.85,
        });
        this.tone(ctx, dest, {
          t0: t + 0.005,
          dur: 0.5,
          type: "sine",
          freq: 4200,
          gain: 0.3,
        });
        return 0.5;
      case "smoke_pop":
        // Soft hiss that fades.
        this.noise(ctx, dest, {
          t0: t,
          dur: 0.45,
          type: "bandpass",
          freq: 1800,
          freqEnd: 900,
          q: 0.5,
          gain: 0.4,
          attack: 0.02,
        });
        return 0.46;

      // ----- flow --------------------------------------------------------
      case "round_start":
        // Short upbeat sting (perfect-fourth lift).
        this.arp(ctx, dest, t, [392, 523, 659], 0.09, "square", 0.24);
        return 0.36;
      case "round_win":
        // Bright major arpeggio.
        this.arp(ctx, dest, t, [523, 659, 784, 1047], 0.1, "triangle", 0.26);
        return 0.5;
      case "round_lose":
        // Descending minor.
        this.arp(ctx, dest, t, [523, 440, 349, 262], 0.12, "sawtooth", 0.2);
        return 0.56;
      case "match_win":
        return this.fanfare(ctx, dest, t);
      case "buy":
        // Cash/confirm blip — a little "ka-ching".
        this.tone(ctx, dest, {
          t0: t,
          dur: 0.06,
          type: "square",
          freq: 880,
          gain: 0.22,
        });
        this.tone(ctx, dest, {
          t0: t + 0.05,
          dur: 0.1,
          type: "square",
          freq: 1320,
          gain: 0.22,
        });
        return 0.16;
      case "pickup":
        // Light pluck.
        this.tone(ctx, dest, {
          t0: t,
          dur: 0.12,
          type: "triangle",
          freq: 660 * rate,
          freqEnd: 990 * rate,
          gain: 0.26,
        });
        return 0.13;

      // ----- ui ----------------------------------------------------------
      case "ui_click":
        this.tone(ctx, dest, {
          t0: t,
          dur: 0.03,
          type: "square",
          freq: 880,
          gain: 0.18,
        });
        return 0.04;
      case "ui_hover":
        this.tone(ctx, dest, {
          t0: t,
          dur: 0.025,
          type: "sine",
          freq: 1320,
          gain: 0.1,
        });
        return 0.03;
      case "ui_back":
        this.tone(ctx, dest, {
          t0: t,
          dur: 0.04,
          type: "square",
          freq: 440,
          gain: 0.16,
        });
        return 0.05;
      case "kill_confirm":
        // Low satisfying thump+crunch: sub sine drop + mid noise body.
        this.tone(ctx, dest, {
          t0: t,
          dur: 0.12,
          type: "sine",
          freq: 160,
          freqEnd: 55,
          gain: 0.55,
          attack: 0.003,
        });
        this.noise(ctx, dest, {
          t0: t,
          dur: 0.09,
          type: "lowpass",
          freq: 1400,
          freqEnd: 380,
          gain: 0.45,
          attack: 0.002,
        });
        return 0.14;

      default: {
        // Exhaustiveness guard — if a new SoundId is added the compiler flags it.
        const _exhaustive: never = id;
        void _exhaustive;
        return 0.05;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Composite synths
  // -------------------------------------------------------------------------
  /** Generic gun report: transient crack (noise) + optional low thump. */
  private gun(
    ctx: AudioContext,
    dest: AudioNode,
    t: number,
    rate: number,
    p: {
      bodyFreq: number;
      bodyQ: number;
      dur: number;
      thumpFreq: number;
      thumpGain: number;
      crackGain: number;
      tail?: number;
      /** S6: add a short sub-bass sine layer (for pistol/SMG body). */
      subBass?: boolean;
    },
  ): number {
    const f = rate;
    // Sharp broadband transient (the "crack").
    this.noise(ctx, dest, {
      t0: t,
      dur: p.dur,
      type: "bandpass",
      freq: p.bodyFreq * f,
      freqEnd: p.bodyFreq * 0.4 * f,
      q: p.bodyQ,
      gain: p.crackGain,
      attack: 0.0008,
    });
    // High click on top for snap/readability.
    this.click(ctx, dest, t, 3200 * f, 0.5 * p.crackGain, 0.01);
    // Low sine thump for body.
    this.tone(ctx, dest, {
      t0: t,
      dur: p.dur * 0.9,
      type: "sine",
      freq: p.thumpFreq * f,
      freqEnd: p.thumpFreq * 0.6 * f,
      gain: p.thumpGain,
    });
    // S6: sub-bass body for pistol / SMG — short 60→30 Hz sine layer.
    if (p.subBass) {
      this.tone(ctx, dest, {
        t0: t,
        dur: p.dur * 0.7,
        type: "sine",
        freq: 60,
        freqEnd: 30,
        gain: 0.35,
      });
    }
    // Optional decaying tail for bigger guns.
    if (p.tail) {
      this.noise(ctx, dest, {
        t0: t + p.dur * 0.5,
        dur: p.tail,
        type: "lowpass",
        freq: 600 * f,
        freqEnd: 200 * f,
        gain: 0.25,
        attack: 0.01,
      });
    }
    return p.dur + (p.tail ?? 0) + 0.05;
  }

  /** Shotgun: broadband low-mid "chunk" — heavier, rougher than a rifle. */
  private shotgun(ctx: AudioContext, dest: AudioNode, t: number, rate: number): number {
    const f = rate;
    this.noise(ctx, dest, {
      t0: t,
      dur: 0.22,
      type: "lowpass",
      freq: 2200 * f,
      freqEnd: 400 * f,
      q: 0.7,
      gain: 1.0,
      attack: 0.001,
    });
    this.noise(ctx, dest, {
      t0: t,
      dur: 0.12,
      type: "bandpass",
      freq: 900 * f,
      q: 0.6,
      gain: 0.6,
    });
    this.tone(ctx, dest, {
      t0: t,
      dur: 0.18,
      type: "sine",
      freq: 110 * f,
      freqEnd: 60 * f,
      gain: 0.9,
    });
    this.click(ctx, dest, t, 2600 * f, 0.4, 0.01);
    return 0.28;
  }

  /** Sniper: big loud boom with a long-ish tail. */
  private sniper(ctx: AudioContext, dest: AudioNode, t: number, rate: number): number {
    const f = rate;
    this.noise(ctx, dest, {
      t0: t,
      dur: 0.18,
      type: "bandpass",
      freq: 1500 * f,
      freqEnd: 500 * f,
      q: 0.8,
      gain: 1.2,
      attack: 0.0006,
    });
    this.click(ctx, dest, t, 3600 * f, 0.7, 0.012);
    this.tone(ctx, dest, {
      t0: t,
      dur: 0.3,
      type: "sine",
      freq: 90 * f,
      freqEnd: 45 * f,
      gain: 1.0,
    });
    // Long decaying crack tail (the "snap" echo).
    this.noise(ctx, dest, {
      t0: t + 0.08,
      dur: 0.35,
      type: "lowpass",
      freq: 1200 * f,
      freqEnd: 200 * f,
      gain: 0.35,
      attack: 0.02,
    });
    return 0.45;
  }

  /** Juicy tomato SPLAT: noise burst + downward pitch + wet body. */
  private splat(ctx: AudioContext, dest: AudioNode, t: number): number {
    this.noise(ctx, dest, {
      t0: t,
      dur: 0.3,
      type: "lowpass",
      freq: 2400,
      freqEnd: 300,
      q: 0.7,
      gain: 0.9,
      attack: 0.002,
    });
    // Downward "blorp" — the squish.
    this.tone(ctx, dest, {
      t0: t,
      dur: 0.28,
      type: "sawtooth",
      freq: 320,
      freqEnd: 70,
      gain: 0.4,
    });
    this.tone(ctx, dest, {
      t0: t + 0.02,
      dur: 0.22,
      type: "sine",
      freq: 180,
      freqEnd: 50,
      gain: 0.5,
    });
    return 0.32;
  }

  /** Huge filtered-noise explosion with a low rumble tail. */
  private explosion(ctx: AudioContext, dest: AudioNode, t: number): number {
    // Initial blast: bright then rapidly darkening noise.
    this.noise(ctx, dest, {
      t0: t,
      dur: 0.6,
      type: "lowpass",
      freq: 3000,
      freqEnd: 120,
      q: 0.5,
      gain: 1.3,
      attack: 0.003,
    });
    // Sub thump.
    this.tone(ctx, dest, {
      t0: t,
      dur: 0.5,
      type: "sine",
      freq: 80,
      freqEnd: 35,
      gain: 1.0,
    });
    // Long low rumble.
    this.noise(ctx, dest, {
      t0: t + 0.05,
      dur: 1.1,
      type: "lowpass",
      freq: 220,
      freqEnd: 60,
      gain: 0.6,
      attack: 0.08,
      rate: 0.6,
    });
    return 1.2;
  }

  /** Two-tone confirmation (objective complete). */
  private twoTone(
    ctx: AudioContext,
    dest: AudioNode,
    t: number,
    f1: number,
    f2: number,
    _kind: "confirm",
  ): number {
    this.tone(ctx, dest, {
      t0: t,
      dur: 0.1,
      type: "square",
      freq: f1,
      gain: 0.26,
    });
    this.tone(ctx, dest, {
      t0: t + 0.1,
      dur: 0.16,
      type: "square",
      freq: f2,
      gain: 0.26,
    });
    return 0.28;
  }

  /** Sequential notes (arpeggio / sting). */
  private arp(
    ctx: AudioContext,
    dest: AudioNode,
    t: number,
    freqs: number[],
    step: number,
    type: OscillatorType,
    gain: number,
  ): number {
    freqs.forEach((f, i) => {
      this.tone(ctx, dest, {
        t0: t + i * step,
        dur: step * 1.6,
        type,
        freq: f,
        gain,
      });
    });
    return freqs.length * step + step * 1.6;
  }

  /** Bigger victory fanfare: a chord stab then a rising triad with a sparkle. */
  private fanfare(ctx: AudioContext, dest: AudioNode, t: number): number {
    // Opening chord stab (C major).
    [262, 330, 392].forEach((f) =>
      this.tone(ctx, dest, {
        t0: t,
        dur: 0.18,
        type: "sawtooth",
        freq: f,
        gain: 0.16,
      }),
    );
    // Rising lead line.
    this.arp(ctx, dest, t + 0.18, [523, 659, 784, 1047], 0.12, "square", 0.24);
    // Final high sparkle.
    this.tone(ctx, dest, {
      t0: t + 0.18 + 0.48,
      dur: 0.4,
      type: "triangle",
      freq: 1568,
      gain: 0.22,
    });
    return 1.1;
  }

  // -------------------------------------------------------------------------
  // Music
  // -------------------------------------------------------------------------
  startMusic(track: "menu" | "battle"): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.musicBus) return;
    if (ctx.state === "suspended") void ctx.resume();

    if (this.currentTrack === track && this.music) return; // already playing

    // Hard-swap: tear down the old loop, start the new one. The music bus
    // fade gives a clean transition without clicks.
    if (this.music) {
      this.music.stop();
      this.music = null;
    }
    this.currentTrack = track;
    this.music = new MusicEngine(ctx, this.musicBus, this.noiseBuffer);
    this.music.start(track);
  }

  stopMusic(): void {
    if (this.music) {
      this.music.stop();
      this.music = null;
    }
    this.currentTrack = null;
  }

  setTension(t: number): void {
    // S5: propagate tension to the battle music engine. No-op if music isn't running.
    if (this.music && this.currentTrack === "battle") {
      this.music.setTension(clamp(t, 0, 1));
    }
  }
}

// ===========================================================================
// Spatialization
// ===========================================================================
/**
 * Compute distance attenuation + stereo pan for a world-space source relative
 * to a listener (position + yaw). Pan is derived from the source direction in
 * the listener's local frame: right of the listener → +pan, left → -pan.
 *
 * Yaw convention: 0 looks down -Z, increasing yaw turns toward +X (the common
 * three.js / first-person convention used elsewhere in the project). The exact
 * convention only affects left/right symmetry, which is what we want.
 */
function spatialize(
  pos: Vec3,
  listener: { pos: Vec3; yaw: number },
): { pan: number; gain: number } {
  const dx = pos[0] - listener.pos[0];
  const dy = pos[1] - listener.pos[1];
  const dz = pos[2] - listener.pos[2];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (dist >= MAX_AUDIBLE_DIST) return { pan: 0, gain: 0 };

  // Inverse-ish distance falloff, clamped to 1 within REF_DIST, plus a linear
  // fade to silence at MAX_AUDIBLE_DIST so far sounds don't linger.
  let gain = REF_DIST / Math.max(REF_DIST, dist);
  const fade = 1 - dist / MAX_AUDIBLE_DIST;
  gain *= clamp(fade, 0, 1);

  // Project the source direction into the listener's local frame.
  // Forward = (-sin yaw, ?, -cos yaw); right = (cos yaw, 0, -sin yaw).
  const sin = Math.sin(listener.yaw);
  const cos = Math.cos(listener.yaw);
  const rightX = cos;
  const rightZ = -sin;

  let pan = 0;
  if (dist > EPS) {
    // Dot of the horizontal source direction with the listener's right vector.
    const invLen = 1 / dist;
    const right = (dx * rightX + dz * rightZ) * invLen;
    // Soften so sources directly ahead/behind don't snap hard L/R, and scale
    // the panning down a touch for naturalness.
    pan = clamp(right, -1, 1) * 0.85;
  }

  return { pan, gain };
}

// ===========================================================================
// Generative music engine
// ===========================================================================
/**
 * A lightweight, CPU-cheap generative loop. It keeps a small lookahead window
 * and schedules notes a few at a time via a timer; a couple of oscillators plus
 * a slow filter sweep / LFO give it movement without per-frame work.
 */
class MusicEngine {
  private ctx: AudioContext;
  private out: GainNode; // local sub-mix (fades in/out), connected to music bus
  private noiseBuffer: AudioBuffer | null;

  private timer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private running = false;
  private track: "menu" | "battle" = "menu";

  // Persistent drone/LFO nodes (torn down on stop).
  private drone: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;

  // S5: tension state — 0 = calm, 1 = maximum tension (bomb planted).
  private tension = 0;
  // S5: persistent high-layer oscillator for tension (null = silent, created lazily).
  private highLayer: OscillatorNode | null = null;
  private highLayerGain: GainNode | null = null;

  private static readonly LOOKAHEAD_MS = 120;
  private static readonly SCHEDULE_AHEAD = 0.3; // seconds

  constructor(ctx: AudioContext, bus: GainNode, noiseBuffer: AudioBuffer | null) {
    this.ctx = ctx;
    this.noiseBuffer = noiseBuffer;
    this.out = ctx.createGain();
    this.out.gain.value = 0; // fade in on start
    this.out.connect(bus);
  }

  start(track: "menu" | "battle"): void {
    if (this.running) return;
    this.track = track;
    this.running = true;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Fade the sub-mix in.
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(EPS, t);
    this.out.gain.linearRampToValueAtTime(track === "battle" ? 0.5 : 0.4, t + 1.2);

    // A slow filter the melody passes through, modulated by an LFO, gives the
    // whole loop a gentle "breathing" motion for free.
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = track === "battle" ? 1400 : 900;
    filter.Q.value = track === "battle" ? 6 : 2;
    filter.connect(this.out);
    this.filter = filter;

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = track === "battle" ? 0.5 : 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = track === "battle" ? 700 : 350;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(t);
    this.lfo = lfo;

    // A quiet sustained drone for body (root note).
    const drone = ctx.createOscillator();
    drone.type = track === "battle" ? "sawtooth" : "triangle";
    drone.frequency.value = track === "battle" ? 55 : 65.4; // A1 / C2
    const droneGain = ctx.createGain();
    droneGain.gain.value = track === "battle" ? 0.12 : 0.08;
    drone.connect(droneGain);
    droneGain.connect(filter);
    drone.start(t);
    this.drone = drone;
    this.droneGain = droneGain;

    this.step = 0;
    this.nextNoteTime = t + 0.1;
    this.scheduleLoop();
  }

  /**
   * S5: Ramp music tension smoothly. Called by FxAudio when bomb is planted.
   * - Scales pluck gain up (louder, more urgent).
   * - Shortens the step duration (faster tempo) — takes effect at next advance().
   * - Fades in a high-register square-wave layer on top of the melody filter.
   */
  setTension(t: number): void {
    this.tension = t;
    if (this.track !== "battle" || !this.running) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // High layer: create lazily, fade in/out based on tension.
    if (t > 0.05) {
      if (!this.highLayer && this.filter) {
        // Spawn a high-register square wave (E5 / 659 Hz) through the shared filter.
        const osc = ctx.createOscillator();
        osc.type = "square";
        osc.frequency.value = 659;
        const g = ctx.createGain();
        g.gain.value = EPS;
        osc.connect(g);
        g.connect(this.filter);
        osc.start(now);
        this.highLayer = osc;
        this.highLayerGain = g;
      }
      // Fade the high layer to tension * 0.08 (subtle, never overpowering).
      if (this.highLayerGain) {
        try {
          this.highLayerGain.gain.cancelScheduledValues(now);
          this.highLayerGain.gain.setTargetAtTime(Math.max(EPS, t * 0.08), now, 0.5);
        } catch { /* ignore */ }
      }
    } else if (this.highLayerGain) {
      // Tension dropped to zero — fade the high layer back out.
      try {
        this.highLayerGain.gain.cancelScheduledValues(now);
        this.highLayerGain.gain.setTargetAtTime(EPS, now, 0.5);
      } catch { /* ignore */ }
    }
  }

  stop(): void {
    if (!this.running) {
      // Even if never started, make sure nodes are gone.
      this.teardownNow();
      return;
    }
    this.running = false;
    if (this.timer != null && typeof window !== "undefined") {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const fade = 0.5;
    // Fade out the sub-mix, then stop the persistent oscillators.
    try {
      this.out.gain.cancelScheduledValues(t);
      this.out.gain.setValueAtTime(Math.max(EPS, this.out.gain.value), t);
      this.out.gain.exponentialRampToValueAtTime(EPS, t + fade);
    } catch {
      /* ignore */
    }
    const stopAt = t + fade + 0.05;
    try {
      this.drone?.stop(stopAt);
    } catch {
      /* ignore */
    }
    try {
      this.lfo?.stop(stopAt);
    } catch {
      /* ignore */
    }
    try {
      this.highLayer?.stop(stopAt);
    } catch {
      /* ignore */
    }
    // Final disconnect once the fade has completed.
    if (typeof window !== "undefined") {
      window.setTimeout(() => this.teardownNow(), (fade + 0.15) * 1000);
    } else {
      this.teardownNow();
    }
  }

  private teardownNow(): void {
    for (const n of [this.drone, this.lfo, this.highLayer]) {
      try {
        n?.disconnect();
      } catch {
        /* ignore */
      }
    }
    for (const n of [this.droneGain, this.filter, this.highLayerGain, this.out]) {
      try {
        n?.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.drone = null;
    this.lfo = null;
    this.droneGain = null;
    this.filter = null;
    this.highLayer = null;
    this.highLayerGain = null;
  }

  /** Timer-driven lookahead scheduler. */
  private scheduleLoop(): void {
    if (typeof window === "undefined") return;
    this.timer = window.setInterval(() => {
      if (!this.running) return;
      const ctx = this.ctx;
      while (this.nextNoteTime < ctx.currentTime + MusicEngine.SCHEDULE_AHEAD) {
        this.scheduleStep(this.nextNoteTime);
        this.advance();
      }
    }, MusicEngine.LOOKAHEAD_MS);
  }

  private advance(): void {
    // S5: tension shortens the battle step duration (0.16s calm → 0.10s full tension).
    const baseDur = this.track === "battle" ? 0.16 : 0.32;
    const stepDur = this.track === "battle"
      ? baseDur - this.tension * 0.06
      : baseDur;
    this.nextNoteTime += stepDur;
    this.step = (this.step + 1) % 16;
  }

  /** Schedule the note(s) for one step of the pattern. */
  private scheduleStep(time: number): void {
    if (this.track === "battle") this.battleStep(time);
    else this.menuStep(time);
  }

  // --- Menu: chill, quirky, sparse -----------------------------------------
  private menuStep(time: number): void {
    // A lazy pentatonic motif over C, sparse so it stays subtle.
    // Steps of 16; only a few are populated.
    const scale = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3]; // C D E G A C
    const pattern: (number | null)[] = [
      0, null, 4, null, 2, null, null, 5,
      null, 3, null, 1, 4, null, null, null,
    ];
    const idx = pattern[this.step];
    if (idx == null) return;
    const freq = scale[idx];
    this.pluck(time, freq, 0.16, "triangle", 0.16);
    // Occasional soft high sparkle an octave up.
    if (this.step === 7 || this.step === 12) {
      this.pluck(time + 0.02, freq * 2, 0.2, "sine", 0.07);
    }
  }

  // --- Battle: tense, driving ----------------------------------------------
  private battleStep(time: number): void {
    // Insistent minor pulse (A minor) with a steady low pulse on the beat.
    const scale = [220.0, 261.6, 293.7, 329.6, 349.2, 440.0]; // A C D E F A
    const lead: (number | null)[] = [
      0, 0, 3, 0, 2, 0, 4, 0,
      0, 5, 3, 2, 4, 3, 2, 1,
    ];
    const idx = lead[this.step];
    // S5: tension scales pluck gain (0.12 at rest → 0.22 at full tension).
    const pluckGain = 0.12 + this.tension * 0.10;
    if (idx != null) {
      this.pluck(time, scale[idx], 0.13, "sawtooth", pluckGain);
    }
    // Low driving pulse on every other step (the "heartbeat").
    if (this.step % 2 === 0) {
      this.pluck(time, 110, 0.1, "square", 0.1 + this.tension * 0.06);
    }
    // A noise tick for percussion on the off-beats.
    if (this.step % 4 === 2 && this.noiseBuffer && this.filter) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const hp = this.ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 6000;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.08, time);
      g.gain.exponentialRampToValueAtTime(EPS, time + 0.04);
      src.connect(hp);
      hp.connect(g);
      g.connect(this.out);
      src.start(time);
      src.stop(time + 0.06);
    }
  }

  /** A short plucked note for the melody, routed through the shared filter. */
  private pluck(
    time: number,
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
  ): void {
    if (!this.filter) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(EPS, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.01);
    g.gain.exponentialRampToValueAtTime(EPS, time + dur);
    osc.connect(g);
    g.connect(this.filter);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }
}

// ===========================================================================
// Singleton
// ===========================================================================
export const audio: AudioEngine = new TomatoAudio();
