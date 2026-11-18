// Prepares the face-detection assets in public/mediapipe/ (git-ignored) so the strict exam
// serves them itself instead of loading from a CDN: the WASM runtime is copied from
// node_modules and the small face model is downloaded once. Runs on `npm install`.
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const to = join(root, "public", "mediapipe", "wasm");
const model = join(root, "public", "mediapipe", "blaze_face_short_range.tflite");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

if (!existsSync(from)) {
  console.warn("[mediapipe] @mediapipe/tasks-vision not installed; skipping WASM copy");
} else {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log("[mediapipe] WASM runtime copied to public/mediapipe/wasm");
}

if (!existsSync(model)) {
  try {
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(model, Buffer.from(await res.arrayBuffer()));
    console.log("[mediapipe] face model downloaded");
  } catch (err) {
    console.warn(`[mediapipe] could not download the face model (${err.message}); face monitoring will be skipped`);
  }
}
