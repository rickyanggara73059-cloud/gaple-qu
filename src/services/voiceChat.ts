import { supabase } from "../lib/supabase";

export interface VoiceChatListener {
  onLevelChange: (level: number, isSpeaking: boolean) => void;
  onError: (msg: string) => void;
}

type VoiceSignal =
  | {
      roomId: string;
      from: string;
      kind: "hello";
    }
  | {
      roomId: string;
      from: string;
      to: string;
      kind: "offer" | "answer";
      data: RTCSessionDescriptionInit;
    }
  | {
      roomId: string;
      from: string;
      to: string;
      kind: "ice";
      data: RTCIceCandidateInit;
    };

class VoiceChatManager {
  private mediaStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;

  private isMicOn = false;
  private isDeafened = false;

  private listeners = new Set<VoiceChatListener>();

  private channel: ReturnType<typeof supabase.channel> | null = null;
  private roomId: string | null = null;
  private userId: string | null = null;

  private peers = new Map<string, RTCPeerConnection>();
  private remoteAudio = new Map<string, HTMLAudioElement>();
  private remoteSources = new Map<string, MediaStreamAudioSourceNode>();
  private remoteGains = new Map<string, GainNode>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();

  private readonly rtcConfig: RTCConfiguration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  };

  public subscribe(listener: VoiceChatListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  public getIsMicOn(): boolean {
    return this.isMicOn;
  }

  public getIsDeafened(): boolean {
    return this.isDeafened;
  }

  public async initialize(): Promise<boolean> {
    try {
      const roomId = window.localStorage.getItem(
        "gaple_active_room_id"
      );

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id;

      if (!roomId || !userId) {
        return false;
      }

      if (
        this.channel &&
        this.roomId === roomId &&
        this.userId === userId
      ) {
        return true;
      }

      await this.cleanupSignaling();

      this.roomId = roomId;
      this.userId = userId;

      const channel = supabase
        .channel(`gaple-voice-${roomId}`)
        .on(
          "broadcast",
          { event: "voice_signal" },
          ({ payload }) => {
            void this.handleSignal(
              payload as VoiceSignal
            );
          }
        );

      this.channel = channel;

      await new Promise<void>((resolve, reject) => {
        let settled = false;

        channel.subscribe((status) => {
          if (status === "SUBSCRIBED" && !settled) {
            settled = true;
            resolve();
          }

          if (
            (status === "CHANNEL_ERROR" ||
              status === "TIMED_OUT") &&
            !settled
          ) {
            settled = true;
            reject(
              new Error(
                `Voice channel gagal: ${status}`
              )
            );
          }
        });
      });

      await this.sendHello();

      return true;
    } catch (error) {
      this.notifyError(
        error instanceof Error
          ? error.message
          : "Gagal menyiapkan voice chat."
      );

      return false;
    }
  }

  public async destroy() {
    this.stopMicrophone();

    await this.cleanupSignaling();
  }

  public async toggleMicrophone(): Promise<boolean> {
    if (this.isMicOn) {
      this.stopMicrophone();
      return false;
    }

    return await this.startMicrophone();
  }

  public async startMicrophone(): Promise<boolean> {
    if (this.isMicOn) {
      return true;
    }

    try {
      const initialized =
        await this.initialize();

      if (!initialized) {
        throw new Error(
          "Room voice belum siap."
        );
      }

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          "Browser tidak mendukung akses mikrofon."
        );
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

      this.mediaStream = stream;

      const AudioCtx =
        window.AudioContext ||
        (
          window as unknown as {
            webkitAudioContext: typeof AudioContext;
          }
        ).webkitAudioContext;

      this.audioCtx = new AudioCtx();

      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      const source =
        this.audioCtx.createMediaStreamSource(
          stream
        );

      this.analyser =
        this.audioCtx.createAnalyser();

      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.5;

      source.connect(this.analyser);

      this.isMicOn = true;
      this.startVoiceLoop();

      /*
       * Rebuild all peer connections so the current
       * microphone track is negotiated to every player.
       */
      await this.reconnectAllPeers();

      return true;
    } catch (error) {
      this.isMicOn = false;

      if (this.mediaStream) {
        this.mediaStream
          .getTracks()
          .forEach((track) => track.stop());

        this.mediaStream = null;
      }

      const message =
        error instanceof DOMException &&
        error.name === "NotAllowedError"
          ? "Akses mikrofon ditolak. Izinkan mikrofon di browser."
          : error instanceof Error
            ? error.message
            : "Mikrofon gagal dinyalakan.";

      this.notifyError(message);

      return false;
    }
  }

  public stopMicrophone() {
    this.isMicOn = false;

    if (this.animFrameId !== null) {
      cancelAnimationFrame(
        this.animFrameId
      );

      this.animFrameId = null;
    }

    if (this.mediaStream) {
      this.mediaStream
        .getTracks()
        .forEach((track) => track.stop());

      this.mediaStream = null;
    }

    if (
      this.audioCtx &&
      this.audioCtx.state !== "closed"
    ) {
      void this.audioCtx.close();
      this.audioCtx = null;
    }

    this.analyser = null;

    this.listeners.forEach(
      (listener) => {
        listener.onLevelChange(
          0,
          false
        );
      }
    );

    /*
     * Re-negotiate so other players stop receiving
     * the microphone track.
     */
    if (this.channel) {
      void this.reconnectAllPeers();
    }
  }

  public toggleDeafen(): boolean {
    this.isDeafened = !this.isDeafened;

    for (const gain of this.remoteGains.values()) {
      gain.gain.value =
        this.isDeafened ? 0 : 1;
    }

    for (const audio of this.remoteAudio.values()) {
      audio.muted = this.isDeafened;
    }

    return this.isDeafened;
  }

  private async cleanupSignaling() {
    await this.closeAllPeers();

    for (const source of this.remoteSources.values()) {
      try {
        source.disconnect();
      } catch {}
    }

    for (const gain of this.remoteGains.values()) {
      try {
        gain.disconnect();
      } catch {}
    }

    this.remoteSources.clear();
    this.remoteGains.clear();

    for (const audio of this.remoteAudio.values()) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    }

    this.remoteAudio.clear();
    this.pendingIce.clear();

    if (this.channel) {
      await supabase.removeChannel(
        this.channel
      );

      this.channel = null;
    }

    this.roomId = null;
    this.userId = null;
  }

  private async sendHello() {
    if (
      !this.channel ||
      !this.roomId ||
      !this.userId
    ) {
      return;
    }

    await this.channel.send({
      type: "broadcast",
      event: "voice_signal",
      payload: {
        roomId: this.roomId,
        from: this.userId,
        kind: "hello",
      } satisfies VoiceSignal,
    });
  }

  private async sendSignal(
    signal: VoiceSignal
  ) {
    if (!this.channel) return;

    await this.channel.send({
      type: "broadcast",
      event: "voice_signal",
      payload: signal,
    });
  }

  private async handleSignal(
    signal: VoiceSignal
  ) {
    if (
      !this.roomId ||
      !this.userId ||
      signal.roomId !== this.roomId ||
      signal.from === this.userId
    ) {
      return;
    }

    if (
      "to" in signal &&
      signal.to !== this.userId
    ) {
      return;
    }

    try {
      if (signal.kind === "hello") {
        await this.handleHello(
          signal.from
        );

        return;
      }

      if (signal.kind === "offer") {
        await this.handleOffer(
          signal.from,
          signal.data
        );

        return;
      }

      if (signal.kind === "answer") {
        await this.handleAnswer(
          signal.from,
          signal.data
        );

        return;
      }

      if (signal.kind === "ice") {
        await this.handleIce(
          signal.from,
          signal.data
        );
      }
    } catch (error) {
      console.error(
        "[VoiceChat] signaling error:",
        error
      );
    }
  }

  private async handleHello(
    remoteUserId: string
  ) {
    /*
     * Deterministic initiator:
     * the lexicographically smaller user id
     * sends the offer.
     */
    const initiator =
      Boolean(this.userId) &&
      this.userId! < remoteUserId;

    await this.closePeer(
      remoteUserId
    );

    await this.createPeer(
      remoteUserId,
      initiator
    );
  }

  private async createPeer(
    remoteUserId: string,
    initiator: boolean
  ) {
    const pc =
      new RTCPeerConnection(
        this.rtcConfig
      );

    this.peers.set(
      remoteUserId,
      pc
    );

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      if (
        !this.roomId ||
        !this.userId
      ) {
        return;
      }

      void this.sendSignal({
        roomId: this.roomId,
        from: this.userId,
        to: remoteUserId,
        kind: "ice",
        data: event.candidate.toJSON(),
      });
    };

    pc.ontrack = (event) => {
      const stream =
        event.streams[0];

      if (!stream) return;

      this.attachRemoteAudio(
        remoteUserId,
        stream
      );
    };

    pc.onconnectionstatechange = () => {
      console.info(
        "[VoiceChat] peer " +
        remoteUserId.slice(0, 8) +
        " connection=" +
        pc.connectionState +
        " ice=" +
        pc.iceConnectionState
      );

      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        console.error(
          "[VoiceChat] koneksi voice gagal ke peer " +
          remoteUserId.slice(0, 8)
        );

        void this.closePeer(remoteUserId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.info(
        "[VoiceChat] peer " +
        remoteUserId.slice(0, 8) +
        " ICE=" +
        pc.iceConnectionState
      );
    };

    pc.onicegatheringstatechange = () => {
      console.info(
        "[VoiceChat] peer " +
        remoteUserId.slice(0, 8) +
        " ICE gathering=" +
        pc.iceGatheringState
      );
    };

    pc.onicecandidateerror = (event) => {
      console.warn(
        "[VoiceChat] ICE candidate error peer " +
        remoteUserId.slice(0, 8),
        event
      );
    };

    const localTrack =
      this.mediaStream?.getAudioTracks()[0];

    if (localTrack && this.mediaStream) {
      pc.addTrack(
        localTrack,
        this.mediaStream
      );
    } else {
      pc.addTransceiver(
        "audio",
        {
          direction: "recvonly",
        }
      );
    }

    if (initiator) {
      const offer =
        await pc.createOffer();

      await pc.setLocalDescription(
        offer
      );

      if (
        this.roomId &&
        this.userId &&
        pc.localDescription
      ) {
        await this.sendSignal({
          roomId: this.roomId,
          from: this.userId,
          to: remoteUserId,
          kind: "offer",
          data: {
            type: pc.localDescription
              .type,
            sdp: pc.localDescription
              .sdp,
          },
        });
      }
    }

    return pc;
  }

  private async handleOffer(
    remoteUserId: string,
    offer: RTCSessionDescriptionInit
  ) {
    let pc =
      this.peers.get(
        remoteUserId
      );

    if (!pc) {
      pc = await this.createPeer(
        remoteUserId,
        false
      );
    }

    await pc.setRemoteDescription(
      offer
    );

    await this.flushPendingIce(
      remoteUserId,
      pc
    );

    const localTrack =
      this.mediaStream?.getAudioTracks()[0];

    if (
      localTrack &&
      this.mediaStream &&
      pc.getSenders().every(
        (sender) => !sender.track
      )
    ) {
      const transceiver =
        pc.getTransceivers()
          .find(
            (item) =>
              item.receiver.track.kind ===
              "audio"
          );

      if (transceiver) {
        transceiver.direction =
          "sendrecv";
        await transceiver.sender.replaceTrack(
          localTrack
        );
      } else {
        pc.addTrack(
          localTrack,
          this.mediaStream
        );
      }
    }

    const answer =
      await pc.createAnswer();

    await pc.setLocalDescription(
      answer
    );

    if (
      this.roomId &&
      this.userId &&
      pc.localDescription
    ) {
      await this.sendSignal({
        roomId: this.roomId,
        from: this.userId,
        to: remoteUserId,
        kind: "answer",
        data: {
          type: pc.localDescription
            .type,
          sdp: pc.localDescription
            .sdp,
        },
      });
    }
  }

  private async handleAnswer(
    remoteUserId: string,
    answer: RTCSessionDescriptionInit
  ) {
    const pc =
      this.peers.get(
        remoteUserId
      );

    if (!pc) return;

    await pc.setRemoteDescription(
      answer
    );

    await this.flushPendingIce(
      remoteUserId,
      pc
    );
  }

  private async handleIce(
    remoteUserId: string,
    candidate: RTCIceCandidateInit
  ) {
    const pc =
      this.peers.get(
        remoteUserId
      );

    if (
      !pc ||
      !pc.remoteDescription
    ) {
      const queue =
        this.pendingIce.get(
          remoteUserId
        ) ?? [];

      queue.push(candidate);

      this.pendingIce.set(
        remoteUserId,
        queue
      );

      return;
    }

    try {
      await pc.addIceCandidate(
        candidate
      );
    } catch (error) {
      console.warn(
        "[VoiceChat] ICE error:",
        error
      );
    }
  }

  private async flushPendingIce(
    remoteUserId: string,
    pc: RTCPeerConnection
  ) {
    const queue =
      this.pendingIce.get(
        remoteUserId
      );

    if (!queue?.length) {
      return;
    }

    this.pendingIce.delete(
      remoteUserId
    );

    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(
          candidate
        );
      } catch (error) {
        console.warn(
          "[VoiceChat] ICE flush error:",
          error
        );
      }
    }
  }

  private async reconnectAllPeers() {
    await this.closeAllPeers();
    await this.sendHello();
  }

  private async closePeer(
    remoteUserId: string
  ) {
    const pc =
      this.peers.get(
        remoteUserId
      );

    if (pc) {
      pc.close();
      this.peers.delete(
        remoteUserId
      );
    }

    const source =
      this.remoteSources.get(
        remoteUserId
      );

    if (source) {
      try {
        source.disconnect();
      } catch {}

      this.remoteSources.delete(
        remoteUserId
      );
    }

    const gain =
      this.remoteGains.get(
        remoteUserId
      );

    if (gain) {
      try {
        gain.disconnect();
      } catch {}

      this.remoteGains.delete(
        remoteUserId
      );
    }

    const audio =
      this.remoteAudio.get(
        remoteUserId
      );

    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();

      this.remoteAudio.delete(
        remoteUserId
      );
    }

    this.pendingIce.delete(
      remoteUserId
    );
  }

  private async closeAllPeers() {
    const ids = [
      ...this.peers.keys(),
    ];

    await Promise.all(
      ids.map((id) =>
        this.closePeer(id)
      )
    );
  }


  private attachRemoteAudio(
    remoteUserId: string,
    stream: MediaStream
  ) {
    console.info(
      `[VoiceChat] remote audio diterima dari ${remoteUserId.slice(0, 8)}`
    );

    /*
     * Use the AudioContext that was already resumed by
     * the user's microphone click. This avoids relying on
     * a later HTMLAudioElement autoplay decision.
     */
    if (this.audioCtx) {
      try {
        const oldSource =
          this.remoteSources.get(
            remoteUserId
          );

        const oldGain =
          this.remoteGains.get(
            remoteUserId
          );

        if (oldSource) {
          oldSource.disconnect();
        }

        if (oldGain) {
          oldGain.disconnect();
        }

        const source =
          this.audioCtx.createMediaStreamSource(
            stream
          );

        const gain =
          this.audioCtx.createGain();

        gain.gain.value =
          this.isDeafened ? 0 : 1;

        source.connect(gain);
        gain.connect(
          this.audioCtx.destination
        );

        this.remoteSources.set(
          remoteUserId,
          source
        );

        this.remoteGains.set(
          remoteUserId,
          gain
        );

        void this.audioCtx.resume();

        console.info(
          `[VoiceChat] remote audio terhubung ke speaker ${remoteUserId.slice(0, 8)}`
        );

        return;
      } catch (error) {
        console.error(
          "[VoiceChat] WebAudio remote gagal:",
          error
        );
      }
    }

    /*
     * Fallback only when AudioContext is unavailable.
     */
    let audio =
      this.remoteAudio.get(
        remoteUserId
      );

    if (!audio) {
      audio =
        document.createElement(
          "audio"
        );

      audio.autoplay = true;
      audio.playsInline = true;
      audio.controls = false;
      audio.muted = this.isDeafened;
      audio.volume = 1;

      audio.style.position = "fixed";
      audio.style.left = "-9999px";
      audio.style.width = "1px";
      audio.style.height = "1px";
      audio.style.opacity = "0";
      audio.style.pointerEvents = "none";

      document.body.appendChild(
        audio
      );

      this.remoteAudio.set(
        remoteUserId,
        audio
      );
    }

    audio.srcObject = stream;
    audio.muted = this.isDeafened;

    void audio.play().catch(
      (error) => {
        console.warn(
          "[VoiceChat] fallback audio autoplay tertunda:",
          error
        );
      }
    );
  }

  private startVoiceLoop() {
    if (!this.analyser) {
      return;
    }

    const dataArray =
      new Uint8Array(
        this.analyser.frequencyBinCount
      );

    const update = () => {
      if (
        !this.isMicOn ||
        !this.analyser
      ) {
        return;
      }

      this.analyser.getByteFrequencyData(
        dataArray
      );

      let sum = 0;

      for (
        let i = 0;
        i < dataArray.length;
        i++
      ) {
        sum += dataArray[i];
      }

      const average =
        sum / dataArray.length;

      const level =
        Math.min(
          100,
          Math.round(
            (average / 128) * 100
          )
        );

      const isSpeaking =
        level > 14;

      this.listeners.forEach(
        (listener) => {
          listener.onLevelChange(
            level,
            isSpeaking
          );
        }
      );

      this.animFrameId =
        requestAnimationFrame(
          update
        );
    };

    this.animFrameId =
      requestAnimationFrame(
        update
      );
  }

  private notifyError(
    message: string
  ) {
    console.error(
      "[VoiceChat]",
      message
    );

    this.listeners.forEach(
      (listener) => {
        listener.onError(message);
      }
    );
  }
}

export const voiceChat =
  new VoiceChatManager();


