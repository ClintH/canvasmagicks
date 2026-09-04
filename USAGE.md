# canvasmagicks usage guide

For full details see `MANUAL.md`. All interactive prompts have CLI flags to skip them.

## calendar translate

Translate an activities JSON file to Markdown or iCal.

```
canvasmagicks calendar translate --output <path> [--source <path>] [--who <names>] [--prefix <text>] [--filter-title <text>]
```

- `--source <path>` / `-s` — JSON file (default `example/schedule.json`).
- `--output <path>` / `-o` — **required**; `.md` writes Markdown, `.ics` writes iCal.
- `--who <names>` — comma-separated, case-insensitive (e.g. `--who ch,jp`). Filters to activities where name is `responsible` or in `involved`. Omit for all; warns for unmatched names; empty filter writes empty `.ics` or a `No activities matched filter` note in `.md`.
- `--prefix <text>` — prefix for ICS `SUMMARY` (e.g. `--prefix Private` → `Private Dinner`). Prompted if omitted when writing `.ics`; ignored for `.md`.
- `--filter-title <text>` — only export events whose title contains text (case-insensitive substring).

## calendar import

Import activities into a Canvas course calendar.

```
canvasmagicks calendar import [--source <path>] [--course <code>] [--dry-run]
```

- `--source` / `-s` — JSON file.
- `--course` / `-c` — course code (e.g. `VT2025-KD413A-K3548`).
- `--dry-run` — preview without writing.

## calendar download

Download calendar events from a Canvas course.

```
canvasmagicks calendar download --output <path> [--course <code>] [--prefix <text>] [--filter-title <text>]
```

- `--course <code>` / `-c` — course code.
- `--output <path>` / `-o` — **required**; `.json` writes full Canvas events, `.md` writes Markdown, `.ics` writes iCal.
- `--prefix <text>` — prefix for ICS `SUMMARY` (prompted when writing `.ics`; ignored for `.json`/`.md`).
- `--filter-title <text>` — only export events whose title contains text (case-insensitive substring).

## calendar sync

Compare a JSON file against a Canvas calendar (read-only).

```
canvasmagicks calendar sync [--source <path>] [--course <code>]
```

## calendar nuke

Delete all calendar events in a course (asks for confirmation).

```
canvasmagicks calendar nuke [--course <code>] [--dry-run]
```

## course

Set the default course.

```
canvasmagicks course
```

## page ls

List pages in a course.

```
canvasmagicks page ls [--course <code>]
```

## page target

Pin a target page (cached 1h, tied to course).

```
canvasmagicks page target [--course <code>] [--page <slug>]
```

## page write

Upload Markdown to a Canvas page as HTML.

```
canvasmagicks page write [--source <path>] [--course <code>] [--page <slug>] [--dry-run]
```

## page export

Export Canvas pages as Markdown.

```
canvasmagicks page export [--output <path>] [--course <code>] [--page <slug>] [--dry-run]
```

## exams ls

List assignments in a course.

```
canvasmagicks exams ls [--course <code>]
```

- `--course <code>` / `-c` — course code.

## exams get

Download all submissions for an assignment.

```
canvasmagicks exams get [--course <code>] [--assignment <id>] [--exam <id>] [--output <path>] [--attachments <yes|no>]
```

- `--course <code>` / `-c` — course code.
- `--assignment <id>` / `-a` — assignment id (see `canvasmagicks exams ls`). Prompts with a picker if omitted.
- `--exam <id>` / `-e` — exam (assignment) id, overriding `--assignment` and the target exam.
- `--output <path>` / `-o` — **required**; `.json` writes full submissions, `.md` writes Markdown (one `# <student>` section each, sorted by last name), `.xlsx` writes an Excel sheet (one row per student: id, name, submitted Y/N). Prompts if omitted; empty prints to stdout.
- `--attachments <yes|no>` — download attachment binaries next to the output (`<name>_files/`). `no` records links only. Prompted if omitted.

## exams target

Pin a target exam (cached 1h, tied to course).

```
canvasmagicks exams target [--course <code>] [--exam <id>]
```
