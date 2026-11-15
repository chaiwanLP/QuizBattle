/** Rooms live only in Redis; PostgreSQL stores quizzes and final results. */
export const ROOM_CODE_LENGTH = 6;

/** Idle rooms expire after two hours unless something happens in them. */
export const ROOM_TTL_SECONDS = 2 * 60 * 60;

export const MAX_PLAYERS_PER_ROOM = 200;

export const MAX_NICKNAME_LENGTH = 20;
