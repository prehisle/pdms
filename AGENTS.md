1. 总是使用简体中文，场景包括与用户交互、生成的文档、代码注释
2. 代码提交及推送需用户每次明确要求才进行



# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: Go 1.22 services; entry `cmd/server`, routing in `internal/api`, domain logic in `internal/service`, external clients in `internal/ndrclient`, config/cache helpers nearby.
- `frontend/`: Vite + React admin UI; implementation in `src/`, static output in `dist/`, tooling owned by `package.json`.
- `docs/`: design notes and OpenAPI (`docs/backend/openapi.json`) that back feature discussion.
- Generated outputs (`backend/tmp/`, `.gocache/`, `server.log`) should stay untracked.

## Build, Test, and Development Commands
- `cd backend && go run ./cmd/server`: start the API with `.env` or `YDMS_*` overrides.
- `cd backend && go run ./cmd/server --watch`: autorebuilds on Go/env/mod changes, binary stored in `backend/tmp/server-dev`.
- `cd backend && go test ./... -cover`: run backend unit suites with coverage.
- `cd frontend && npm install`: sync dependencies after lockfile changes.
- `cd frontend && npm run dev`: launch Vite on `http://localhost:5173`; set `VITE_DEBUG_DRAG=1` for drag diagnostics.
- `cd frontend && npm run build` or `npm run preview`: verify production bundles before release.

## Coding Style & Naming Conventions
- Format Go with `gofmt`/`goimports`; packages stay lowercase, exports use PascalCase, shared errors follow `ErrXYZ`.
- Keep services and handlers table-driven; prefer small interfaces that mirror existing cache/config abstractions.
- React components live in PascalCase files, hooks as `useCamelCase`, and colocated assets per component.
- Maintain strict TypeScript: explicit return types, shared query keys under `src/hooks/`, and descriptive prop names.

## Testing Guidelines
- Place Go tests beside code (`*_test.go`); reuse fixtures under `internal/service/testdata`.
- Integration runs need NDR access: `go test ./internal/ndrclient -run TestRealNDRIntegration -ndr.url=...`.
- Frontend automation is not wired yet—propose tooling changes in PRs before adding Vitest/RTL suites.

## Commit & Pull Request Guidelines
- Follow the conventional prefix style (`feat:`, `fix:`, `docs:`) with concise, imperative summaries.
- Keep related changes grouped; mention touched domains when spanning backend and frontend.
- PRs should outline behaviour changes, test commands run, linked issues, and UI or cURL evidence for user-facing updates.
- Update documentation (`docs/`, `AGENTS.md`) whenever workflows or APIs shift.

## Environment & Configuration Tips
- Manage secrets via `.env`; never commit live `YDMS_NDR_API_KEY`, `YDMS_ADMIN_KEY`, or external endpoints.
- Watch mode writes to `backend/tmp/`; clean it during local resets and keep logs like `server.log` out of commits.
