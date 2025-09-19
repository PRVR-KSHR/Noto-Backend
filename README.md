# Backend (Express + MongoDB)

Hardened, production-ready Express server for Noto.

## Security and stability features
- Helmet security headers (COOP allow-popups for OAuth, COEP disabled for API)
- CORS with allowlist from env, credentials enabled
- gzip compression
- HPP (HTTP Parameter Pollution) protection
- Rate limiting with env-configurable window and max
- Centralized 404 and error handler with structured JSON
- Async route wrapper to avoid unhandled promise rejections
- Environment-driven logging with morgan integration
- Trust proxy and `x-powered-by` disabled

## Environment variables
See `.env.example` for all supported values. Copy and fill these in a `.env` file in `backend/`:

- `NODE_ENV` (development|production)
- `PORT` (default 5000)
- `MONGODB_URI`
- `FRONTEND_URL` (e.g., http://localhost:5173)
- `CORS_ORIGINS` (comma-separated, additional allowed origins)
- `RATE_LIMIT_WINDOW_MS` (default 900000)
- `RATE_LIMIT_MAX` (default 100)
- `LOG_LEVEL` (error|warn|info|debug)
- Firebase Admin: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `ADMIN_EMAILS` (comma-separated)
- Storage: `STORAGE_PROVIDER` (cloudinary|r2) and respective provider keys

Notes:
- Put literal \n in `FIREBASE_PRIVATE_KEY` lines in `.env`.
- `ADMIN_EMAILS` replaces previously hardcoded admin list.

## Install & Run

Windows PowerShell (from `backend/` directory):

```powershell
# Install deps
npm install

# Development
$env:NODE_ENV = 'development'; npm run dev

# Production (example)
$env:NODE_ENV = 'production'; npm start
```

The server listens on `PORT` and connects to `MONGODB_URI`. A health check is available at `/api/health`.

## Logging
- HTTP logs: morgan (`dev` in development, `combined` in production)
- App logs: `utils/logger.js` honors `LOG_LEVEL` and prints JSON-compatible messages

## Error handling
- 404: `{ success:false, message:'Route not found', path }`
- Errors: `{ success:false, message, code, stack? }` (stack only outside production)

## CORS
- Allowed origins = `FRONTEND_URL` + `CORS_ORIGINS` (comma-separated)
- Credentials supported; methods and headers are restricted

## Rate limiting
- Defaults to 100 requests per 15 minutes per IP; configure via env

## Notes for CI/tests
- Some existing test files are empty and cause Jest to fail. Add tests or skip empty files in your Jest config to get green builds.
