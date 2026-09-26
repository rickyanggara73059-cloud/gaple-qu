"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Player = {
  id: string;
  player_name: string;
  seat: number;
  connected: boolean;
};

type VoiceSignal =
  | {
      kind: "hello";
      from: string;
      to: null;
      micEnabled: boolean;
      readyFor?: string[];
    }
  | {
      kind: "description";
      from: string;
      to: string;
      description: RTCSessionDescriptionInit;
    }
  | {
      kind: "ice";
      from: string;
      to: string;
      candidate: RTCIceCandidateInit;
    };

type PeerState = {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  seenCandidates: Set<string>;
  operations: Promise<void>;
};

type Props = {
  roomId: string;
  playerId: string;
  players: Player[];
};

const ICE_SERVERS: RTCIceServer[] = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
  {
    urls: "stun:stun1.l.google.com:19302",
  },
];

export default function VoiceChat({
  roomId,
  playerId,
  players,
}: Props) {
  const [micEnabled, setMicEnabled] = useState(false);
  const [micLoading, setMicLoading] = useState(false);
  const [micError, setMicError] = useState("");
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null
  );

  const streamRef = useRef<MediaStream | null>(null);

  const peersRef = useRef<Map<string, PeerState>>(new Map());

  const micEnabledRef = useRef(false);

  const playersRef = useRef(players);
  const readyPeersRef = useRef(new Set<string>());
  const generationRef = useRef(0);

  // Temporary diagnostics: do not log SDP, credentials, or candidate IPs.
  function log(event: string, peerId?: string, detail?: unknown) {
    console.info("[WebRTC]", { roomId, playerId, peerId, event, detail });
  }

  function enqueue(peer: PeerState, operation: () => Promise<void>) {
    peer.operations = peer.operations.then(async () => {
      if (peer.pc.signalingState !== "closed") await operation();
    }).catch((error) => log("operation error", undefined, String(error)));
    return peer.operations;
  }

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  async function sendSignal(signal: VoiceSignal) {
    const channel = channelRef.current;
    if (signal.kind === "hello") {
      signal = { ...signal, readyFor: playersRef.current.filter((player) => player.connected).map((player) => player.id) };
    }
    if (!channel) {
      log("signal not sent: subscription unavailable", signal.to ?? undefined, signal.kind);
      return;
    }
    try {
      const result = await channel.send({ type: "broadcast", event: "signal", payload: signal });
      log("signal send result", signal.to ?? undefined, { kind: signal.kind, result });
    } catch (error) {
      log("signal send error", signal.to ?? undefined, String(error));
    }
  }

  function createPeer(remotePlayerId: string) {
    const existing = peersRef.current.get(remotePlayerId);

    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    const peer: PeerState = {
      pc,
      polite: playerId > remotePlayerId,
      makingOffer: false,
      ignoreOffer: false,
      pendingCandidates: [],
      seenCandidates: new Set(),
      operations: Promise.resolve(),
    };

    peersRef.current.set(remotePlayerId, peer);
    log("peer initialized (audio; no DataChannel)", remotePlayerId);

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        log("ICE gathering complete", remotePlayerId);
        return;
      }
      log("ICE candidate generated", remotePlayerId, event.candidate.type);

      sendSignal({
        kind: "ice",
        from: playerId,
        to: remotePlayerId,
        candidate: event.candidate.toJSON(),
      });
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];

      if (!stream) return;

      setRemoteStreams((current) => ({
        ...current,
        [remotePlayerId]: stream,
      }));
    };

    pc.onnegotiationneeded = () => {
      void enqueue(peer, async () => {
        try {
          if (pc.signalingState !== "stable") return;
  
          peer.makingOffer = true;
  
          const offer = await pc.createOffer();
          log("offer created", remotePlayerId);
  
          if (pc.signalingState !== "stable") return;
  
          await pc.setLocalDescription(offer);
  
          if (!pc.localDescription) return;
  
          await sendSignal({
            kind: "description",
            from: playerId,
            to: remotePlayerId,
            description: pc.localDescription,
          });
        } catch (error) {
          log("negotiation error", remotePlayerId, String(error));
        } finally {
          peer.makingOffer = false;
        }
      });
    };

    pc.onicegatheringstatechange = () => log("iceGatheringState", remotePlayerId, pc.iceGatheringState);
    pc.oniceconnectionstatechange = () => log("iceConnectionState", remotePlayerId, pc.iceConnectionState);
    pc.onsignalingstatechange = () => log("signalingState", remotePlayerId, pc.signalingState);
    pc.onicecandidateerror = (event) => log("ICE server error", remotePlayerId, { code: event.errorCode, text: event.errorText });
    pc.onconnectionstatechange = () => {
      log("connectionState", remotePlayerId, pc.connectionState);
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        setRemoteStreams((current) => {
          const next = { ...current };
          delete next[remotePlayerId];
          return next;
        });
      }
    };

    return peer;
  }

  function addLocalTracks(peer: PeerState) {
    const stream = streamRef.current;

    if (!stream || !channelRef.current) return;

    for (const track of stream.getTracks()) {
      const alreadyAdded = peer.pc
        .getSenders()
        .some((sender) => sender.track === track);

      if (!alreadyAdded) {
        peer.pc.addTrack(track, stream);
      }
    }
  }

  async function flushCandidates(peer: PeerState, remotePlayerId: string) {
    const candidates = [...peer.pendingCandidates];

    peer.pendingCandidates = [];

    for (const candidate of candidates) {
      try {
        await peer.pc.addIceCandidate(candidate);
        log("ICE candidate added (queued)", remotePlayerId);
      } catch (error) {
        log("queued ICE error", remotePlayerId, String(error));
      }
    }
  }

  async function handleDescription(
    signal: Extract<VoiceSignal, { kind: "description" }>
  ) {
    const peer = createPeer(signal.from);
    const pc = peer.pc;

    const offerCollision =
      signal.description.type === "offer" &&
      (peer.makingOffer || pc.signalingState !== "stable");

    peer.ignoreOffer = !peer.polite && offerCollision;

    if (peer.ignoreOffer) {
      peer.pendingCandidates = [];
      log("colliding offer ignored", signal.from);
      return;
    }

    try {
      // Implicit rollback handles a colliding offer in modern WebRTC browsers.
      await pc.setRemoteDescription(signal.description);
      log("remote description set", signal.from, signal.description.type);

      await flushCandidates(peer, signal.from);

      if (signal.description.type === "offer") {
        addLocalTracks(peer);

        const answer = await pc.createAnswer();
        log("answer created", signal.from);

        await pc.setLocalDescription(answer);

        if (!pc.localDescription) return;

        await sendSignal({
          kind: "description",
          from: playerId,
          to: signal.from,
          description: pc.localDescription,
        });
      }
    } catch (error) {
      log("description error", signal.from, String(error));
    }
  }

  async function handleIceCandidate(
    signal: Extract<VoiceSignal, { kind: "ice" }>
  ) {
    const peer = createPeer(signal.from);

    log("ICE candidate received", signal.from);
    if (peer.ignoreOffer) return;
    const key = JSON.stringify(signal.candidate);
    if (peer.seenCandidates.has(key)) {
      log("duplicate ICE candidate ignored", signal.from);
      return;
    }
    peer.seenCandidates.add(key);
    if (!peer.pc.remoteDescription) {
      log("ICE candidate queued", signal.from);
      peer.pendingCandidates.push(signal.candidate);
      return;
    }

    try {
      await peer.pc.addIceCandidate(signal.candidate);
      log("ICE candidate added", signal.from);
    } catch (error) {
      if (!peer.ignoreOffer) {
        log("ICE error", signal.from, String(error));
      }
    }
  }

  useEffect(() => {
    let active = true;
    generationRef.current += 1;
    log("voice mounted", undefined, { secureContext: window.isSecureContext });
    const announce = () => {
      if (active && channelRef.current) void sendSignal({
        kind: "hello", from: playerId, to: null, micEnabled: micEnabledRef.current,
      });
    };
    const channel = supabase
      .channel(`domino-voice-${roomId}`, { config: { broadcast: { ack: true } } })
      .on(
        "broadcast",
        { event: "signal" },
        async ({ payload }) => {
          if (!active) return;
          const signal = payload as VoiceSignal;
          if (!signal || typeof signal.from !== "string") return;

          if (signal.from === playerId) return;

          if (
            signal.kind !== "hello" &&
            signal.to !== playerId
          ) {
            return;
          }

          const remotePlayer = playersRef.current.find(
            (player) => player.id === signal.from
          );

          if (!remotePlayer || !remotePlayer.connected) {
            log("signal ignored: player snapshot not ready", signal.from, signal.kind);
            return;
          }
          log("signal received", signal.from, signal.kind);

          if (signal.kind === "hello") {
            if (!signal.readyFor?.includes(playerId)) return;
            const firstHello = !readyPeersRef.current.has(signal.from);
            readyPeersRef.current.add(signal.from);
            if (firstHello) announce();
            if (signal.micEnabled || micEnabledRef.current) {
              const peer = createPeer(signal.from);

              addLocalTracks(peer);
            }

            return;
          }

          if (signal.kind === "description") {
            await enqueue(createPeer(signal.from), () => handleDescription(signal));
            return;
          }

          if (signal.kind === "ice") {
            await enqueue(createPeer(signal.from), () => handleIceCandidate(signal));
          }
        }
      )
      .subscribe((status, error) => {
        if (!active) return;
        log("subscription", undefined, { status, error: error?.message });
        if (status !== "SUBSCRIBED") {
          channelRef.current = null;
          return;
        }

        channelRef.current = channel;

        sendSignal({
          kind: "hello",
          from: playerId,
          to: null,
          micEnabled: micEnabledRef.current,
        });
      });

    // Broadcast has no replay: rediscover peers after delayed roster/subscription.
    const discoveryTimer = window.setInterval(announce, 3000);
    return () => {
      active = false;
      generationRef.current += 1;
      window.clearInterval(discoveryTimer);
      channelRef.current = null;
      readyPeersRef.current.clear();
      void supabase.removeChannel(channel);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      micEnabledRef.current = false;
      setMicEnabled(false);

      for (const peer of peersRef.current.values()) {
        peer.pc.close();
      }

      peersRef.current.clear();

      setRemoteStreams({});
    };
  }, [roomId, playerId]);

  useEffect(() => {
    const activePlayerIds = new Set(
      players
        .filter((player) => player.connected)
        .map((player) => player.id)
    );

    for (const [remotePlayerId, peer] of peersRef.current) {
      if (!activePlayerIds.has(remotePlayerId)) {
        peer.pc.close();
        peersRef.current.delete(remotePlayerId);
        readyPeersRef.current.delete(remotePlayerId);

        setRemoteStreams((current) => {
          const next = { ...current };
          delete next[remotePlayerId];
          return next;
        });
      }
    }
  }, [players]);

  async function toggleMic() {
    setMicError("");

    if (micEnabled) {
      micEnabledRef.current = false;
      setMicEnabled(false);

      const stream = streamRef.current;

      if (stream) {
        stream.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }

      sendSignal({
        kind: "hello",
        from: playerId,
        to: null,
        micEnabled: false,
      });

      return;
    }

    setMicLoading(true);
    const generation = generationRef.current;

    try {
      if (!streamRef.current) {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("Microphone memerlukan HTTPS dan browser yang mendukung WebRTC.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });

        if (generation !== generationRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
      }

      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });

      micEnabledRef.current = true;
      setMicEnabled(true);

      for (const player of playersRef.current) {
        if (
          player.id === playerId ||
          !player.connected ||
          !readyPeersRef.current.has(player.id)
        ) {
          continue;
        }

        const peer = createPeer(player.id);

        addLocalTracks(peer);
      }

      sendSignal({
        kind: "hello",
        from: playerId,
        to: null,
        micEnabled: true,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Microphone tidak dapat digunakan.";

      setMicError(
        message.includes("Permission")
          ? "Izin microphone ditolak browser."
          : message
      );
    } finally {
      setMicLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void toggleMic()}
        disabled={micLoading}
        title={
          micError ||
          (micEnabled
            ? "Matikan microphone"
            : "Nyalakan microphone")
        }
        className={[
          "rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] transition sm:px-4",
          micEnabled
            ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
            : "border-white/10 text-white/45 hover:bg-white/5 hover:text-white",
          micLoading
            ? "cursor-wait opacity-50"
            : "",
        ].join(" ")}
      >
        {micLoading
          ? "MIC..."
          : micEnabled
            ? "🎙 MIC ON"
            : "🎙 MIC OFF"}
      </button>

      {Object.entries(remoteStreams).map(
        ([remotePlayerId, stream]) => (
          <audio
            key={remotePlayerId}
            autoPlay
            playsInline
            ref={(element) => {
              if (!element) return;

              if (element.srcObject !== stream) {
                element.srcObject = stream;
              }

              void element.play().catch((error) => log("audio playback blocked", remotePlayerId, String(error)));
            }}
          />
        )
      )}
    </>
  );
}
