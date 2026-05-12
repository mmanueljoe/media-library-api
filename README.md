# Media Library API

A REST API for a content team to upload, organize, and search media files (images and PDFs). Users register, log in, and manage their own uploads.

Built with TypeScript, Express 5, MongoDB (Mongoose), and JWT auth.

For the full design see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Requirements

- Node.js 20 LTS or newer
- Yarn
- MongoDB running locally (or a connection string to a hosted instance)

## Setup

```bash
yarn install
cp .env.example .env   # then fill in real values
```

## Scripts

| Command | What it does |
|---|---|
| `yarn dev` | Start the dev server with auto-reload (tsx watch). |
| `yarn build` | Compile TypeScript to `dist/`. |
| `yarn start` | Run the compiled app from `dist/server.js`. |
| `yarn lint` | Check code for lint errors. |
| `yarn format` | Auto-format all files with Prettier. |
| `yarn format:check` | Check formatting without changing files. |
| `yarn typecheck` | Type-check without compiling. |

## Environment variables

See [`.env.example`](.env.example) for the full list:

- `NODE_ENV` — `development` | `production`
- `PORT` — port the API listens on
- `MONGO_URI` — MongoDB connection string
- `JWT_SECRET` — secret for signing JWTs (use a long random string in production)
- `JWT_EXPIRES_IN` — token lifetime (e.g. `7d`, `1h`)
- `LOG_LEVEL` — `debug` | `info` | `warn` | `error`

## Endpoints

See the table in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) section 13.
