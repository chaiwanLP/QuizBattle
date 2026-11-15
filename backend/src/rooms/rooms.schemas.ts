import { z } from 'zod';
import { MAX_NICKNAME_LENGTH, ROOM_CODE_LENGTH } from './rooms.constants';

export const roomCodeSchema = z
  .string()
  .regex(
    new RegExp(`^\\d{${ROOM_CODE_LENGTH}}$`),
    `Room code must be ${ROOM_CODE_LENGTH} digits`,
  );

export const createRoomSchema = z.object({
  quizId: z.uuid(),
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const joinRoomSchema = z.object({
  code: roomCodeSchema,
  nickname: z
    .string()
    .trim()
    .min(1, { message: 'Nickname is required' })
    .max(MAX_NICKNAME_LENGTH),
});
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;

export const rejoinRoomSchema = z.object({
  code: roomCodeSchema,
  playerId: z.uuid(),
});
export type RejoinRoomInput = z.infer<typeof rejoinRoomSchema>;

export const hostRoomSchema = z.object({
  code: roomCodeSchema,
});
export type HostRoomInput = z.infer<typeof hostRoomSchema>;
