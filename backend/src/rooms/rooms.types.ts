/** Phase 2 only has lobbies; Phase 3 adds "playing" and "finished". */
export type RoomStatus = 'lobby';

export interface RoomPlayer {
  id: string;
  nickname: string;
  joinedAt: string;
}

/** Redis-only record: the socket that currently owns the seat is not public. */
export interface StoredPlayer extends RoomPlayer {
  socketId?: string;
}

/** Internal Redis record; contains the host id, so it never leaves the server. */
export interface RoomRecord {
  code: string;
  status: RoomStatus;
  quizId: string;
  quizTitle: string;
  questionCount: number;
  hostId: string;
  hostName: string;
  createdAt: string;
}

/** Public room snapshot sent to hosts and players. */
export interface RoomState {
  code: string;
  status: RoomStatus;
  quizId: string;
  quizTitle: string;
  questionCount: number;
  hostName: string;
  createdAt: string;
  players: RoomPlayer[];
}

/** Machine-readable outcomes, so clients never parse the Thai message. */
export type RoomErrorCode =
  | 'invalid-payload'
  | 'unauthenticated'
  | 'room-not-found'
  | 'player-not-found'
  | 'room-full'
  | 'not-accepting-players'
  | 'unknown';

export interface RoomFailure {
  ok: false;
  code: RoomErrorCode;
  error: string;
}

export type RoomResult =
  | { ok: true; playerId: string; room: RoomState }
  | RoomFailure;

export type HostRoomResult = { ok: true; room: RoomState } | RoomFailure;

export type CloseRoomResult = { ok: true } | RoomFailure;
