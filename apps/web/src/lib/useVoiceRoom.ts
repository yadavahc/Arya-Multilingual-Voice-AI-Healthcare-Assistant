'use client';
import { useCallback, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { api } from './api';

/**
 * Minimal LiveKit connect hook for the browser voice path. Joins the same room
 * the Python agent serves. Publishes the mic and plays back agent audio.
 * Falls back cleanly (status="unconfigured") when LiveKit env is missing.
 */
export function useVoiceRoom(role: 'triage' | 'scribe' = 'scribe') {
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error' | 'unconfigured'>(
    'idle',
  );

  const connect = useCallback(async () => {
    setStatus('connecting');
    try {
      const roomName = `consult-${Date.now()}`;
      const { token, url } = await api.token({
        room: roomName,
        identity: `doctor-${Math.random().toString(36).slice(2, 8)}`,
        name: 'Doctor',
        role,
      });
      if (!url || token.startsWith('DEV_TOKEN')) {
        setStatus('unconfigured');
        return;
      }
      const room = new Room({ adaptiveStream: true, dynacast: true });
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.autoplay = true;
          document.body.appendChild(el);
        }
      });
      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);
      roomRef.current = room;
      setStatus('live');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  }, [role]);

  const disconnect = useCallback(async () => {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setStatus('idle');
  }, []);

  return { status, connect, disconnect };
}
