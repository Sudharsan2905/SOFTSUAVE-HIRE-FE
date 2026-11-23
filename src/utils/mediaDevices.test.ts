import { describe, it, expect, vi } from "vitest";
import {
  isVirtualCameraLabel,
  isVirtualAudioLabel,
  findVirtualCamera,
  watchTrackHealth,
  isEntireScreenSurface,
} from "./mediaDevices";

describe("virtual device detection", () => {
  it.each([
    "OBS Virtual Camera",
    "ManyCam Virtual Webcam",
    "Snap Camera",
    "XSplit VCam",
    "Virtual Camera",
    "DroidCam Source 3",
    "NVIDIA Broadcast",
  ])("flags %s as a virtual camera", (label) => expect(isVirtualCameraLabel(label)).toBe(true));

  it.each([
    "Integrated Camera",
    "Logitech HD Pro Webcam C920 (046d:082d)",
    "FaceTime HD Camera",
    "",
  ])("accepts %s", (label) => expect(isVirtualCameraLabel(label)).toBe(false));

  it("flags virtual audio routers but not real microphones", () => {
    expect(isVirtualAudioLabel("VB-Audio Virtual Cable")).toBe(true);
    expect(isVirtualAudioLabel("BlackHole 2ch")).toBe(true);
    expect(isVirtualAudioLabel("Built-in Microphone")).toBe(false);
  });

  it("findVirtualCamera reads the first video track label", () => {
    const stream = {
      getVideoTracks: () => [{ label: "OBS Virtual Camera" }],
    } as unknown as MediaStream;
    expect(findVirtualCamera(stream)).toBe("OBS Virtual Camera");
  });
});

describe("watchTrackHealth", () => {
  it("calls the handlers on ended/mute and stops after cleanup", () => {
    const target = new EventTarget();
    const track = target as unknown as MediaStreamTrack;
    const onEnded = vi.fn();
    const onMute = vi.fn();
    const cleanup = watchTrackHealth(track, { onEnded, onMute });
    target.dispatchEvent(new Event("mute"));
    target.dispatchEvent(new Event("ended"));
    expect(onMute).toHaveBeenCalledTimes(1);
    expect(onEnded).toHaveBeenCalledTimes(1);
    cleanup();
    target.dispatchEvent(new Event("ended"));
    expect(onEnded).toHaveBeenCalledTimes(1);
  });
});

describe("isEntireScreenSurface", () => {
  const track = (displaySurface?: string) =>
    ({ getSettings: () => ({ displaySurface }) }) as unknown as MediaStreamTrack;
  it("accepts monitor and an unreported surface (non-Chromium), rejects window/tab", () => {
    expect(isEntireScreenSurface(track("monitor"))).toBe(true);
    expect(isEntireScreenSurface(track(undefined))).toBe(true);
    expect(isEntireScreenSurface(track("window"))).toBe(false);
    expect(isEntireScreenSurface(track("browser"))).toBe(false);
    expect(isEntireScreenSurface(undefined)).toBe(false);
  });
});
