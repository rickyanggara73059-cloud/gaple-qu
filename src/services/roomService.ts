import { supabase } from "../lib/supabase";

export const GAPLE_TARGET_SCORES = [100, 250, 500, 1000, 2000, 5000] as const;

export type GapleRoom = {
  id: string;
  room_code: string;
  host_user_id: string;
  max_players: number;
  target_score: number;
  status: "waiting" | "playing" | "finished";
  round_number: number;
};

export type GaplePlayer = {
  id: string;
  room_id: string;
  user_id: string;
  player_name: string;
  avatar: string;
  seat: number;
  connected: boolean;
  total_score: number;
  chips: number;
  mmr: number;
  total_wins: number;
  total_matches: number;
};

export type GapleRoomSnapshot = {
  room: GapleRoom;
  players: GaplePlayer[];
  localPlayerId: string;
};

export async function ensureAnonymousSession() {
  const existing = await supabase.auth.getSession();
  if (existing.data.session?.user) return existing.data.session;

  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    throw new Error(`Gagal membuat sesi pemain: ${error.message}`);
  }

  if (!data.session?.user) {
    throw new Error("Sesi pemain tidak berhasil dibuat.");
  }

  return data.session;
}

async function currentUserId() {
  const session = await ensureAnonymousSession();
  return session.user.id;
}

async function loadRoomSnapshotById(
  roomId: string,
  userId: string
): Promise<GapleRoomSnapshot> {
  const { data: room, error: roomError } = await supabase
    .from("gaple_rooms")
    .select(
      "id, room_code, host_user_id, max_players, target_score, status, round_number"
    )
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    throw new Error(
      `Gagal memuat room: ${roomError?.message ?? "ROOM_NOT_FOUND"}`
    );
  }

  const { data: players, error: playersError } = await supabase
    .from("gaple_players")
    .select(
      "id, room_id, user_id, player_name, avatar, seat, connected, total_score, chips, mmr, total_wins, total_matches"
    )
    .eq("room_id", roomId)
    .order("seat", { ascending: true });

  if (playersError) {
    throw new Error(`Gagal memuat pemain: ${playersError.message}`);
  }

  const local = (players ?? []).find((player) => player.user_id === userId);

  if (!local) {
    throw new Error("PEMAIN_BELUM_TERDAFTAR");
  }

  return {
    room: room as GapleRoom,
    players: (players ?? []) as GaplePlayer[],
    localPlayerId: local.id,
  };
}

export async function findRoomByCode(
  roomCode: string
): Promise<GapleRoomSnapshot | null> {
  const userId = await currentUserId();
  const code = roomCode.trim().toUpperCase();

  const { data: room, error } = await supabase
    .from("gaple_rooms")
    .select(
      "id, room_code, host_user_id, max_players, target_score, status, round_number"
    )
    .eq("room_code", code)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal mencari room: ${error.message}`);
  }

  if (!room) return null;

  const { data: players, error: playersError } = await supabase
    .from("gaple_players")
    .select(
      "id, room_id, user_id, player_name, avatar, seat, connected, total_score, chips, mmr, total_wins, total_matches"
    )
    .eq("room_id", room.id)
    .order("seat", { ascending: true });

  if (playersError) {
    throw new Error(`Gagal memuat pemain room: ${playersError.message}`);
  }

  const local = (players ?? []).find((player) => player.user_id === userId);

  return local
    ? {
        room: room as GapleRoom,
        players: (players ?? []) as GaplePlayer[],
        localPlayerId: local.id,
      }
    : null;
}

export async function createGapleRoom(args: {
  roomCode: string;
  maxPlayers: number;
  targetScore: number;
  playerName: string;
  avatar: string;
}) {
  const userId = await currentUserId();

  const { data, error } = await supabase.rpc("gaple_create_room", {
    p_room_code: args.roomCode.trim().toUpperCase(),
    p_max_players: args.maxPlayers,
    p_target_score: args.targetScore,
    p_player_name: args.playerName.trim() || "Pemain VIP",
    p_avatar: args.avatar,
  });

  if (error) {
    throw new Error(error.message);
  }

  const roomId = String((data as { room_id?: string })?.room_id ?? "");

  if (!roomId) {
    throw new Error("Supabase tidak mengembalikan room_id.");
  }

  return loadRoomSnapshotById(roomId, userId);
}

export async function joinGapleRoom(args: {
  roomCode: string;
  playerName: string;
  avatar: string;
}) {
  const userId = await currentUserId();

  const { data, error } = await supabase.rpc("gaple_join_room", {
    p_room_code: args.roomCode.trim().toUpperCase(),
    p_player_name: args.playerName.trim() || "Teman VIP",
    p_avatar: args.avatar,
  });

  if (error) {
    throw new Error(error.message);
  }

  const roomId = String((data as { room_id?: string })?.room_id ?? "");

  if (!roomId) {
    throw new Error("Supabase tidak mengembalikan room_id.");
  }

  return loadRoomSnapshotById(roomId, userId);
}

export async function loadGapleRoom(roomId: string) {
  const userId = await currentUserId();
  return loadRoomSnapshotById(roomId, userId);
}

export async function leaveGapleRoom(roomId: string) {
  const { error } = await supabase.rpc("gaple_leave_room", {
    p_room_id: roomId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function subscribeToGapleRoom(
  roomId: string,
  onChange: () => void
) {
  const channel = supabase
    .channel(`gaple-room-${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "gaple_rooms",
        filter: `id=eq.${roomId}`,
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "gaple_players",
        filter: `room_id=eq.${roomId}`,
      },
      onChange
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
