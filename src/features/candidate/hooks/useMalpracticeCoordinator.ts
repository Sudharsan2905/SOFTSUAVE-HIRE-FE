import { useRef, useCallback } from 'react';
import { useAppDispatch } from '../../../store/hooks';
import { setMalpracticeCount, setLastViolation, setTerminated } from '../../../store/slices/proctoringSlice';
import api from '../../../utils/api';
import { MalpracticeType, MonitoringConfig } from '../../../types';

const VIOLATION_MESSAGES: Record<MalpracticeType, string> = {
  tab_switch: 'Tab switch detected',
  fullscreen_exit: 'Fullscreen exit detected',
  screen_share_stop: 'Screen sharing stopped',
  devtools_open: 'Developer tools opened',
  copy_paste: 'Copy/paste attempted',
  keyboard_shortcut: 'Keyboard shortcut blocked',
  multiple_faces: 'Multiple faces detected',
  face_absence: 'Face not visible',
  eye_direction: 'Looking away from screen',
  background_noise: 'Background noise detected',
  audio_violation: 'Audio violation detected',
  speaking: 'Speaking detected',
};

// Per-type first-warning tracking (video/audio use 2-strike rule)
const TWO_STRIKE_TYPES: MalpracticeType[] = [
  'face_absence', 'multiple_faces', 'eye_direction',
  'audio_violation', 'speaking', 'background_noise',
];

interface MalpracticeEventPayload {
  type: MalpracticeType;
  screenImage?: Blob;
  faceImage?: Blob;
  videoChunk?: Blob;
  audioClip?: Blob;
}

interface UseMalpracticeCoordinatorOptions {
  submissionId: string;
  monitoringConfig: MonitoringConfig;
  onTerminated?: (reason: string) => void;
}

export function useMalpracticeCoordinator({
  submissionId,
  monitoringConfig,
  onTerminated,
}: UseMalpracticeCoordinatorOptions) {
  const dispatch = useAppDispatch();
  // Track first warnings for two-strike types
  const firstWarningIssued = useRef<Partial<Record<MalpracticeType, boolean>>>({});
  const isFlagging = useRef(false);

  const flagViolation = useCallback(async (event: MalpracticeEventPayload) => {
    if (isFlagging.current) return; // debounce concurrent flags

    // Two-strike rule for video/audio types
    if (TWO_STRIKE_TYPES.includes(event.type)) {
      if (!firstWarningIssued.current[event.type]) {
        firstWarningIssued.current[event.type] = true;
        dispatch(setLastViolation({
          type: event.type,
          message: `Warning: ${VIOLATION_MESSAGES[event.type]}`,
        }));
        return; // first occurrence is warning only
      }
    }

    isFlagging.current = true;
    try {
      const formData = new FormData();
      formData.append('type', event.type);
      if (event.screenImage && monitoringConfig.screenshot_enabled) {
        formData.append('screen_image', event.screenImage, 'screen.jpg');
      }
      if (event.faceImage && monitoringConfig.video_monitoring) {
        formData.append('face_image', event.faceImage, 'face.jpg');
      }
      if (event.videoChunk && monitoringConfig.video_monitoring) {
        formData.append('video_chunk', event.videoChunk, 'clip.webm');
      }
      if (event.audioClip && monitoringConfig.audio_monitoring) {
        formData.append('audio_clip', event.audioClip, 'audio.webm');
      }

      const response = await api.post(
        `/candidate/submission/${submissionId}/malpractice`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const { malpractice_count, is_terminal } = response.data?.data ?? {};
      if (malpractice_count !== undefined) {
        dispatch(setMalpracticeCount(malpractice_count));
      }

      if (is_terminal) {
        dispatch(setTerminated({ reason: event.type }));
        onTerminated?.(event.type);
      } else {
        dispatch(setLastViolation({
          type: event.type,
          message: `Warning ${malpractice_count}/3: ${VIOLATION_MESSAGES[event.type]}`,
        }));
      }
    } catch (err) {
      console.warn('Malpractice flag failed:', err);
    } finally {
      isFlagging.current = false;
    }
  }, [submissionId, monitoringConfig, dispatch, onTerminated]);

  const resetFirstWarnings = useCallback(() => {
    firstWarningIssued.current = {};
  }, []);

  return { flagViolation, resetFirstWarnings };
}
