# canvasmagicks usage guide

For full details see `MANUAL.md`. All interactive prompts have CLI flags to skip them.

## calendar translate

Translate an activities JSON file to Markdown or iCal.

```
canvas calendar translate --output <path> [--source <path>] [--who <names>]
```

- `--source <path>` / `-s` — JSON file (default `example/schedule.json`).
- `--output <path>` / `-o` — **required**; `.md` writes Markdown, `.ics` writes iCal.
- `--who <names>` — comma-separated, case-insensitive (e.g. `--who ch,jp`). Filters to activities where name is `responsible` or in `involved`. Omit for all; warns for unmatched names; empty filter writes empty `.ics` or a `No activities matched filter` note in `.md`.

## calendar import

Import activities into a Canvas course calendar.

```
canvas calendar import [--source <path>] [--course <code>] [--dry-run]
```

- `--source` / `-s` — JSON file.
- `--course` / `-c` — course code (e.g. `VT2025-KD413A-K3548`).
- `--dry-run` — preview without writing.

## calendar sync

Compare a JSON file against a Canvas calendar (read-only).

```
canvas calendar sync [--source <path>] [--course <code>]
```

## calendar nuke

Delete all calendar events in a course (asks for confirmation).

```
canvas calendar nuke [--course <code>] [--dry-run]
```

## course

Set the default course.

```
canvas course
```

## page ls

List pages in a course.

```
canvas page ls [--course <code>]
```

## page target

Pin a target page (cached 1h, tied to course).

```
canvas page target [--course <code>] [--page <slug>]
```

## page write

Upload Markdown to a Canvas page as HTML.

```
canvas page write [--source <path>] [--course <code>] [--page <slug>] [--dry-run]
```

## page export

Export Canvas pages as Markdown.

```
canvas page export [--output <path>] [--course <code>] [--page <slug>] [--dry-run]
```
