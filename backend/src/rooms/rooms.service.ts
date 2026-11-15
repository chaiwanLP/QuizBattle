import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PublicUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  MAX_PLAYERS_PER_ROOM,
  ROOM_TTL_SECONDS,
} from './rooms.constants';
import type {
  RoomPlayer,
  RoomRecord,
  RoomState,
  StoredPlayer,
} from './rooms.types';
import { createRoomCode, normalizeNickname } from './rooms.utils';

const CODE_ATTEMPTS = 20;

function roomKey(code: string): string {
  return `room:${code}`;
}

function playersKey(code: string): string {
  return `room:${code}:players`;
}

/** Drops the internal socket id before a player leaves the server. */
function toPublicPlayer(player: StoredPlayer): RoomPlayer {
  return {
    id: player.id,
    nickname: player.nickname,
    joinedAt: player.joinedAt,
  };
}

function parseStoredPlayer(value: string): StoredPlayer | null {
  try {
    const parsed = JSON.parse(value) as Partial<StoredPlayer>;
    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.nickname !== 'string' ||
      typeof parsed.joinedAt !== 'string'
    ) {
      return null;
    }

    return {
      id: parsed.id,
      nickname: parsed.nickname,
      joinedAt: parsed.joinedAt,
      socketId: typeof parsed.socketId === 'string' ? parsed.socketId : undefined,
    };
  } catch {
    return null;
  }
}

function toRoomState(record: RoomRecord, players: RoomPlayer[]): RoomState {
  return {
    code: record.code,
    status: record.status,
    quizId: record.quizId,
    quizTitle: record.quizTitle,
    questionCount: record.questionCount,
    hostName: record.hostName,
    createdAt: record.createdAt,
    players,
  };
}

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(host: PublicUser, quizId: string): Promise<RoomState> {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id: quizId, ownerId: host.id },
      select: {
        id: true,
        title: true,
        _count: { select: { questions: true } },
      },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }
    if (quiz._count.questions === 0) {
      throw new BadRequestException('Quiz has no questions');
    }

    const client = this.redis.connection;

    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const code = createRoomCode();
      // HSETNX is atomic, so two hosts can never receive the same code even
      // when they generate it at the same moment.
      const reserved = await client.hsetnx(roomKey(code), 'code', code);
      if (reserved !== 1) continue;

      const record: RoomRecord = {
        code,
        status: 'lobby',
        quizId: quiz.id,
        quizTitle: quiz.title,
        questionCount: quiz._count.questions,
        hostId: host.id,
        hostName: host.displayName,
        createdAt: new Date().toISOString(),
      };

      await client.hset(roomKey(code), {
        status: record.status,
        quizId: record.quizId,
        quizTitle: record.quizTitle,
        questionCount: String(record.questionCount),
        hostId: record.hostId,
        hostName: record.hostName,
        createdAt: record.createdAt,
      });
      await this.refreshTtl(code);

      return toRoomState(record, []);
    }

    throw new ServiceUnavailableException('Could not allocate a room code');
  }

  async getRecord(code: string): Promise<RoomRecord | null> {
    const data = await this.redis.connection.hgetall(roomKey(code));
    if (!data || !data.code) return null;

    return {
      code: data.code,
      status: data.status as RoomRecord['status'],
      quizId: data.quizId,
      quizTitle: data.quizTitle,
      questionCount: Number(data.questionCount),
      hostId: data.hostId,
      hostName: data.hostName,
      createdAt: data.createdAt,
    };
  }

  async getState(code: string): Promise<RoomState> {
    const record = await this.requireRecord(code);
    return toRoomState(record, await this.listPlayers(code));
  }

  async listPlayers(code: string): Promise<RoomPlayer[]> {
    const values = await this.redis.connection.hvals(playersKey(code));

    return values
      .map((value) => parseStoredPlayer(value))
      .filter((player): player is StoredPlayer => player !== null)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
      .map(toPublicPlayer);
  }

  async addPlayer(
    code: string,
    nickname: string,
    socketId: string,
  ): Promise<{ player: RoomPlayer; state: RoomState }> {
    const record = await this.requireRecord(code);

    if (record.status !== 'lobby') {
      throw new BadRequestException('Room is not accepting players');
    }

    const playerCount = await this.redis.connection.hlen(playersKey(code));
    if (playerCount >= MAX_PLAYERS_PER_ROOM) {
      throw new BadRequestException('Room is full');
    }

    const player: StoredPlayer = {
      id: randomUUID(),
      nickname: normalizeNickname(nickname),
      joinedAt: new Date().toISOString(),
      socketId,
    };

    await this.redis.connection.hset(
      playersKey(code),
      player.id,
      JSON.stringify(player),
    );
    await this.refreshTtl(code);

    return {
      player: toPublicPlayer(player),
      state: toRoomState(record, await this.listPlayers(code)),
    };
  }

  /**
   * Re-attaches an existing seat to a new socket. Returns null when the seat
   * is gone (the room was closed, expired, or the player left).
   */
  async claimPlayer(
    code: string,
    playerId: string,
    socketId: string,
  ): Promise<RoomPlayer | null> {
    const record = await this.getRecord(code);
    if (!record) return null;

    const value = await this.redis.connection.hget(
      playersKey(code),
      playerId,
    );
    if (!value) return null;

    const stored = parseStoredPlayer(value);
    if (!stored) return null;

    stored.socketId = socketId;
    await this.redis.connection.hset(
      playersKey(code),
      playerId,
      JSON.stringify(stored),
    );
    await this.refreshTtl(code);

    return toPublicPlayer(stored);
  }

  /**
   * Removes a seat, but only while it still belongs to `socketId`. Without
   * that check, a stale disconnect would delete a seat that was just reclaimed
   * after a reload. Returns null when nothing changed.
   */
  async removePlayer(
    code: string,
    playerId: string,
    socketId: string,
  ): Promise<RoomState | null> {
    const record = await this.getRecord(code);
    if (!record) return null;

    const value = await this.redis.connection.hget(playersKey(code), playerId);
    if (!value) return null;

    const stored = parseStoredPlayer(value);
    if (!stored || (stored.socketId && stored.socketId !== socketId)) {
      return null;
    }

    await this.redis.connection.hdel(playersKey(code), playerId);
    await this.refreshTtl(code);

    return toRoomState(record, await this.listPlayers(code));
  }

  async close(code: string, hostId: string): Promise<boolean> {
    const record = await this.getRecord(code);
    if (!record || record.hostId !== hostId) return false;

    await this.redis.connection.del(roomKey(code), playersKey(code));
    return true;
  }

  private async requireRecord(code: string): Promise<RoomRecord> {
    const record = await this.getRecord(code);
    if (!record) {
      throw new NotFoundException('Room not found');
    }
    return record;
  }

  private async refreshTtl(code: string): Promise<void> {
    await this.redis.connection
      .multi()
      .expire(roomKey(code), ROOM_TTL_SECONDS)
      .expire(playersKey(code), ROOM_TTL_SECONDS)
      .exec();
  }
}
