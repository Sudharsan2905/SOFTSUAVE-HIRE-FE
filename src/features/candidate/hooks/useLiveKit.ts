import { useCallback, useEffect, useRef, useState } from 'react';

import {
  LocalVideoTrack,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
  createLocalScreenTracks,
} from 'livekit-client';

import api from '@/utils/api';

// ─── Candidate publisher (screen track only) ──────────────────────────────────

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
  const screenTrackRef = useRef<LocalVideoTrack | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const stopPublishing = useCallback(() => {
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    roomRef.current?.disconnect();
    roomRef.current = null;
    setIsPublishing(false);
  }, []);

  const startPublishing = useCallback(async () => {
    if (!enabled || isPublishing) return;
    try {
      const { data } = await api.post(
        `/candidate/submission/${submissionId}/livekit-token`,
      );
      const { token, room: roomName } = data.data;

      const room = new Room();
      roomRef.current = room;

      const liveKitHost = import.meta.env.VITE_LIVEKIT_HOST as string;
      await room.connect(liveKitHost, token);

      const [screenTrack] = await createLocalScreenTracks({ audio: false });
      screenTrackRef.current = screenTrack as LocalVideoTrack;

      await room.localParticipant.publishTrack(screenTrackRef.current, {
        name: `screen-${submissionId}`,
        source: Track.Source.ScreenShare,
      });

      screenTrackRef.current.mediaStreamTrack.addEventListener('ended', () => {
        stopPublishing();
        onScreenShareStop?.();
      });

      setIsPublishing(true);
    } catch {
      stopPublishing();
    }
  }, [enabled, isPublishing, submissionId, stopPublishing, onScreenShareStop]);

  useEffect(() => {
    return () => {
      stopPublishing();
    };
  }, [stopPublishing]);

  return { isPublishing, startPublishing, stopPublishing };
}

// ─── Admin viewer (subscribe to one candidate's screen track) ─────────────────

interface ViewerOptions {
  workspaceId: string | null;
  targetSubmissionId: string | null;
}

interface ViewerState {
  screenTrack: RemoteTrack | null;
  isConnected: boolean;
}

export function useLiveKitViewer({
  workspaceId,
  targetSubmissionId,
}: ViewerOptions): ViewerState {
  const roomRef = useRef<Room | null>(null);
  const [screenTrack, setScreenTrack] = useState<RemoteTrack | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const disconnect = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    setScreenTrack(null);
    setIsConnected(false);
  }, []);

  const connectAndSubscribe = useCallback(async () => {
    if (!workspaceId || !targetSubmissionId) return;

    disconnect();

    try {
      const { data } = await api.post('/live-interviews/livekit-token', {
        workspace_id: workspaceId,
      });
      const { token } = data.data;

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (
          participant.identity === `candidate-${targetSubmissionId}` &&
          track.source === Track.Source.ScreenShare
        ) {
          setScreenTrack(track);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        setScreenTrack((prev) => (prev === track ? null : prev));
      });

      room.on(RoomEvent.Connected, () => setIsConnected(true));
      room.on(RoomEvent.Disconnected, () => setIsConnected(false));

      const liveKitHost = import.meta.env.VITE_LIVEKIT_HOST as string;
      await room.connect(liveKitHost, token);

      // Find existing track if participant is already in room
      room.remoteParticipants.forEach((participant: RemoteParticipant) => {
        if (participant.identity === `candidate-${targetSubmissionId}`) {
          participant.trackPublications.forEach((pub: RemoteTrackPublication) => {
            if (pub.track?.source === Track.Source.ScreenShare) {
              setScreenTrack(pub.track);
            }
          });
        }
      });
    } catch {
      disconnect();
    }
  }, [workspaceId, targetSubmissionId, disconnect]);

  useEffect(() => {
    connectAndSubscribe();
    return disconnect;
  }, [connectAndSubscribe, disconnect]);

  return { screenTrack, isConnected };
}
