# YDMS Backend Skeleton

This module hosts the Go backend for the YDMS question bank.

## Getting started

1. Ensure Go 1.22+ is installed.
2. Configure the connection to the NDR service by setting environment variables or editing `.env`:

```
YDMS_NDR_BASE_URL=http://localhost:9001
YDMS_NDR_API_KEY=your-ndr-key
YDMS_HTTP_PORT=9180
YDMS_DEFAULT_USER_ID=system
```

3. From this directory, run:

```bash
go run ./cmd/server
```

4. The server listens on `:9180` by default (override with `YDMS_HTTP_PORT`).
5. Test the hello endpoint:

```bash
curl http://localhost:9180/api/v1/ping
```

### Auto reload during development

For automatic rebuild on file changes, install [air](https://github.com/air-verse/air):

```bash
go install github.com/air-verse/air@latest
```

Then run the watcher from this directory:

```bash
air
```

The provided `.air.toml` will rebuild `./cmd/server` into `./tmp/server` and restart it whenever Go source files change.

## Project structure

- `cmd/server`: application entrypoint
- `internal/api`: HTTP handlers and routing
- `internal/service`: domain services
- `internal/ndrclient`: placeholder for the NDR integration
- `internal/cache`: cache abstraction with no-op implementation
- `internal/config`: configuration loading utilities

Caching is disabled by default but the `cache.Provider` interface allows plugging
in Redis or other providers without touching the service layer.
