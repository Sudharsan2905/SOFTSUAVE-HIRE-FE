import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  storeMonitoringStreams,
  takeScreenStream,
  takeCameraStream,
  takeAudioStream,
  clearMonitoringStreams,
} from "./screenCaptureStore";

function makeMockStream(): MediaStream {
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  return { getTracks: () => [track] } as unknown as MediaStream;
}

// Reset the module-level store before each test by taking all streams
beforeEach(() => {
  takeScreenStream();
  takeCameraStream();
  takeAudioStream();
});

describe("screenCaptureStore", () => {
  describe("storeMonitoringStreams / take*", () => {
    it("stores and retrieves the screen stream", () => {
      const stream = makeMockStream();
      storeMonitoringStreams({ screen: stream });
      expect(takeScreenStream()).toBe(stream);
    });

    it("take nulls out the screen slot after retrieval", () => {
      storeMonitoringStreams({ screen: makeMockStream() });
      takeScreenStream();
      expect(takeScreenStream()).toBeNull();
    });

    it("stores and retrieves the camera stream", () => {
      const stream = makeMockStream();
      storeMonitoringStreams({ camera: stream });
      expect(takeCameraStream()).toBe(stream);
    });

    it("take nulls out the camera slot after retrieval", () => {
      storeMonitoringStreams({ camera: makeMockStream() });
      takeCameraStream();
      expect(takeCameraStream()).toBeNull();
    });

    it("stores and retrieves the audio stream", () => {
      const stream = makeMockStream();
      storeMonitoringStreams({ audio: stream });
      expect(takeAudioStream()).toBe(stream);
    });

    it("take nulls out the audio slot after retrieval", () => {
      storeMonitoringStreams({ audio: makeMockStream() });
      takeAudioStream();
      expect(takeAudioStream()).toBeNull();
    });

    it("stores multiple streams independently", () => {
      const screen = makeMockStream();
      const camera = makeMockStream();
      storeMonitoringStreams({ screen, camera });
      expect(takeScreenStream()).toBe(screen);
      expect(takeCameraStream()).toBe(camera);
    });

    it("partial update does not overwrite unspecified slots", () => {
      const screen = makeMockStream();
      storeMonitoringStreams({ screen });
      storeMonitoringStreams({ camera: makeMockStream() }); // should NOT clear screen
      expect(takeScreenStream()).toBe(screen);
    });
  });

  describe("clearMonitoringStreams", () => {
    it("stops all tracks and nullifies all slots", () => {
      const screen = makeMockStream();
      const camera = makeMockStream();
      const audio = makeMockStream();
      storeMonitoringStreams({ screen, camera, audio });

      clearMonitoringStreams();

      expect(takeScreenStream()).toBeNull();
      expect(takeCameraStream()).toBeNull();
      expect(takeAudioStream()).toBeNull();
    });

    it("calls stop() on every track", () => {
      const stream = makeMockStream();
      const [track] = stream.getTracks();
      storeMonitoringStreams({ screen: stream });
      clearMonitoringStreams();
      expect(track.stop).toHaveBeenCalledTimes(1);
    });

    it("handles empty store without throwing", () => {
      expect(() => clearMonitoringStreams()).not.toThrow();
    });
  });
});
