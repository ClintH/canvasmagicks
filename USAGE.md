# canvasmagicks usage guide

## calendar import-markdown

Reads a Canvas activities JSON file (see `example/schedule.json`), validates it with
the same schema used by `calendar import`, and writes a Markdown version next to it
(`<name>.md`).

```
canvas calendar import-markdown
```

It prompts for the path to the JSON file (defaults to `example/schedule.json`) and
emits one Markdown file. Invalid data is reported per-activity with the offending
field name, e.g. `Activity 4: field 'startTime' is required but missing`.

Pass `--source <path>` (or `-s <path>`) to skip the prompt and read the file directly,
e.g. `canvas calendar import-markdown --source example/schedule.json`.

### Output format

- A top-level `# Activities` section lists every event, followed by a `## <person>`
  section for each participant (responsible person or involved person).
- Each event line has the shape:

  ```
  [YYYY-MM-DD ]MM-DD <Dow> HH:MM-HH:MM Title (participants)
  ```

  - `<Dow>` is a three-letter weekday abbreviation (e.g. `Mon`).
  - The year is omitted from the date when **all** activities fall in the same year.
  - The parenthetical encodes who is responsible and who is participating:
    - responsible with others: `(!CH with JP,JN)`
    - responsible only: `(!CH)`
    - involved only (no responsible): `(CH,JN)`
    - empty when neither is set.
  - The **same** `(participants)` encoding is used for the titles of the events
    created in Canvas, so the Markdown overview and the calendar stay in sync.
  - Times are zero-padded (`09:15`).
- A `_Generated <YYYY-MM-DD HH:MM>_` line sits under the title.

The Markdown file is generated entirely locally; it does not talk to the Canvas API
and does not require authentication.

## course

Sets the default course used by other commands, so you don't have to pick it every time.

```
canvas course
```

It loads the list of your courses (from a one-hour local cache), lets you type to narrow
the list, and pick one. The selection is saved to your settings
(`defaultCourseId` / `defaultCourseCode` in `~/.config/canvasmagicks/config.json`).

After a default is set, any command that needs a course offers it first: press ENTER to
accept the default, or keep typing to choose a different one. You can change the saved
default at any time by running `canvas course` again.

The course list is cached on disk for one hour; every place that lists courses (this
command, `canvas courses`, and course selection in other commands) reads from that cache.

## page ls

Lists all pages in a course and shows their `slug` (the `url` identifier, used by the
`page target` / `page write` commands).

```
canvas page ls [--course <code>]
```

- `--course <code>` / `-c <code>` — list pages for this course code
  (e.g. `VT2025-KD413A-K3548`), overriding the saved default course. If omitted, the
  saved default is offered first.

## page target

Sets the "target" page. Like `canvas course` does for courses, this pins a page so other
commands (notably `page write`) default to it. The target is **persisted for one hour** and
is **linked to the course**: if the target course changes, the target page is forgotten.

```
canvas page target [--course <code>] [--page <slug>]
```

- `--course <code>` / `-c <code>` — choose the page from this course code, overriding the
  saved default course.
- `--page <slug>` / `-p <slug>` — set the target page directly by its slug, skipping the
  picker. The slug comes from `canvas page ls`.

When run interactively it loads the course's pages, pins the current target page at the top
(press ENTER to keep it), and lets you type to narrow the list. It also offers a
**"Create new page…"** choice: picking it prompts for a title and creates a new
**unpublished** page in the course, which then becomes the target. The selection is cached
on disk (separate from the permanent course default) for one hour, tied to the chosen course.

## page write

Sets a course page's body to the contents of a Markdown file, converting the Markdown to
Canvas-appropriate HTML before uploading.

```
canvas page write [--source <path>] [--course <code>] [--page <slug>] [--dry-run]
```

- `--source <path>` / `-s <path>` — path to the Markdown source file (skips the file prompt).
- `--course <code>` / `-c <code>` — update a page in this course code, overriding the saved
  default course. If omitted, the target course (from `canvas page target`) is offered first.
- `--page <slug>` / `-p <slug>` — update this page slug, skipping the page picker. If omitted, the
  target page (from `canvas page target`) for the chosen course is offered first.
- `--dry-run` — report which page would be updated (course, page title, source file, and the
  resulting HTML size) without changing Canvas. Honoured above all else.

Flow when prompts are not skipped: choose a course (defaulting to the target course), choose
a page (defaulting to the target page), then provide the Markdown source file. On success the
target page is refreshed so subsequent runs keep defaulting to it.

## calendar nuke

Deletes **every calendar event** from a course. This is destructive and irreversible, so it
always asks for confirmation.

```
canvas calendar nuke [--course <code>] [--dry-run]
```

- `--course <code>` / `-c <code>` — nuke the calendar of this course code
  (e.g. `VT2025-KD413A-K3548`), overriding the saved default course. If omitted, the saved
  default is offered first.
- `--dry-run` — still prompts for confirmation, but reports how many events would be deleted
  and makes no changes. Honoured above all else.

Flow: pick a course, see how many calendar events it has, then confirm the deletion. Only
actual **calendar events** in that exact course are deleted — assignments/assessments (excluded
by the `type=event` filter) and **pages** (a separate API) are never touched. Each candidate
event is also re-checked to belong to the chosen course context before it is removed.

## calendar sync

Read-only analysis: shows the difference between a calendar JSON file and a course's Canvas
calendar. It never writes to Canvas — it only reports what would change if you re-imported.

```
canvas calendar sync [--source <path>] [--course <code>]
```

- `--source <path>` / `-s <path>` — read this calendar JSON file instead of prompting.
- `--course <code>` / `-c <code>` — compare against this course code
  (e.g. `VT2025-KD413A-K3548`), overriding the saved default course. If omitted, the saved
  default is offered first.

Flow: pick a course (if not given), pick a calendar JSON file (if not given), then the
difference is computed and printed. Each result is classified as:

- **ADDED** — a Canvas event with no matching activity in the file (something added on the
  Canvas side).
- **DELETED** — an activity in the file with no matching Canvas event (something missing from
  Canvas).
- **UPDATED** — a matched event whose title, description, end time, or location differs. The
  changed fields are listed, with the current Canvas value and the file's value.

The comparison reuses `calendar import`'s encoding so only genuine edits are reported: event
titles are compared against `buildTitle` (which always encodes responsible/involved people),
and descriptions are accepted in either the prefixed (`Involved: …`) or plain form. Unchanged
events are counted but not listed.

## calendar import

Imports a validated activities JSON file into a Canvas course calendar. After reading the
file it prompts for a default location (applied to every activity missing one), a
description option, and the target course. Event titles always encode the responsible
person (`!Name`) and other participants, so there is no separate title prompt. Existing
events are merged or wiped per your
choice, with per-conflict resolution.

```
canvas calendar import [--source <path>] [--course <code>] [--dry-run]
```

- `--source <path>` / `-s <path>` — read this file instead of prompting for the path.
- `--course <code>` / `-c <code>` — import into the course with this course code
  (e.g. `VT2025-KD413A-K3548`), overriding the saved default course. If omitted, the
  saved default is offered first (press ENTER to accept, or type to change).
- `--dry-run` — report what would change (add/replace/keep counts) without making any
  changes to Canvas. The wipe, delete, and staffing-page steps are likewise skipped.

During the preliminary questions you are also asked whether to update a course page whose
title starts with `Staffing_` with the schedule overview. If such a page already exists its
body is replaced; otherwise a new **unpublished** page named `Staffing_ <course name>` is
created. The overview is the same Markdown produced by `canvas calendar import-markdown`, converted to
HTML (via the shared Markdown→HTML helper used by `canvas page write`) before being written to the
page body.
