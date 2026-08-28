# canvasmagicks

A command line interface for [Canvas LMS](https://www.instructure.com/canvas),
built in TypeScript with [Bun](https://bun.sh). Interactive input uses
[`@inquirer/prompts`](https://www.npmjs.com/package/@inquirer/prompts) and the
CLI is wired up with the type-safe [`cmd-ts`](https://www.npmjs.com/package/cmd-ts)
parser.

## Requirements

- [Bun](https://bun.sh) 1.3.0 or later
- A Canvas LMS account with an API token
  (Canvas → Account → Settings → "New Access Token")

## Getting started

```sh
bun install
bun run auth            # interactive login (token is masked)
```

## Commands

### `auth`

Launches a terminal UI where you enter your Canvas instance domain and API
token. Credentials are verified against `GET /api/v1/users/self` and, on
success, saved to `~/.config/canvasmagicks/config.json` (mode `0600`).

```sh
bun run auth --domain https://canvas.instructure.com
```

## Configuration

Credentials are stored at:

```
~/.config/canvasmagicks/config.json
```

```json
{ "domain": "https://canvas.instructure.com", "token": "..." }
```

## Architecture

```
src/
  index.ts          Entry point, runs the cmd-ts CLI
  cli.ts            Command definitions (cmd-ts)
  commands/
    auth.ts         Interactive login (input + masked password prompts)
    whoami.ts       Prints the authenticated user
    courses.ts      Prints your courses as a table
  lib/
    config.ts       Load/save credentials
    canvas.ts       Typed Canvas API client
```

## Testing

The prompt layer (`@inquirer/prompts`) is isolated in `src/commands/auth.ts`,
while verification (`src/lib/canvas.ts`) and persistence (`src/lib/config.ts`)
are plain async functions. Mock `@inquirer/prompts` and `fetch` in tests to
exercise the flow without a terminal.

## Notes & limitations

- The token is entered through a masked `password` prompt, so it is not echoed
  to the screen.
