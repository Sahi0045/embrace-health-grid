/**
 * Web Audio Clinical Alert & Medical Warning Synthesizer
 * Produces authentic hospital telemetry alarms, emergency sirens, and clinical warning beeps.
 * Features built-in Acoustic Throttling & Priority Preemption (IEC 60601-1-8 standard)
 * to prevent audio collision/distortion when multiple alerts arrive simultaneously.
 */

let sharedAudioCtx: AudioContext | null = null;

const STORAGE_KEY = "embrace_alert_audio_enabled";
const SOUND_STYLE_KEY = "embrace_alert_sound_style";

// Throttling lock to prevent audio cacophony during high-frequency alert storms
let lastPlayedTimestamp = 0;
let lastPlayedSeverity: "critical" | "warning" | "info" | null = null;
const THROTTLE_DURATION_MS = 2500; // Minimum 2.5s between audio sequences

export type AlertSoundStyle = "medical_beep" | "telemetry_siren" | "chime";

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!sharedAudioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass();
    }
  }

  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {
      // AudioContext resumed on user gesture
    });
  }

  return sharedAudioCtx;
}

export function isAudioAlertsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored !== "false";
}

export function setAudioAlertsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
}

export function getAlertSoundStyle(): AlertSoundStyle {
  if (typeof window === "undefined") return "medical_beep";
  return (localStorage.getItem(SOUND_STYLE_KEY) as AlertSoundStyle) || "medical_beep";
}

export function setAlertSoundStyle(style: AlertSoundStyle): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOUND_STYLE_KEY, style);
}

/**
 * Creates an authentic electronic clinical warning beep with harmonic presence
 */
function playWarningBeep(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  gainLevel: number = 0.22
): void {
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "triangle";
  osc1.frequency.setValueAtTime(freq, startTime);

  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(freq * 1.5, startTime);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(freq * 1.2, startTime);
  filter.Q.setValueAtTime(1.8, startTime);

  const attack = 0.01;
  const release = 0.03;
  const sustainEnd = startTime + duration - release;

  gain1.gain.setValueAtTime(0.0001, startTime);
  gain1.gain.linearRampToValueAtTime(gainLevel, startTime + attack);
  gain1.gain.setValueAtTime(gainLevel, sustainEnd);
  gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  gain2.gain.setValueAtTime(0.0001, startTime);
  gain2.gain.linearRampToValueAtTime(gainLevel * 0.4, startTime + attack);
  gain2.gain.setValueAtTime(gainLevel * 0.4, sustainEnd);
  gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc1.connect(gain1);
  gain1.connect(filter);

  osc2.connect(gain2);
  gain2.connect(filter);

  filter.connect(ctx.destination);

  osc1.start(startTime);
  osc1.stop(startTime + duration + 0.05);

  osc2.start(startTime);
  osc2.stop(startTime + duration + 0.05);
}

/**
 * Plays an authentic frequency-swept emergency siren pulse
 */
function playSirenChirp(
  ctx: AudioContext,
  startFreq: number,
  endFreq: number,
  startTime: number,
  duration: number,
  gainLevel: number = 0.24
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(startFreq, startTime);
  osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration * 0.85);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2400, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(gainLevel, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(filter);
  filter.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

/**
 * Plays clinical warning or critical alarms with automatic anti-collision throttling
 */
export function playClinicalAlert(
  severity: "critical" | "warning" | "info" = "warning",
  forcePlay: boolean = false
): void {
  if (!isAudioAlertsEnabled()) return;

  const nowMs = Date.now();
  const timeSinceLast = nowMs - lastPlayedTimestamp;

  // Anti-collision throttling:
  // If multiple alerts arrive within 2.5s, don't overlap audio unless incoming is CRITICAL and previous was lower
  if (!forcePlay && timeSinceLast < THROTTLE_DURATION_MS) {
    if (severity === "critical" && lastPlayedSeverity !== "critical") {
      // Allow critical alarm to preempt lower priority warnings
    } else {
      return; // Skip overlapping sound to avoid cacophony
    }
  }

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    lastPlayedTimestamp = nowMs;
    lastPlayedSeverity = severity;

    const now = ctx.currentTime + 0.02;

    if (severity === "critical") {
      // ── CRITICAL ALARM: Urgent Alternating 4-Pulse Emergency Siren ──
      const burstLen = 0.12;
      const gap = 0.05;

      playWarningBeep(ctx, 960, now, burstLen, 0.28);
      playWarningBeep(ctx, 1280, now + burstLen + gap, burstLen, 0.3);
      playWarningBeep(ctx, 960, now + (burstLen + gap) * 2, burstLen, 0.28);
      playWarningBeep(ctx, 1280, now + (burstLen + gap) * 3, 0.16, 0.32);
    } else if (severity === "warning") {
      // ── AUTHENTIC WARNING SOUND: Authoritative Double-Beep (BEEP-BEEP) ──
      const pulseDuration = 0.16;
      const gap = 0.08;

      playWarningBeep(ctx, 784, now, pulseDuration, 0.25);
      playWarningBeep(ctx, 784, now + pulseDuration + gap, pulseDuration, 0.25);
    } else {
      // ── INFO: Single Confirmation Beep ──
      playWarningBeep(ctx, 880, now, 0.14, 0.16);
    }
  } catch (err) {
    console.debug("Clinical audio alert notice:", err);
  }
}

/**
 * Plays a specialized sweeping emergency siren (Code Blue / Hospital Emergency)
 */
export function playEmergencySiren(): void {
  if (!isAudioAlertsEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.02;
    playSirenChirp(ctx, 550, 1100, now, 0.22, 0.26);
    playSirenChirp(ctx, 550, 1100, now + 0.26, 0.26, 0.28);
  } catch (err) {
    console.debug("Emergency siren notice:", err);
  }
}
