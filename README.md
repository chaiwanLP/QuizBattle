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
├── backend/      # NestJS API + WebSocket gateway (port 3000)
└── frontend/     # Next.js app (port 3001)
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

Then run:

```bash
npx prisma migrate dev
npm run start:dev
```

The API runs at `http://localhost:3000`.

### 4. Set up the frontend

Open a new terminal:

```bash
cd frontend
npm install
```

Create `.env.local` (copy from `.env.example`), then:

```bash
npm run dev -- -p 3001
```

The app runs at `http://localhost:3001`.

## Environment Variables

**backend/.env**

```env
DATABASE_URL=postgresql://quiz:quiz_password@localhost:5432/quiz_db
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=change-me
PORT=3000
```

**frontend/.env.local**

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

> Never commit `.env` files. Commit only `.env.example`.

## Roadmap

- [x] Project setup (Docker Compose, NestJS, Next.js)
- [ ] **Phase 1:** Auth for hosts, Quiz and Question CRUD
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