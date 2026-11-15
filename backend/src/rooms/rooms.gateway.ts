import {
  Logger,
  type OnApplicationShutdown,
} from '@nestjs/common';
import {
  Ack,
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { Server, Socket } from 'socket.io';
import { ACCESS_TOKEN_COOKIE } from '../auth/auth.constants';
import type { PublicUser } from '../auth/auth.types';
import { AuthService } from '../auth/auth.service';
import { RedisService } from '../redis/redis.service';
import {
  hostRoomSchema,
  joinRoomSchema,
  rejoinRoomSchema,
} from './rooms.schemas';
import { RoomsService } from './rooms.service';
import type {
  CloseRoomResult,
  HostRoomResult,
  RoomErrorCode,
  RoomFailure,
  RoomResult,
  RoomState,
} from './rooms.types';

type AckFn<T> = (result: T) => void;

interface SocketSession {
  role?: 'host' | 'player';
  code?: string;
  playerId?: string;
}

function roomChannel(code: string): string {
  return `room:${code}`;
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${name}=`)) continue;

    const value = trimmed.slice(name.length + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return undefined;
}

@WebSocketGateway()
export class RoomsGateway
  implements OnGatewayInit, OnGatewayDisconnect, OnApplicationShutdown
{
  private readonly logger = new Logger(RoomsGateway.name);

  @WebSocketServer()
  private server!: Server;

  private pubClient?: Redis;
  private subClient?: Redis;

  constructor(
    private readonly rooms: RoomsService,
    private readonly auth: AuthService,
    private readonly redis: RedisService,
  ) {}

  afterInit(server: Server) {
    // Dedicated pub/sub connections: a subscribed ioredis client can't run
    // normal commands, so the shared client must not be used here.
    const pub = this.redis.connection.duplicate({ lazyConnect: false });
    const sub = this.redis.connection.duplicate({ lazyConnect: false });

    for (const client of [pub, sub]) {
      client.on('error', (error: Error) => {
        this.logger.error(`Socket.io Redis adapter error: ${error.message}`);
      });
    }

    server.adapter(createAdapter(pub, sub));
    this.pubClient = pub;
    this.subClient = sub;
  }

  async handleDisconnect(socket: Socket) {
    await this.removePlayer(socket).catch((error: unknown) => {
      this.logger.warn(
        `Failed to remove player on disconnect: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    });
  }

  onApplicationShutdown() {
    this.pubClient?.disconnect();
    this.subClient?.disconnect();
  }

  @SubscribeMessage('room:join')
  async joinRoom(
    @MessageBody() payload: unknown,
    @ConnectedSocket() socket: Socket,
    @Ack() ack: AckFn<RoomResult>,
  ) {
    const parsed = joinRoomSchema.safeParse(payload);
    if (!parsed.success) {
      ack(this.failure('invalid-payload', 'ข้อมูลไม่ถูกต้อง'));
      return;
    }

    const { code, nickname } = parsed.data;
    try {
      const { player, state } = await this.rooms.addPlayer(
        code,
        nickname,
        socket.id,
      );

      socket.data = { role: 'player', code, playerId: player.id };
      await socket.join(roomChannel(code));

      ack({ ok: true, playerId: player.id, room: state });
      this.broadcastState(state);
    } catch (error) {
      ack(this.describeError(error));
    }
  }

  @SubscribeMessage('room:rejoin')
  async rejoinRoom(
    @MessageBody() payload: unknown,
    @ConnectedSocket() socket: Socket,
    @Ack() ack: AckFn<RoomResult>,
  ) {
    const parsed = rejoinRoomSchema.safeParse(payload);
    if (!parsed.success) {
      ack(this.failure('invalid-payload', 'ข้อมูลไม่ถูกต้อง'));
      return;
    }

    const { code, playerId } = parsed.data;
    try {
      const player = await this.rooms.claimPlayer(code, playerId, socket.id);
      if (!player) {
        ack(this.failure('player-not-found', 'ไม่พบผู้เล่นในห้องนี้'));
        return;
      }

      const state = await this.rooms.getState(code);
      socket.data = { role: 'player', code, playerId };
      await socket.join(roomChannel(code));

      ack({ ok: true, playerId, room: state });
    } catch (error) {
      ack(this.describeError(error));
    }
  }

  @SubscribeMessage('room:leave')
  async leaveRoom(
    @ConnectedSocket() socket: Socket,
    @Ack() ack: AckFn<CloseRoomResult>,
  ) {
    await this.removePlayer(socket);
    ack({ ok: true });
  }

  @SubscribeMessage('host:join')
  async joinAsHost(
    @MessageBody() payload: unknown,
    @ConnectedSocket() socket: Socket,
    @Ack() ack: AckFn<HostRoomResult>,
  ) {
    const user = await this.authenticate(socket);
    if (!user) {
      ack(this.failure('unauthenticated', 'ต้องเข้าสู่ระบบก่อน'));
      return;
    }

    const parsed = hostRoomSchema.safeParse(payload);
    if (!parsed.success) {
      ack(this.failure('invalid-payload', 'ข้อมูลไม่ถูกต้อง'));
      return;
    }

    const { code } = parsed.data;
    try {
      const record = await this.rooms.getRecord(code);
      if (!record || record.hostId !== user.id) {
        ack(this.failure('room-not-found', 'ไม่พบห้องนี้'));
        return;
      }

      socket.data = { role: 'host', code };
      await socket.join(roomChannel(code));

      ack({ ok: true, room: await this.rooms.getState(code) });
    } catch (error) {
      ack(this.describeError(error));
    }
  }

  @SubscribeMessage('host:close')
  async closeRoom(
    @MessageBody() payload: unknown,
    @ConnectedSocket() socket: Socket,
    @Ack() ack: AckFn<CloseRoomResult>,
  ) {
    const user = await this.authenticate(socket);
    if (!user) {
      ack(this.failure('unauthenticated', 'ต้องเข้าสู่ระบบก่อน'));
      return;
    }

    const parsed = hostRoomSchema.safeParse(payload);
    if (!parsed.success) {
      ack(this.failure('invalid-payload', 'ข้อมูลไม่ถูกต้อง'));
      return;
    }

    const { code } = parsed.data;
    const closed = await this.rooms.close(code, user.id);
    if (!closed) {
      ack(this.failure('room-not-found', 'ไม่พบห้องนี้'));
      return;
    }

    this.server.to(roomChannel(code)).emit('room:closed', { code });
    this.server.in(roomChannel(code)).socketsLeave(roomChannel(code));
    ack({ ok: true });
  }

  private broadcastState(state: RoomState): void {
    this.server.to(roomChannel(state.code)).emit('room:state', state);
  }

  private async removePlayer(socket: Socket): Promise<void> {
    const session = socket.data as SocketSession;
    if (session.role !== 'player' || !session.code || !session.playerId) {
      return;
    }

    const { code, playerId } = session;
    socket.data = {};

    const state = await this.rooms.removePlayer(code, playerId, socket.id);
    await socket.leave(roomChannel(code));

    if (state) {
      this.broadcastState(state);
    }
  }

  private async authenticate(socket: Socket): Promise<PublicUser | null> {
    const cookieToken = readCookie(
      socket.handshake.headers.cookie,
      ACCESS_TOKEN_COOKIE,
    );
    const handshakeToken = socket.handshake.auth?.token;
    const token =
      cookieToken ??
      (typeof handshakeToken === 'string' ? handshakeToken : undefined);

    return token ? this.auth.verifyToken(token) : null;
  }

  private failure(code: RoomErrorCode, error: string): RoomFailure {
    return { ok: false, code, error };
  }

  private describeError(error: unknown): RoomFailure {
    const message = error instanceof Error ? error.message : '';

    if (message === 'Room not found') {
      return this.failure('room-not-found', 'ไม่พบห้องนี้');
    }
    if (message === 'Room is not accepting players') {
      return this.failure('not-accepting-players', 'เกมเริ่มแล้ว');
    }
    if (message === 'Room is full') {
      return this.failure('room-full', 'ห้องเต็มแล้ว');
    }

    return this.failure('unknown', 'เกิดข้อผิดพลาด กรุณาลองใหม่');
  }
}
