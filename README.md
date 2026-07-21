# Vibe Studio

A Cursor-like AI vibe coding assistant. Chat with state-of-the-art AI models, manage system prompts, and build custom skill libraries that inject context into every conversation.

## Requirements

- Node.js 20+
- PostgreSQL database
- OpenRouter API key (free tier available at https://openrouter.ai)

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```
DATABASE_URL=postgresql://user:password@localhost:5432/vibe_studio
OPENROUTER_API_KEY=sk-or-...
PORT=3000
```

### 3. Set up the database

**Option A — Drizzle push (recommended):**
```bash
npm run db:push
```

**Option B — Raw SQL:**
```bash
psql $DATABASE_URL < schema.sql
```

### 4. Start the server

```bash
npm start
```

Open http://localhost:3000 in your browser.

---

## Deploying to other platforms

### Railway / Render / Fly.io

1. Create a PostgreSQL database on the platform
2. Set environment variables: `DATABASE_URL`, `OPENROUTER_API_KEY`, `PORT`
3. Set the start command to: `npm start`
4. Run `npm run db:push` as a build/release command or one-time task

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Heroku

```bash
heroku addons:create heroku-postgresql
heroku config:set OPENROUTER_API_KEY=sk-or-...
git push heroku main
heroku run npm run db:push
```

---

## Features

- **Real-time AI chat** — streams responses token by token via Server-Sent Events
- **Model selector** — choose from all OpenRouter models (free and paid)
- **System prompts** — create reusable persona/instruction sets per conversation
- **Skills** — custom instruction blocks auto-injected into every AI context
- **Conversation history** — all chats stored in PostgreSQL
