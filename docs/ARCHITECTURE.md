# Media Library API — Architecture

This document is the single source of truth for how the project is built. Every decision below has a short reason attached. If we change our minds later, we update this file first, then the code.

---

## 1. The big picture

We are building a REST API that lets a content team upload images and PDFs, attach metadata to them (title, tags, category), and later search, filter, and paginate through everything they have uploaded. Users must log in. A user can only edit or delete media they uploaded themselves.

The API is the only thing we are building. No frontend, no automated tests. We will test endpoints by hand using Postman or Thunder Client.

---

## 2. Technology choices

Each line is a decision and the reason behind it.

| Area | Choice | Why this and not something else |
|---|---|---|
| Language | **TypeScript** | Catches bugs before the code runs. Pairs perfectly with Zod (one schema gives us both validation and types). |
| Runtime | **Node.js 20 LTS** | Current long-term support release. Stable native ESM, built-in `fetch`, supported until April 2026. Node 18 is already past end-of-life. |
| Module system | **ESM** (`"type": "module"` in `package.json`) | Modern standard. The one quirk: in our `.ts` source files, relative imports must end in `.js` (e.g. `import { foo } from "./foo.js"`), because that is what the compiled output will use. Annoying once, then invisible. |
| Web framework | **Express 5** | Mature, well-documented, exactly what the spec asks for. Express 5 finally handles async errors natively, so our `catchAsync` wrapper stays simple. |
| Database | **MongoDB** | Tags are an array — Mongo stores arrays natively, SQL would need a join table. Metadata shape may grow per category, schemaless wins. Built-in text index handles the title search requirement with zero extra infrastructure. |
| ODM | **Mongoose** | The standard for Mongo + TypeScript. Gives us schemas, validation, hooks, and typed models. Prisma's Mongo support is too limited (no `$text` search, no transactions in the way we want). |
| Validation | **Zod** | One schema produces both runtime checks and TypeScript types via `z.infer<>`. Joi predates good TS support and would force us to duplicate every shape. |
| File uploads | **Multer** | The spec asks for it. Industry default for `multipart/form-data` in Express. |
| Auth — passwords | **bcrypt** | Battle-tested password hashing. Slow on purpose (that is the point). |
| Auth — tokens | **jsonwebtoken** | Stateless JWTs. No session store needed. |
| Logging | **Pino** | Fastest Node logger, outputs structured JSON, plays well with log aggregators if we ever deploy. `pino-pretty` makes it human-readable in development. |
| Env loading | **dotenv** + **Zod** | `dotenv` loads `.env`, Zod validates it on boot. If `MONGO_URI` is missing, the app fails immediately with a clear message instead of crashing later. |
| Dev server | **tsx** | Runs TypeScript directly with watch mode. Simpler than `ts-node-dev` or `nodemon + ts-node`. One dependency, no config. |
| Linting | **ESLint** with `typescript-eslint` | Standard. Catches real bugs (unused vars, missing awaits) on top of style. |
| Formatting | **Prettier** | Stops every arguments about style. Runs on save and on commit. |
| Git hooks | **Husky** + **lint-staged** | On every commit, lint and format only the files that changed. Keeps the main branch clean without slowing commits down. |
| Editor config | **`.editorconfig`** | Makes indentation and line endings consistent across editors. One file, no setup. |

---

## 3. Folder structure

```
media-library-api/
├── docs/
│   └── ARCHITECTURE.md          ← this file
├── uploads/                     ← files Multer writes to disk (git-ignored)
├── src/
│   ├── config/                  ← env loading, db connection, constants
│   ├── routes/                  ← URL → controller wiring, nothing else
│   ├── controllers/             ← read the request, call a service, send a response
│   ├── services/                ← business rules (e.g. "only the owner can delete")
│   ├── repositories/            ← every database call lives here
│   ├── models/                  ← Mongoose schemas and TypeScript types
│   ├── middlewares/             ← validate, authenticate, upload, error handler
│   ├── utils/                   ← AppError, catchAsync, response helpers, logger
│   ├── app.ts                   ← builds the Express app (no listening)
│   └── server.ts                ← connects to Mongo, then starts listening
├── .editorconfig
├── .env.example                 ← committed; real .env is git-ignored
├── .eslintrc.cjs
├── .gitignore
├── .prettierrc
├── package.json
├── tsconfig.json
└── README.md
```

### What each folder is responsible for

- **routes/** — Define the URL path and the HTTP method. Attach middlewares (validate, authenticate, upload). Hand off to a controller. **No logic.** If a route file has an `if` statement, something is wrong.
- **controllers/** — Pull values from `req` (body, params, query, the authenticated user). Call one service method. Send a response using our standard envelope. Controllers never touch the database directly.
- **services/** — All business rules live here. "Is this user the owner?" "Should we delete the file from disk before the DB record?" Services are the only layer allowed to call multiple repository methods or coordinate side effects.
- **repositories/** — Every Mongoose call (`Media.find`, `User.create`, etc.) lives here and nowhere else. This is what makes the database swappable in theory and testable in practice.
- **models/** — Mongoose schemas plus the TypeScript types derived from them.
- **middlewares/** — Reusable functions that sit in front of controllers: `validate(schema)`, `authenticate`, `upload.single("file")`, and the global error handler.
- **utils/** — Small helpers that don't fit a layer: `AppError`, `catchAsync`, response builders, the logger instance.
- **config/** — Reads `.env` through Zod, exports a typed `env` object. Also owns the Mongo connection function.

The rule of thumb: **routes call controllers, controllers call services, services call repositories**. Never skip a layer, never go backwards.

---

## 4. Response format

Every response — success or error — follows the same shape. The frontend never has to guess.

**Success**
```json
{ "status": "success", "data": { ... } }
```

**Error**
```json
{ "status": "error", "message": "Human-readable summary", "details": [ ... ] }
```

`details` is optional. We use it for validation errors so the client knows which field failed:

```json
{
  "status": "error",
  "message": "Validation failed",
  "details": [
    { "field": "title", "message": "title is required" },
    { "field": "category", "message": "category must be one of image, document" }
  ]
}
```

A list endpoint adds pagination metadata inside `data`:

```json
{
  "status": "success",
  "data": {
    "results": [ ... ],
    "pagination": { "total": 84, "page": 2, "limit": 10, "totalPages": 9 }
  }
}
```

We will write two tiny helpers in `utils/response.ts` — `sendSuccess(res, data)` and the error path goes through the global error handler. Controllers never build the envelope by hand.

---

## 5. Error handling

### The `AppError` class
A small class that extends `Error` and adds two fields: an HTTP `statusCode` and an `isOperational` flag (always `true` for errors we throw on purpose). Anywhere in the code, we can do:

```ts
throw new AppError("Media not found", 404);
```

…and trust that the right status code and message will reach the client.

### The global error middleware
Registered last in `app.ts`. It receives every error, whether from `AppError`, from Mongoose (e.g. cast errors), or from anywhere else. It does three things:

1. Logs the error (full stack in development, just the message in production).
2. Decides the status code: from `AppError` if present, otherwise 500.
3. Sends the standard error envelope back.

We never leak stack traces to clients in production.

### Process-level safety nets
In `server.ts` we listen for:

- `unhandledRejection` — a Promise rejected and nobody caught it. Log it and exit.
- `uncaughtException` — something synchronous threw and nobody caught it. Log it and exit.

Exiting on these is intentional: the process is in an unknown state. A process manager (or `tsx watch` in dev) will restart it.

### `catchAsync`
A one-line wrapper so controllers don't need `try/catch`:

```ts
export const catchAsync = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
```

Used like:

```ts
router.get("/", catchAsync(mediaController.getAll));
```

Any thrown error or rejected Promise inside the controller jumps straight to the global error handler.

---

## 6. Validation

Every endpoint with input has a Zod schema in `src/middlewares/validators/`. A reusable `validate` middleware takes a schema with three optional pieces — `body`, `params`, `query` — runs it, and either replaces `req.body/params/query` with the parsed (and now strongly-typed) values, or calls `next` with a 400 `AppError` whose `details` array lists every field that failed.

Validation runs **before** the controller, never inside it. By the time a controller runs, it can trust its input.

### Schemas we will write

- `createMediaSchema` — body has `title` (required string), `tags` (array of strings, optional), `category` (enum: `image` | `document`).
- `updateMediaSchema` — same fields, all optional, plus `params.id` is a valid Mongo ObjectId.
- `listMediaSchema` — query has `page`, `limit` (default 10, max 50), `category`, `tags` (comma string → array), `search`, `sortBy`, `order` (`asc`/`desc`).
- `registerSchema` / `loginSchema` — email + password.

---

## 7. File uploads (Multer)

- **Storage**: disk, in `./uploads`, filename = `<timestamp>-<random>-<originalname>`. We avoid using the original name alone because two users can upload `report.pdf`.
- **Allowed MIME types**: `image/jpeg`, `image/png`, `application/pdf`. Anything else is rejected by Multer's `fileFilter` with a clear message.
- **Max size**: 5 MB, enforced by Multer's `limits` option.
- **Multer errors** (oversized file, wrong type) are caught and translated into our standard 400 error envelope.
- For each upload we store on the media document: `filePath`, `originalName`, `mimeType`, `size`, plus the metadata.
- On delete, the service first removes the file from disk, then removes the DB record. If disk delete fails because the file is already gone, we log and continue — that is not a client error.

---

## 8. Authentication & authorization

### Model
A `User` document holds `email`, `passwordHash`, `createdAt`. Passwords are hashed with bcrypt (cost factor 10) before saving — handled by a Mongoose `pre("save")` hook.

### Endpoints
- `POST /auth/register` — create a user, return a JWT.
- `POST /auth/login` — verify password, return a JWT.
- `GET /auth/me` — return the current user (requires token).

### JWT
Signed with `JWT_SECRET` from env, expires in `JWT_EXPIRES_IN` (default 7 days). Payload is just `{ userId }`. The client sends it as `Authorization: Bearer <token>`.

### The `authenticate` middleware
Reads the header, verifies the token, loads the user from the database, attaches it to `req.user`. If anything fails → 401.

### Ownership
Every `Media` document stores `ownerId` (the user who uploaded it). The media service enforces:

- **Create** — always sets `ownerId` to the current user.
- **Update / Delete** — loads the media, compares `ownerId` to `req.user._id`. Mismatch → 403 Forbidden.
- **Read** (list and get-by-id) — also filtered by `ownerId`. A user only ever sees their own media.

---

## 9. Listing endpoint (search + filter + paginate)

`GET /media` accepts: `page`, `limit`, `category`, `tags`, `search`, `sortBy`, `order`. After validation:

- `tags` arrives as an array — translated to a Mongo `$in` query.
- `search` uses a Mongo **text index** on `title` (created in the model). Falls back to a case-insensitive regex if we ever decide we need partial-word matches, but text index is the default.
- `sortBy` defaults to `createdAt`, `order` defaults to `desc`.
- `limit` is capped at 50 by the validator.

The repository runs the count and the page of results **concurrently** with `Promise.all` — this is the spec's required `Promise.all` example and a real performance win on slow connections:

```ts
const [total, results] = await Promise.all([
  Media.countDocuments(filter),
  Media.find(filter).sort(sort).skip(skip).limit(limit),
]);
```

Then we compute `totalPages = Math.ceil(total / limit)` and return the envelope from section 4.

---

## 10. Coding style

These are the conventions the whole codebase follows. Prettier handles spacing; this section is the stuff Prettier doesn't decide.

- **Files**: `camelCase.ts` for code (`mediaService.ts`), `PascalCase.ts` only for files that export a single class (rare here).
- **Variables & functions**: `camelCase`.
- **Types & interfaces**: `PascalCase`. Mongoose document types end in `Doc` (`MediaDoc`), plain DTOs do not (`CreateMediaInput`).
- **Constants**: `SCREAMING_SNAKE_CASE` only for true constants in `config/`. Local consts stay `camelCase`.
- **Async**: always `async`/`await`. Never `.then()` chains. The only Promise method we use directly is `Promise.all` for parallel work.
- **Imports**: third-party first, then internal, separated by a blank line. Relative imports end in `.js` (ESM rule).
- **No default exports** except for the Express app itself. Named exports make refactors safer and grep work.
- **No `any`**. If we genuinely don't know a type, use `unknown` and narrow.
- **Comments**: explain *why*, never *what*. The code says what.

---

## 11. Environment variables

Listed in `.env.example` (committed). The real `.env` is git-ignored.

```
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/media-library
JWT_SECRET=replace-me-with-a-long-random-string
JWT_EXPIRES_IN=7d
LOG_LEVEL=debug
```

On boot, `config/env.ts` parses `process.env` through a Zod schema and exports a typed `env` object. Missing or malformed values crash the app immediately with a clear message.

---

## 12. Build order

This is the order we will write the code. Each step leaves the app runnable, so we never have a half-broken project.

1. **Project setup** — `package.json`, `tsconfig.json`, ESLint, Prettier, Husky + lint-staged, `.editorconfig`, `.gitignore`, `.env.example`.
2. **Config layer** — `env.ts` (Zod-validated env), `logger.ts` (Pino), `db.ts` (Mongoose connect helper).
3. **Core utilities** — `AppError`, `catchAsync`, `sendSuccess` helper.
4. **Express skeleton** — `app.ts` with JSON middleware, a health-check route (`GET /health`), and the global error handler. `server.ts` boots Mongo, then listens, plus the process-level error handlers. **At this point the app runs.**
5. **Validation middleware** — generic `validate(schema)` that handles body/params/query.
6. **User model + auth** — `User` schema, register/login/me endpoints, `authenticate` middleware. Test by hand.
7. **Media model** — schema with `ownerId`, file fields, metadata, plus the text index on `title`.
8. **Upload middleware** — Multer config with the MIME filter and size limit.
9. **Media repository** — every Mongo call for media.
10. **Media service** — business rules: ownership checks, file deletion on remove.
11. **Media controllers + routes** — wire everything to the five endpoints. Use the `Promise.all` pattern in the list endpoint.
12. **Manual smoke test** — Postman collection covering the happy path and the main failure cases (wrong file type, oversized file, wrong owner, invalid token, missing fields).

---

## 13. API endpoints (final)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | — | Create an account, return JWT |
| POST | `/auth/login` | — | Log in, return JWT |
| GET | `/auth/me` | ✅ | Current user info |
| POST | `/media` | ✅ | Upload one file + metadata |
| GET | `/media` | ✅ | List own media (filter/search/paginate) |
| GET | `/media/:id` | ✅ | Get one media item (owner only) |
| PUT | `/media/:id` | ✅ | Update metadata (owner only) |
| DELETE | `/media/:id` | ✅ | Delete media + file (owner only) |
| GET | `/health` | — | Liveness probe |

---

**This document is the contract. If something we implement doesn't match what's here, we either fix the code or update this file — never let them drift.**
