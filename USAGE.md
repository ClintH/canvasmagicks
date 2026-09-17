# canvasmagicks usage guide

For full details see `MANUAL.md`. All interactive prompts have CLI flags to skip them.

# calendar

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

# course

Set the default course.

```
canvasmagicks course
```

# page

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

# exams

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

# students

## students ls

List the students enrolled in a course.

```
canvasmagicks students ls [--course <code>] [--all]
```

- `--course <code>` / `-c` — course code.
- `--all` — include inactive/completed enrollments (default: active/invited only).

## students export

Export the course roster (or one target student) to JSON, Markdown or Excel.

```
canvasmagicks students export [--course <code>] [--student <id>] [--all] [--output <path>]
```

- `--course <code>` / `-c` — course code.
- `--student <id>` / `-s` — student user id, overriding the target student. Omit to export the whole roster (or the target student, if set).
- `--all` — include inactive/completed enrollments.
- `--output <path>` / `-o` — `.json`, `.md` or `.xlsx`. Prompts if omitted; empty prints Markdown to stdout.

## students target

Pin a target student (cached 1h, tied to course).

```
canvasmagicks students target [--course <code>] [--student <id>]
```

# groups

## groups ls

List the groups in a group set (group category).

```
canvasmagicks groups ls [--course <code>] [--category <id>]
```

- `--course <code>` / `-c` — course code.
- `--category <id>` — group set id, overriding the target group set. Prompts with a picker if omitted.

## groups export

Export a group set's groups and members to JSON, Markdown or Excel.

```
canvasmagicks groups export [--course <code>] [--category <id>] [--output <path>]
```

- `--output <path>` / `-o` — `.json`, `.md` or `.xlsx`. Prompts if omitted; empty prints Markdown to stdout.

## groups target

Pin a target group set (cached 1h, tied to course).

```
canvasmagicks groups target [--course <code>] [--category <id>]
```

## groups create

Create a new group set and auto-assign active students to groups (`jumble`: tries to avoid re-pairing students who've shared a group before).

```
canvasmagicks groups create [--course <code>] [--name <text>] [--group-size <n> | --group-count <n>] [--group-prefix <text>] [--history <ids>] [--dry-run]
```

- `--name <text>` — name for the new group set. Prompts if omitted.
- `--group-size <n>` — target students per group. If neither this nor `--group-count` is given, prompts to choose sizing mode then asks for the number.
- `--group-count <n>` — number of groups, overriding `--group-size`.
- `--group-prefix <text>` — name prefix for created groups (default `Group`, giving `Group 1`, `Group 2`, ...).
- `--history <ids>` — comma-separated ids of existing group sets whose pairings should be avoided. Pass an empty string for no history. Prompts with a checklist (existing group sets, all checked by default) if omitted.
- `--dry-run` — preview the planned groups and conflict count without creating anything in Canvas. Always asks for confirmation before writing when not a dry run.

# generate

## generate random-questions

Generate a DOCX handout with one random question per section per student.

```
canvasmagicks generate random-questions --students <path> --questions <path> --output <path> [--pages-per-student <n>]
```

- `--students <path>` — **required**; JSON file of students (e.g. from `students export --output students.json`). Only the `name` field is used.
- `--questions <path>` — **required**; JSON file: an array of `{ section, question, id }`.
- `--output <path>` / `-o` — **required**; destination file, must end in `.docx`.
- `--pages-per-student <n>` — number of pages to spread each student's questions across (default `1`); must be at least `1`. Each student gets a `# <name>` heading (continuation pages as `<name> (cont.)`) with page breaks and spacing for written answers.
