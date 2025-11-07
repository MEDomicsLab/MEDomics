# MEDomics Server CLI (Scaffold)

This folder contains a scaffolded command-line interface for running the MEDomics backend headlessly.

## Commands

| Command | Purpose |
|---------|---------|
| start | Launch the Express backend and persist a state file with port/PID. |
| status | Query /status and print JSON summary. |
| ensure | Idempotently start services (Go, Mongo, Jupyter). |
| install | (Stub) Future dependency bootstrap (Python env, Mongo). |
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
node ./backend/cli/medomics-server.mjs status
node ./backend/cli/medomics-server.mjs ensure --go --mongo --jupyter --workspace /path/to/workspace
```
