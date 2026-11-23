/**
 * Helpers for vetting and monitoring the camera / microphone used during an assessment.
 */

// Software "cameras" that can replay a pre-recorded or synthetic feed.
const VIRTUAL_CAMERA_RE =
  /\b(obs|manycam|snap camera|xsplit|splitcam|vcam|droidcam|iriun|epoccam|camo|webcamoid|nvidia broadcast)\b|virtual/i;
// Software audio routing devices.
const VIRTUAL_AUDIO_RE =
  /virtual|vb-audio|voicemeeter|blackhole|soundflower|loopback|cable (input|output)/i;

export function isVirtualCameraLabel(label: string): boolean {
  return VIRTUAL_CAMERA_RE.test(label);
}

export function isVirtualAudioLabel(label: string): boolean {
  return VIRTUAL_AUDIO_RE.test(label);
}

export const VIRTUAL_CAMERA_MESSAGE =
  "A virtual camera was detected. Please select your physical webcam and try again.";
export const VIRTUAL_MIC_MESSAGE =
  "A virtual microphone was detected. Please select your physical microphone and try again.";

/** First video track's label if it looks like a virtual camera, else null. */
export function findVirtualCamera(stream: MediaStream): string | null {
  const label = stream.getVideoTracks()[0]?.label ?? "";
  return isVirtualCameraLabel(label) ? label : null;
}

export function findVirtualMic(stream: MediaStream): string | null {
  const label = stream.getAudioTracks()[0]?.label ?? "";
  return isVirtualAudioLabel(label) ? label : null;
}

interface TrackHealthHandlers {
  /** The device was unplugged / permission revoked / track stopped. */
  onEnded?: () => void;
  /** The browser or OS muted the track (frozen camera, muted mic). */
  onMute?: () => void;
}

/** Watch a track for `ended` / `mute`. Returns a cleanup function. */
export function watchTrackHealth(
  track: MediaStreamTrack,
  handlers: TrackHealthHandlers
): () => void {
  const ended = () => handlers.onEnded?.();
  const mute = () => handlers.onMute?.();
  track.addEventListener("ended", ended);
  track.addEventListener("mute", mute);
  return () => {
    track.removeEventListener("ended", ended);
    track.removeEventListener("mute", mute);
  };
}

/**
 * Shared "is this the entire screen?" rule for screen-capture tracks.
 * Chromium reports `displaySurface`; Firefox/Safari do not. When the browser reports it we
 * require "monitor"; when it cannot tell us we trust the track (consistently everywhere).
 */
export function isEntireScreenSurface(track: MediaStreamTrack | undefined | null): boolean {
  if (!track) return false;
  const { displaySurface } = track.getSettings() as MediaTrackSettings & {
    displaySurface?: string;
  };
  return displaySurface === undefined || displaySurface === "monitor";
}
