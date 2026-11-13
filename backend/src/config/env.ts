import { z } from 'zod';

/**
 * Runtime environment schema. The app refuses to boot when a required
 * variable is missing or malformed, instead of failing on the first request.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  // Comma-separated list, e.g. "http://localhost:3001,https://app.example.com"
  CORS_ORIGINS: z.string().min(1).default('http://localhost:3001'),
  JWT_SECRET: z
    .string()
    .min(32, { message: 'JWT_SECRET must be at least 32 characters' }),
});

export type Env = z.infer<typeof envSchema>;
