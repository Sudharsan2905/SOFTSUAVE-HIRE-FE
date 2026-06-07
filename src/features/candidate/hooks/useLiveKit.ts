import { useCallback, useEffect, useRef, useState, RefObject } from "react";
import {
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";
import api from "@/utils/api";

// ─── Candidate publisher ──────────────────────────────────────────────────────

interface PublisherOptions {
  submissionId: string | null;
  enabled: boolean;
  screenStreamRef?: RefObject<MediaStream | null>;
  cameraStreamRef?: RefObject<MediaStream | null>;
  audioStreamRef?: RefObject<MediaStream | null>;
}

interface PublisherState {
  isPublishing: boolean;
  startPublishing: () => Promise<void>;
  stopPublishing: () => void;
}

export function useLiveKitPublisher({
  submissionId,
  enabled,
  screenStreamRef,
  cameraStreamRef,
  audioStreamRef,
}: PublisherOptions): PublisherState {
  const roomRef = useRef<Room | null>(null);
  const publishedTracksRef = useRef<(LocalVideoTrack | LocalAudioTrack)[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);

  const stopPublishing = useCallback(() => {
    console.log(`[LiveKit] Stopping publishing: submission=${submissionId ?? ""}`);
    publishedTracksRef.current.forEach((t) => t.stop());
    publishedTracksRef.current = [];
    roomRef.current?.disconnect();
    roomRef.current = null;
    setIsPublishing(false);
  }, [submissionId]);

  const startPublishing = useCallback(async () => {
    if (!enabled || !submissionId || isPublishing) return;
    console.log(`[LiveKit] Connecting: submission=${submissionId}`);
    try {
      const { data } = await api.post(`/api/candidate/submission/${submissionId}/livekit-token`);
      const { token } = data.data as { token: string };

      const room = new Room();
      roomRef.current = room;
      const liveKitHost = import.meta.env.VITE_LIVEKIT_HOST as string;
      await room.connect(liveKitHost, token);
      console.log(`[LiveKit] Room connected: host=${liveKitHost} submission=${submissionId}`);

      // Screen share — reuse the pre-acquired stream (no second getDisplayMedia prompt)
      const screenStream = screenStreamRef?.current;
      if (screenStream) {
        const rawScreenTrack = screenStream.getVideoTracks()[0];
        if (rawScreenTrack) {
          const screenTrack = new LocalVideoTrack(rawScreenTrack);
          publishedTracksRef.current.push(screenTrack);
          await room.localParticipant.publishTrack(screenTrack, {
            name: `screen-${submissionId}`,
            source: Track.Source.ScreenShare,
          });
          console.log(`[LiveKit] Published screen track: screen-${submissionId}`);
          rawScreenTrack.addEventListener("ended", stopPublishing);
        }
      }

      // Camera — reuse pre-acquired camera stream
      const cameraStream = cameraStreamRef?.current;
      if (cameraStream) {
        const rawCamTrack = cameraStream.getVideoTracks()[0];
        if (rawCamTrack) {
          const camTrack = new LocalVideoTrack(rawCamTrack);
          publishedTracksRef.current.push(camTrack);
          await room.localParticipant.publishTrack(camTrack, {
            name: `camera-${submissionId}`,
            source: Track.Source.Camera,
          });
          console.log(`[LiveKit] Published camera track: camera-${submissionId}`);
        }
      }

      // Microphone — reuse pre-acquired audio stream
      const micStream = audioStreamRef?.current;
      if (micStream) {
        const rawAudioTrack = micStream.getAudioTracks()[0];
        if (rawAudioTrack) {
          const audioTrack = new LocalAudioTrack(rawAudioTrack);
          publishedTracksRef.current.push(audioTrack);
          await room.localParticipant.publishTrack(audioTrack, {
            name: `mic-${submissionId}`,
            source: Track.Source.Microphone,
          });
          console.log(`[LiveKit] Published audio track: mic-${submissionId}`);
        }
      }

      setIsPublishing(true);
    } catch (err) {
      console.error(`[LiveKit] Publish failed: submission=${submissionId}`, err);
      stopPublishing();
    }
  }, [
    enabled,
    isPublishing,
    submissionId,
    stopPublishing,
    screenStreamRef,
    cameraStreamRef,
    audioStreamRef,
  ]);

  useEffect(() => {
    return () => stopPublishing();
  }, [stopPublishing]);

  return { isPublishing, startPublishing, stopPublishing };
}

// ─── Admin viewer ─────────────────────────────────────────────────────────────

interface ViewerOptions {
  workspaceId: string | null;
  targetSubmissionId: string | null;
}

interface ViewerState {
  screenTrack: RemoteTrack | null;
  isConnected: boolean;
}

function findScreenTrack(room: Room, submissionId: string): RemoteTrack | null {
  const identity = `candidate-${submissionId}`;
  for (const participant of room.remoteParticipants.values()) {
    if (participant.identity !== identity) continue;
    for (const pub of participant.trackPublications.values()) {
      if (pub.track?.source === Track.Source.ScreenShare) return pub.track;
    }
  }
  return null;
}

export function useLiveKitViewer({ workspaceId, targetSubmissionId }: ViewerOptions): ViewerState {
  const roomRef = useRef<Room | null>(null);
  const [screenTrack, setScreenTrack] = useState<RemoteTrack | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const targetRef = useRef(targetSubmissionId);

  useEffect(() => {
    targetRef.current = targetSubmissionId;
  }, [targetSubmissionId]);

  useEffect(() => {
    if (!workspaceId) return;

    let active = true;
    const room = new Room();
    roomRef.current = room;

    room.on(RoomEvent.Connected, () => {
      if (!active) return;
      setIsConnected(true);
      if (targetRef.current) setScreenTrack(findScreenTrack(room, targetRef.current));
    });

    room.on(RoomEvent.Disconnected, () => {
      setIsConnected(false);
      setScreenTrack(null);
    });

    room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (
          targetRef.current &&
          participant.identity === `candidate-${targetRef.current}` &&
          track.source === Track.Source.ScreenShare
        ) {
          setScreenTrack(track);
        }
      }
    );

    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      setScreenTrack((prev) => (prev === track ? null : prev));
    });

    api
      .post("/live-interviews/livekit-token", { workspace_id: workspaceId })
      .then(({ data }) => {
        if (!active) return;
        const liveKitHost = import.meta.env.VITE_LIVEKIT_HOST as string;
        return room.connect(liveKitHost, data.data.token as string);
      })
      .catch(() => {});

    return () => {
      active = false;
      room.disconnect();
      roomRef.current = null;
      setScreenTrack(null);
      setIsConnected(false);
    };
  }, [workspaceId]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || !isConnected) return;
    setScreenTrack(targetSubmissionId ? findScreenTrack(room, targetSubmissionId) : null);
  }, [targetSubmissionId, isConnected]);

  return { screenTrack, isConnected };
}
