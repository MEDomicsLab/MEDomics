# MEDomics Server CLI (Scaffold)

This folder contains a scaffolded command-line interface for running the MEDomics backend headlessly.

## Commands

| Command | Purpose |
|---------|---------|
| start | Launch the Express backend and persist a state file with port/PID. |
| stop | Gracefully stop the backend using the saved PID; force kill after timeout. |
| status | Query /status and print JSON summary. |
| ensure | Idempotently start services (Go, Mongo, Jupyter). |
| install | Drive Express endpoints to install Mongo and Python env/packages, then re-check requirements. |
| upgrade | (Stub) Manifest-driven update process. |

## State File

Writes `medomics-server-state.json` in the current working directory containing:
```json
{
  "running": true,
  "pid": 12345,
  "expressPort": 3737,
  "started": "2025-11-06T12:34:56.789Z"
}
```

## Next Steps
1. Implement real install (call /install-bundled-python, /install-mongo endpoints or direct utils import).
2. Add upgrade logic (download archive, verify SHA256 + signature, replace folder atomically).
3. Provide stop + service management commands.
4. Harden error handling & logging (structured logs, log rotation).

## Development
Run locally from repo root:
```bash
node ./backend/cli/medomics-server.mjs start
node ./backend/cli/medomics-server.mjs stop
node ./backend/cli/medomics-server.mjs status
node ./backend/cli/medomics-server.mjs ensure --go --mongo --jupyter --workspace /path/to/workspace
node ./backend/cli/medomics-server.mjs install --json
```

The `install` command will:
1. Start Express if not already running (using the CLI's start logic).
2. GET `/check-requirements`.
3. POST `/install-mongo` if MongoDB is missing.
4. POST `/install-bundled-python` if Python env is missing.
5. POST `/install-required-python-packages` if packages are missing.
6. GET `/check-requirements` again and print a JSON summary.
