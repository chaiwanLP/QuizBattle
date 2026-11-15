import { io, type Socket } from "socket.io-client";
import { API_URL } from "./api";
import type { RoomState } from "./types";

export interface RoomFailure {
  ok: false;
  code:
    | "invalid-payload"
    | "unauthenticated"
    | "room-not-found"
    | "player-not-found"
    | "room-full"
    | "not-accepting-players"
    | "unknown";
  error: string;
}

export type RoomAck =
  | { ok: true; playerId: string; room: RoomState }
  | RoomFailure;

export type HostAck = { ok: true; room: RoomState } | RoomFailure;

export type ActionAck = { ok: true } | RoomFailure;

export interface ServerToClientEvents {
  "room:state": (room: RoomState) => void;
  "room:closed": (payload: { code: string }) => void;
}

export interface ClientToServerEvents {
  "room:join": (
    payload: { code: string; nickname: string },
    ack: (result: RoomAck) => void,
  ) => void;
  "room:rejoin": (
    payload: { code: string; playerId: string },
    ack: (result: RoomAck) => void,
  ) => void;
  "room:leave": (ack: (result: ActionAck) => void) => void;
  "host:join": (
    payload: { code: string },
    ack: (result: HostAck) => void,
  ) => void;
  "host:close": (
    payload: { code: string },
    ack: (result: ActionAck) => void,
  ) => void;
}

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * One socket per page. Host requests are authorised by the httpOnly session
 * cookie, which is why `withCredentials` is required.
 */
export function createRoomSocket(): GameSocket {
  return io(API_URL, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnectionDelayMax: 5000,
  });
}
