# QuizBattle

Real-time multiplayer quiz game built with **Next.js**, **NestJS**, **PostgreSQL** and **Redis**.

A host creates a room, players join with a 6-digit code, and everyone answers questions at the same time. The faster you answer correctly, the more points you get, and the live leaderboard updates after every question.

> 🚧 **Status:** In development

## Features

- Host creates quizzes with multiple-choice questions
- Players join a room with a code (no sign-up required)
- Live lobby showing who has joined
- Timed questions, with the timer controlled by the server
- Speed-based scoring
- Real-time leaderboard
- Final results saved to PostgreSQL and viewable as game history
- Reconnect support if a player drops out

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, socket.io-client |
| Backend | NestJS, TypeScript, WebSocket Gateway (socket.io) |
| Database | PostgreSQL with Prisma |
| Cache / Realtime | Redis (ioredis) |
| Infrastructure | Docker Compose |

## How Redis Is Used

| Use case | Redis feature |
|---|---|
| Live room state | Hash + TTL |
| Players in a room | Set / Hash |
| Live scores and ranking | Sorted Set (`ZINCRBY`, `ZREVRANGE`) |
| Prevent answering twice | Set (`SADD`) |
| Broadcast across servers | Pub/Sub (`@socket.io/redis-adapter`) |

PostgreSQL stores permanent data (users, quizzes, questions, final results). Redis stores short-lived game state that can be discarded once the game ends.

## Architecture

```
Player (Next.js) ──WebSocket──► NestJS Gateway
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
        Validate answer       ZINCRBY score        Pub/Sub broadcast
        (check correct)         (Redis)            "leaderboard updated"
                                                         │
                     ◄────────────WebSocket──────────────┘
                  Everyone sees the new ranking at once
```

## Scoring

```
score = 1000 × (1 − timeTaken / timeLimit / 2)   if correct
score = 0                                         if wrong
```

Answering instantly gives about 1000 points, answering at the last second gives about 500.

## Project Structure

```
QuizBattle/
├── docker-compose.yml
├── backend/
│   ├── prisma/           # Schema + migrations
│   └── src/
│       ├── config/       # Env schema (Zod) validated at boot
│       ├── auth/         # Host register/login, JWT cookie guard
│       ├── users/        # User lookups + email normalization
│       ├── quizzes/      # Quiz/question/option CRUD
│       ├── health/       # GET /health (Postgres + Redis)
│       ├── prisma/       # PrismaService (driver adapter)
│       ├── redis/        # RedisService (shared ioredis client)
│       └── generated/    # Prisma Client (generated, not committed)
└── frontend/             # Next.js app (port 3001)
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop) (on Windows, requires WSL 2)
- [Git](https://git-scm.com)

### 1. Clone the repository

```bash
git clone https://github.com/chaiwanLP/QuizBattle.git
cd QuizBattle
```

### 2. Start PostgreSQL and Redis

Make sure Docker Desktop is running, then:

```bash
docker compose up -d
docker compose ps
```

### 3. Set up the backend

```bash
cd backend
npm install
```

Create a `.env` file (copy from `.env.example`):

```bash
# macOS / Linux
cp .env.example .env

# Windows (cmd)
copy .env.example .env
```

Generate Prisma Client, apply the migrations, then start the server:

```bash
npm run db:generate    # prisma generate
npm run db:migrate     # prisma migrate dev
npm run start:dev
```

The API runs at `http://localhost:3000`. Check that Postgres and Redis are
reachable with `GET http://localhost:3000/health`:

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

Other Prisma helpers:

| Command | What it does |
|---|---|
| `npm run db:generate` | Regenerate the client after editing `prisma/schema.prisma` |
| `npm run db:migrate` | Create and apply a migration in development |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:studio` | Open Prisma Studio |

> `src/generated/prisma` is generated code and is **not** committed. Run
> `npm run db:generate` after a fresh clone.

### 4. Set up the frontend

Open a new terminal:

```bash
cd frontend
npm install
```

Create `.env.local` (copy from `.env.example`), then:

```bash
npm run dev
```

The app runs at `http://localhost:3001` (the port is pinned in
`frontend/package.json`).

### 5. Use it

1. Open `http://localhost:3001` and register as a host.
2. Create a quiz from the dashboard. A new quiz starts with one placeholder
   question that you can edit.
3. Edit the title, questions, options and per-question time limit, then save.
4. The session is kept in an `httpOnly` cookie, so the browser stays signed in
   for 7 days.

## API

Auth uses a JWT stored in the `qb_session` **httpOnly cookie**. Clients that
can't keep cookies (scripts, future mobile apps) may instead send
`Authorization: Bearer <token>`; the login/register responses set the cookie but
the token itself is not exposed in the JSON body.

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | Create a host account and start a session |
| `POST` | `/auth/login` | Validate credentials and start a session |
| `POST` | `/auth/logout` | Clear the session cookie |
| `GET` | `/auth/me` | Current host (requires a session) |

### Quizzes (all require a session)

| Method | Path | Description |
|---|---|---|
| `GET` | `/quizzes` | List the current host's quizzes |
| `POST` | `/quizzes` | Create a quiz with questions and options |
| `GET` | `/quizzes/:id` | Quiz detail with ordered questions/options |
| `PATCH` | `/quizzes/:id` | Update title and/or description |
| `PUT` | `/quizzes/:id/questions` | Replace the whole question set (transactional) |
| `DELETE` | `/quizzes/:id` | Delete a quiz and its questions |

Validation rules: 1–100 questions, each with 2–6 options and exactly one correct
option; `timeLimitSec` is 5–300 seconds (default 20). A quiz that belongs to a
different host returns `404` so its existence isn't leaked.

CSRF protection is enabled in Nest and trusts the origins listed in
`CORS_ORIGINS`; state-changing requests from any other origin are rejected.

## Environment Variables

**backend/.env**

```env
DATABASE_URL=postgresql://quiz:quiz_password@localhost:5432/quiz_db
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=http://localhost:3001
JWT_SECRET=dev-secret-change-me-0123456789abcdef
PORT=3000
```

`CORS_ORIGINS` is a comma-separated list, so the deployed frontend origin can be
added without code changes. `JWT_SECRET` must be at least 32 characters; use a
random value in production (`openssl rand -base64 48`). Missing or invalid
variables stop the app at boot with a readable error (see
`backend/src/config/env.ts`).

**frontend/.env.local**

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

> Never commit `.env` files. Commit only `.env.example`.

## Roadmap

- [x] Project setup (Docker Compose, NestJS, Next.js)
- [x] Infrastructure foundation: env validation, Prisma + migrations, Redis client, health checks
- [x] **Phase 1:** Auth for hosts, Quiz and Question CRUD
- [ ] **Phase 2:** Create room, join room, live lobby
- [ ] **Phase 3:** Gameplay, timer, scoring, live leaderboard
- [ ] **Phase 4:** Save results to PostgreSQL, game history, reconnect
- [ ] Polish: animations, sounds, themes
- [ ] Deploy

### Ideas for later

- Answer streak bonus
- Team mode
- Public quizzes that other users can play
- Load test with simulated players

## Git Workflow

- `main` is always in a working state
- Each feature is developed on its own branch (`feat/...`, `fix/...`) and merged through a Pull Request
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`


MIT