# Media Library API

A RESTful backend for a content team to upload, organize, search, and manage media files (images and PDFs). Each user owns their own media — only the uploader can edit or delete their files.

Built with TypeScript, Express 5, MongoDB (Mongoose), JWT auth, and Multer for file uploads.

> For the full architectural design, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
> For a plain-English explanation of the project tooling (TypeScript, ESLint, Prettier, Husky), see [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md).

---

## Features

- **Authentication** — JWT-based register / login. Tokens carry the user identity.
- **Ownership model** — every media item belongs to one user. Only the owner can update or delete.
- **File uploads** — accepts `image/jpeg`, `image/png`, and `application/pdf` via `multipart/form-data`. Max 5 MB per file.
- **Metadata** — every upload stores a title, optional tags, a category, plus the file path, original filename, MIME type, and size.
- **Search, filter, paginate** — list endpoint supports full-text search on title, tag filtering, category filtering, pagination, and sorting in one call.
- **Consistent response envelope** — every success and error response follows the same JSON shape.
- **Centralized error handling** — single global error middleware turns thrown errors into properly-formatted responses.
- **Structured logging** — Pino logs in JSON for production, pretty-printed in development.
- **Fail-fast configuration** — missing or malformed env vars crash the app at boot with a clear message.

---

## Tech stack

| Area | Tool |
|---|---|
| Language | TypeScript |
| Runtime | Node.js 20 LTS |
| Framework | Express 5 |
| Database | MongoDB |
| ODM | Mongoose |
| Validation | Zod |
| File uploads | Multer |
| Auth | bcrypt + jsonwebtoken |
| Logging | Pino + pino-pretty |
| Env loading | dotenv |
| Dev runner | tsx |
| Linting | ESLint (flat config) |
| Formatting | Prettier |
| Git hooks | Husky + lint-staged |

---

## Requirements

- Node.js **20 LTS** or newer
- **Yarn** (the project uses `yarn.lock`)
- A MongoDB instance — local install **or** MongoDB Atlas connection string

---

## Setup

```bash
# 1. Install dependencies
yarn install

# 2. Create your local env file from the template
cp .env.example .env

# 3. Edit .env and fill in real values (especially MONGO_URI and JWT_SECRET)

# 4. Start the dev server
yarn dev
```

The server starts on `http://localhost:3000` (or whatever `PORT` you set).

---

## Scripts

| Command | What it does |
|---|---|
| `yarn dev` | Start the dev server with auto-reload (tsx watch). |
| `yarn build` | Compile TypeScript to `dist/`. |
| `yarn start` | Run the compiled app from `dist/server.js`. |
| `yarn lint` | Check code for lint errors. |
| `yarn format` | Auto-format all files with Prettier. |
| `yarn format:check` | Check formatting without changing files. |
| `yarn typecheck` | Type-check without compiling (uses `tsconfig.dev.json`). |

---

## Environment variables

All vars are loaded from `.env` at boot and validated by Zod. The app refuses to start if any required var is missing or malformed.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | no | `development` | One of `development` \| `production` \| `test`. |
| `PORT` | no | `3000` | Port the HTTP server listens on. |
| `MONGO_URI` | **yes** | — | MongoDB connection string (local or Atlas). |
| `JWT_SECRET` | **yes** | — | Secret for signing JWTs. Minimum 16 characters. Use a long random string in production. |
| `JWT_EXPIRES_IN` | no | `7d` | Token lifetime (e.g. `1h`, `7d`, `30d`). |
| `LOG_LEVEL` | no | `info` | Pino log level: `debug` \| `info` \| `warn` \| `error` \| `fatal`. |

See [`.env.example`](.env.example) for a copy-paste template.

---

## Project structure

```
media-library-api/
├── docs/                       Architectural and setup documentation
├── uploads/                    Local storage for uploaded files (git-ignored)
├── src/
│   ├── config/                 env loading, logger, db connection
│   ├── routes/                 URL → controller wiring (no logic)
│   ├── controllers/            Request/response handling (delegates to services)
│   ├── services/               Business rules and orchestration
│   ├── repositories/           Database queries
│   ├── models/                 Mongoose schemas and TypeScript types
│   ├── middlewares/            validate, authenticate, upload, errorHandler
│   ├── utils/                  AppError, catchAsync, sendSuccess
│   ├── app.ts                  Express app construction (no listening)
│   └── server.ts               Entrypoint: connect DB, start listening, process handlers
├── .editorconfig
├── .env.example
├── .gitignore
├── .prettierrc
├── .prettierignore
├── eslint.config.js
├── package.json
├── tsconfig.json
└── tsconfig.dev.json
```

**Layer rule:** routes → controllers → services → repositories. Never skip a layer, never go backwards. Controllers never touch the database directly.

---

## Response format

Every response follows one of these two shapes.

### Success

```json
{ "status": "success", "data": { ... } }
```

### Error

```json
{ "status": "error", "message": "Human-readable summary", "details": [ ... ] }
```

The `details` array is included for validation errors:

```json
{
  "status": "error",
  "message": "Validation failed",
  "details": [
    { "field": "title", "message": "title is required" }
  ]
}
```

### Paginated list responses

```json
{
  "status": "success",
  "data": {
    "results": [ ... ],
    "pagination": { "total": 84, "page": 2, "limit": 10, "totalPages": 9 }
  }
}
```

---

## API endpoints

All `/media` endpoints require a valid JWT in the `Authorization: Bearer <token>` header.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Create an account; returns a JWT. |
| `POST` | `/auth/login` | Authenticate with email + password; returns a JWT. |
| `GET` | `/auth/me` | Return the currently authenticated user. |

### Media

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/media` | Upload one file with metadata (multipart form, `file` field + `title`, `tags`, `category`). |
| `GET` | `/media` | List your media with filters, search, and pagination. |
| `GET` | `/media/:id` | Get a single media item (owner only). |
| `PUT` | `/media/:id` | Update metadata (owner only). |
| `DELETE` | `/media/:id` | Delete the media item and its file from disk (owner only). |

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe — returns `{ status: "ok" }`. No auth required. |

### `GET /media` query parameters

| Param | Description | Default |
|---|---|---|
| `page` | Page number | `1` |
| `limit` | Results per page (max 50) | `10` |
| `category` | Filter by category (e.g. `image`, `document`) | — |
| `tags` | Filter by tags (comma-separated) | — |
| `search` | Full-text search on title | — |
| `sortBy` | Field to sort by (e.g. `createdAt`, `title`) | `createdAt` |
| `order` | Sort direction: `asc` or `desc` | `desc` |

### Upload constraints

- **Accepted MIME types:** `image/jpeg`, `image/png`, `application/pdf`
- **Maximum file size:** 5 MB
- **Allowed categories:** `image`, `document`

Unsupported file types or oversized files return `400` with a descriptive error message.

---

## Development workflow

- **Pre-commit hook** — On every commit, Husky runs `lint-staged`, which runs Prettier and ESLint on the files you staged. Commits with lint errors are blocked.
- **Type-only checks** — `yarn typecheck` runs the compiler in no-emit mode to surface type errors without producing output. Faster than a full build.
- **Logging** — Use the shared `logger` from `src/config/logger.ts`. Do **not** use `console.log` in committed code.
- **Errors** — Throw `new AppError(message, statusCode)` for expected failures. The global error middleware turns them into the standard error envelope. Don't construct error responses by hand.

---

## License

MIT
