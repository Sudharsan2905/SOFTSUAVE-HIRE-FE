interface StreamStore {
  screen: MediaStream | null;
  camera: MediaStream | null;
  audio: MediaStream | null;
}

const store: StreamStore = { screen: null, camera: null, audio: null };

export function storeMonitoringStreams(s: Partial<StreamStore>): void {
  if (s.screen !== undefined) store.screen = s.screen;
  if (s.camera !== undefined) store.camera = s.camera;
  if (s.audio !== undefined) store.audio = s.audio;
}

export function takeScreenStream(): MediaStream | null {
  const s = store.screen;
  store.screen = null;
  return s;
}

export function takeCameraStream(): MediaStream | null {
  const s = store.camera;
  store.camera = null;
  return s;
}

export function takeAudioStream(): MediaStream | null {
  const s = store.audio;
  store.audio = null;
  return s;
}

export function clearMonitoringStreams(): void {
  store.screen?.getTracks().forEach((t) => t.stop());
  store.camera?.getTracks().forEach((t) => t.stop());
  store.audio?.getTracks().forEach((t) => t.stop());
  store.screen = null;
  store.camera = null;
  store.audio = null;
}
