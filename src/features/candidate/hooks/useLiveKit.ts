import { useCallback, useEffect, useRef, useState } from "react";
import {
  LocalTrack,
  LocalVideoTrack,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
  createLocalScreenTracks,
  createLocalTracks,
} from "livekit-client";
import api from "@/utils/api";

// ─── Candidate publisher ──────────────────────────────────────────────────────

interface PublisherOptions {
  submissionId: string;
  enabled: boolean;
  onScreenShareStop?: () => void;
}

interface PublisherState {
  isPublishing: boolean;
  startPublishing: () => Promise<void>;
  stopPublishing: () => void;
}

export function useLiveKitPublisher({
  submissionId,
  enabled,
  onScreenShareStop,
}: PublisherOptions): PublisherState {
  const roomRef = useRef<Room | null>(null);
  const tracksRef = useRef<LocalTrack[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);

  const stopPublishing = useCallback(() => {
    tracksRef.current.forEach((t) => t.stop());
    tracksRef.current = [];
    roomRef.current?.disconnect();
    roomRef.current = null;
    setIsPublishing(false);
  }, []);

  const startPublishing = useCallback(async () => {
    if (!enabled || isPublishing) return;
    try {
      const { data } = await api.post(`/candidate/submission/${submissionId}/livekit-token`);
      const { token } = data.data as { token: string };

      const room = new Room();
      roomRef.current = room;
      const liveKitHost = import.meta.env.VITE_LIVEKIT_HOST as string;
      await room.connect(liveKitHost, token);

      // Screen share (requires user-gesture context — called post-consent)
      try {
        const [screenTrack] = await createLocalScreenTracks({ audio: false });
        const localScreen = screenTrack as LocalVideoTrack;
        tracksRef.current.push(localScreen);
        await room.localParticipant.publishTrack(localScreen, {
          name: `screen-${submissionId}`,
          source: Track.Source.ScreenShare,
        });
        localScreen.mediaStreamTrack.addEventListener("ended", () => {
          stopPublishing();
          onScreenShareStop?.();
        });
      } catch {
        /* screen share denied — continue with camera/mic only */
      }

      // Camera + microphone
      const localTracks = await createLocalTracks({ audio: true, video: true });
      for (const track of localTracks) {
        tracksRef.current.push(track);
        const source =
          track.kind === Track.Kind.Video ? Track.Source.Camera : Track.Source.Microphone;
        const name =
          track.kind === Track.Kind.Video ? `camera-${submissionId}` : `mic-${submissionId}`;
        await room.localParticipant.publishTrack(track, { name, source });
      }

      setIsPublishing(true);
    } catch {
      stopPublishing();
    }
  }, [enabled, isPublishing, submissionId, stopPublishing, onScreenShareStop]);

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
