# canvasmagicks manual

Full reference for all commands. For a quick overview see `USAGE.md`.

## calendar translate

Translates a Canvas activities JSON file (see `example/schedule.json`) into either Markdown or iCal, optionally filtered by who is responsible or involved.

```
canvasmagicks calendar translate --output <path> [--source <path>] [--who <names>] [--prefix <text>] [--filter-title <text>]
```

- `--source <path>` / `-s <path>` — path to the calendar JSON file. If omitted, you are prompted (defaults to `example/schedule.json`).
- `--output <path>` / `-o <path>` — **required** output file. If it ends with `.md`, Markdown is written; if it ends with `.ics`, an iCal file is written. If omitted, you are prompted. Unsupported extensions error with `Use .md for Markdown or .ics for iCal`.
- `--who <names>` — optional comma-separated list of names (e.g. `--who ch,jp`). Matching is case-insensitive; an activity is included if any of the names equals its `responsible` or appears in `involved`. If omitted or empty, all entries are exported. In interactive mode you are prompted (`empty for all`). For each requested name with zero matches a warning is printed: `Warning: no entries for '<name>'`. If the filter matches nothing, a warning `Warning: filter matched 0 activities` is printed; the `.ics` file is written as an empty calendar (no `VEVENT`s), and the `.md` file contains `No activities matched filter: <names>` beneath the `_Generated ..._` line.
- `--prefix <text>` — optional prefix for ICS event summaries. If set, each `SUMMARY` becomes `<prefix> <title>` (e.g. `--prefix Private` with title `Dinner` → `Private Dinner`). When writing `.ics` and omitted, you are prompted (`Prefix for ICS event summaries (empty for none)`); empty input means no prefix. Ignored for `.md` output.
- `--filter-title <text>` — optional case-insensitive substring filter on `title`. Only events whose title contains the text are exported. In interactive mode prompted (`Filter by title (substring, empty for all)`); empty means no filter. Combine with `--who` via AND.

Invalid JSON data is reported per-activity with the offending field name, e.g. `Activity 4: field 'startTime' is required but missing`.

### Output formats

#### Markdown (`.md`)

- A top-level `# Activities` section lists every event, followed by a `## <person>` section for each participant (responsible person or involved person).
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
  - The **same** `(participants)` encoding is used for the titles of the events created in Canvas, so the Markdown overview and the calendar stay in sync.
  - Times are zero-padded (`09:15`).
- A `_Generated <YYYY-MM-DD HH:MM>_` line sits under the title.
- When filtered to zero matches, the file still contains the header and the line `No activities matched filter: ...`.

#### iCal (`.ics`)

- A `VCALENDAR` (`VERSION:2.0`, `PRODID:-//canvasmagicks//EN`) with one `VEVENT` per matched activity.
- `SUMMARY` is the activity title with participants (same encoding as Markdown), optionally prefixed (e.g. `Private Dinner` when `--prefix Private`), `DTSTART`/`DTEND` are UTC (`...Z`) derived from the activity's local wall-clock time, `DESCRIPTION` contains `Involved`/`Responsible`/`notes`, `LOCATION` if present, `UID` is deterministic per activity, `DTSTAMP` is now. Lines are folded per RFC 5545.

All translation is local; it does not talk to the Canvas API and does not require authentication.

Examples:

```
canvasmagicks calendar translate --source example/schedule.json --output out.md
canvasmagicks calendar translate --source example/schedule.json --output out.ics --who CH,JP
canvasmagicks calendar translate --source example/schedule.json --output filtered.md --who ch
canvasmagicks calendar translate --source example/schedule.json --output out.ics --who ch --prefix Private
canvasmagicks calendar translate --source example/schedule.json --output out.ics --prefix "My Course"
```

## course

Sets the default course used by other commands, so you don't have to pick it every time.

```
canvasmagicks course
```

It loads the list of your courses (from a one-hour local cache), lets you type to narrow the list, and pick one. The selection is saved to your settings (`defaultCourseId` / `defaultCourseCode` in `~/.config/canvasmagicks/config.json`).

After a default is set, any command that needs a course offers it first: press ENTER to accept the default, or keep typing to choose a different one. You can change the saved default at any time by running `canvasmagicks course` again.

The course list is cached on disk for one hour; every place that lists courses (this command, `canvasmagicks courses`, and course selection in other commands) reads from that cache.

## page ls

Lists all pages in a course and shows their `slug` (the `url` identifier, used by the `page target` / `page write` commands).

```
canvasmagicks page ls [--course <code>]
```

- `--course <code>` / `-c <code>` — list pages for this course code (e.g. `VT2025-KD413A-K3548`), overriding the saved default course. If omitted, the saved default is offered first.

## page target

Sets the "target" page. Like `canvasmagicks course` does for courses, this pins a page so other commands (notably `page write`) default to it. The target is **persisted for one hour** and is **linked to the course**: if the target course changes, the target page is forgotten.

```
canvasmagicks page target [--course <code>] [--page <slug>]
```

- `--course <code>` / `-c <code>` — choose the page from this course code, overriding the saved default course.
- `--page <slug>` / `-p <slug>` — set the target page directly by its slug, skipping the picker. The slug comes from `canvas page ls`.

When run interactively it loads the course's pages, pins the current target page at the top (press ENTER to keep it), and lets you type to narrow the list. It also offers a **"Create new page…"** choice: picking it prompts for a title and creates a new **unpublished** page in the course, which then becomes the target. The selection is cached on disk (separate from the permanent course default) for one hour, tied to the chosen course.

## page write

Sets a course page's body to the contents of a Markdown file, converting the Markdown to Canvas-appropriate HTML before uploading.

```
canvas page write [--source <path>] [--course <code>] [--page <slug>] [--dry-run]
```

- `--source <path>` / `-s <path>` — path to the Markdown source file (skips the file prompt).
- `--course <code>` / `-c <code>` — update a page in this course code, overriding the saved default course. If omitted, the target course (from `canvas page target`) is offered first.
- `--page <slug>` / `-p <slug>` — update this page slug, skipping the page picker. If omitted, the target page (from `canvas page target`) for the chosen course is offered first.
- `--dry-run` — report which page would be updated (course, page title, source file, and the resulting HTML size) without changing Canvas. Honoured above all else.

Flow when prompts are not skipped: choose a course (defaulting to the target course), choose a page (defaulting to the target page), then provide the Markdown source file. On success the target page is refreshed so subsequent runs keep defaulting to it.

## page export

Exports course page(s) as Markdown files, converting Canvas HTML back to Markdown.

```
canvasmagicks page export [--output <path>] [--course <code>] [--page <slug>] [--dry-run]
```

- `--output <path>` / `-o <path>` — output directory for Markdown files. Created if it doesn't exist. If omitted, you are prompted for the directory.
- `--course <code>` / `-c <code>` — export pages from this course code, overriding the saved default course. If omitted, the target course (from `canvasmagicks page target`) is offered first.
- `--page <slug>` / `-p <slug>` — export a specific page by its slug, skipping the picker. If omitted, the target page (from `canvasmagicks page target`) is exported if set, otherwise all pages for the chosen course are exported.
- `--dry-run` — show which pages would be exported without writing files. Honoured above all else.

Each page is saved as `<slug>.md` (e.g. `about.md`). The slug is the page's `url` identifier as shown by `canvasmagicks page ls`.

Flow when prompts are not skipped: choose a course, then either a specific page or all pages are exported to the chosen output directory.

## calendar download

Fetches calendar events from a Canvas course and writes them locally. Requires authentication (`canvas auth`).

```
canvasmagicks calendar download --output <path> [--course <code>] [--prefix <text>] [--filter-title <text>]
```

- `--course <code>` / `-c <code>` — course code to download from (e.g. `VT2025-KD413A-K3548`). If omitted, you are prompted with the searchable picker (default course pinned).
- `--output <path>` / `-o <path>` — **required** output file. Extension decides format: `.json` writes the full Canvas `CalendarEvent` objects (all fields from `canvas-api.txt:11394` – `location_address`, `effective_context_code`, `context_name`, `all_context_codes`, `hidden`, `parent_event_id`, `child_events`, `url`, `html_url`, `all_day`, `created_at`, `updated_at`, `appointment_group_*`, `important_dates`, `series_*`, `rrule`, `blackout_date`, etc., pretty-printed); `.md` writes a simple Markdown list (`# Calendar Events` + `_Generated …_` + `YYYY-MM-DD Dow HH:MM-HH:MM Title @ location` per event); `.ics` writes a `VCALENDAR` with `VEVENT`s (`SUMMARY` optionally prefixed, `DTSTART`/`DTEND` UTC, `DESCRIPTION`/`LOCATION`). Unsupported extensions error with `Use .json, .md or .ics`.
- `--prefix <text>` — prefix for ICS `SUMMARY` (e.g. `--prefix Private` → `Private Dinner`). Prompted if omitted when writing `.ics` in interactive mode (`Prefix for ICS event summaries (empty for none)`); ignored for `.json`/`.md`.
- `--filter-title <text>` — optional case-insensitive substring filter on `title`. Only events whose title contains the text are exported. Prompted in interactive mode (`Filter by title (substring, empty for all)`); empty means no filter.

Flow: authenticate → resolve course → resolve output → (if `.ics` and interactive prompt prefix) → `GET /api/v1/calendar_events?type=event&all_events=true&context_codes[]=course_<id>` (paginated, like `calendar nuke`/`sync`) → filter to `context_code === course_<id>` and `type==="event"` → write file. If no events, warns `no calendar events found in course '…'` and writes empty file (`[]` for JSON, empty calendar for ICS, `No events found.` for MD). The JSON path uses `CalendarEventFullSchema` (full richness, `.passthrough()`); MD/ICS intentionally use the minimal `CalendarEvent` fields for simpler output.

Examples:

```
canvasmagicks calendar download --output events.json --course VT2025-KD413A-K3548
canvasmagicks calendar download --output events.ics --course VT2025-KD413A-K3548 --prefix Private
canvasmagicks calendar download --output events.md
```

## calendar nuke

Deletes **every calendar event** from a course. This is destructive and irreversible, so it always asks for confirmation.

```
canvasmagicks calendar nuke [--course <code>] [--dry-run]
```

- `--course <code>` / `-c <code>` — nuke the calendar of this course code (e.g. `VT2025-KD413A-K3548`), overriding the saved default course. If omitted, the saved default is offered first.
- `--dry-run` — still prompts for confirmation, but reports how many events would be deleted and makes no changes. Honoured above all else.

Flow: pick a course, see how many calendar events it has, then confirm the deletion. Only actual **calendar events** in that exact course are deleted — assignments/assessments (excluded by the `type=event` filter) and **pages** (a separate API) are never touched. Each candidate event is also re-checked to belong to the chosen course context before it is removed.

## calendar sync

Read-only analysis: shows the difference between a calendar JSON file and a course's Canvas calendar. It never writes to Canvas — it only reports what would change if you re-imported.

```
canvasmagicks calendar sync [--source <path>] [--course <code>]
```

- `--source <path>` / `-s <path>` — read this calendar JSON file instead of prompting.
- `--course <code>` / `-c <code>` — compare against this course code (e.g. `VT2025-KD413A-K3548`), overriding the saved default course. If omitted, the saved default is offered first.

Flow: pick a course (if not given), pick a calendar JSON file (if not given), then the difference is computed and printed. Each result is classified as:

- **ADDED** — a Canvas event with no matching activity in the file (something added on the Canvas side).
- **DELETED** — an activity in the file with no matching Canvas event (something missing from Canvas).
- **UPDATED** — a matched event whose title, description, end time, or location differs. The changed fields are listed, with the current Canvas value and the file's value.

The comparison reuses `calendar import`'s encoding so only genuine edits are reported: event titles are compared against `buildTitle` (which always encodes responsible/involved people), and descriptions are accepted in either the prefixed (`Involved: …`) or plain form. Unchanged events are counted but not listed.

## calendar import

Imports a validated activities JSON file into a Canvas course calendar. After reading the file it prompts for a default location (applied to every activity missing one), a description option, and the target course. Event titles always encode the responsible person (`!Name`) and other participants, so there is no separate title prompt. Existing events are merged or wiped per your choice, with per-conflict resolution.

```
canvasmagicks calendar import [--source <path>] [--course <code>] [--dry-run]
```

- `--source <path>` / `-s <path>` — read this file instead of prompting for the path.
- `--course <code>` / `-c <code>` — import into the course with this course code (e.g. `VT2025-KD413A-K3548`), overriding the saved default course. If omitted, the saved default is offered first (press ENTER to accept, or type to change).
- `--dry-run` — report what would change (add/replace/keep counts) without making any changes to Canvas. The wipe, delete, and staffing-page steps are likewise skipped.

During the preliminary questions you are also asked whether to update a course page whose title starts with `Staffing_` with the schedule overview. If such a page already exists its body is replaced; otherwise a new **unpublished** page named `Staffing_ <course name>` is created. The overview is the same Markdown produced by `canvas calendar translate --output ... .md`, converted to HTML (via the shared Markdown→HTML helper used by `canvas page write`) before being written to the page body.

## exams ls

Lists all assignments in a course (id, name, due date, points, submission types).

```
canvasmagicks exams ls [--course <code>]
```

- `--course <code>` / `-c <code>` — list assignments for this course code, overriding the saved default course. If omitted, the saved default is offered first.

Flow: authenticate → resolve course (pre-selected via `--course` or the saved default) → `GET /api/v1/courses/:course_id/assignments?per_page=100&order_by=due_at` (paginated).

## exams get

Downloads all submissions for one assignment: student names/ids, submission date/time, text body, URL, file attachments, comments, grades, and plagiarism data (`turnitin_data` similarity scores plus any `originality_*`/`vericite` fields the API returns). Read-only; it never grades or modifies Canvas.

```
canvasmagicks exams get [--course <code>] [--assignment <id>] [--exam <id>] [--output <path>] [--attachments <yes|no>]
```

- `--course <code>` / `-c <code>` — course code, overriding the saved default course. If omitted, the saved default is offered first. Required in the sense that a course must be resolved (arg or default) before anything is fetched.
- `--assignment <id>` / `-a <id>` — numeric assignment id (see `canvasmagicks exams ls`). Strictly matched against assignments in the resolved course; unknown ids error without touching other courses. If omitted (and no `--exam`/target), a searchable picker lists the course's assignments.
- `--exam <id>` / `-e <id>` — exam (assignment) id, overriding `--assignment` and the target exam.
- `--output <path>` / `-o <path>` — output file. Extension decides format: `.json` writes the full submission objects (pretty-printed, including `student_name` and `local_files`); `.md` writes one `# <student name>` top-level section per student (sorted by last name) with submission date/time, score, text, URL/files as compact `Url: …` / `File: name (size) [canvas](…)` lines, plagiarism, and comments; `.xlsx` writes an Excel workbook with the exam name as heading, errata rows (generated time, course, submission deadline), a bold column-header row, and one row per student (sorted by last name): student id, name, submitted `Y`/`N` — followed by two totals rows (`Submitted` / `No submission`) using `COUNTIF` formulas over the `Submitted` column, plus a `Submission rate` row dividing the submitted total by the combined total (percentage-formatted). If omitted, you are prompted (`Output file (.json, .md or .xlsx):`); empty input prints the Markdown report to stdout instead of writing a file. Unsupported extensions error with `Use .json, .md or .xlsx`.
- `--attachments <yes|no>` — `yes` downloads every submission attachment to `<output-stem>_files/` next to the output file (named `<userId>_<filename>`, sanitized), referenced as relative `local_files` in JSON and `[local]` links in Markdown; `no` records filenames/URLs/sizes only and creates no directory. If omitted, you are prompted (`Download submission attachments?` Yes/No). Individual download failures warn and keep the remote Canvas URL; the export continues. When printing to stdout (no output file) nothing is downloaded and a warning is printed.

Flow: authenticate → resolve course → resolve assignment (`--exam`, then `--assignment`, then target exam used directly) → resolve attachments choice → `GET /api/v1/courses/:course_id/assignments/:assignment_id/submissions?per_page=100&include[]=user&include[]=submission_comments&include[]=submission_history&include[]=attachments` (paginated) + `GET /api/v1/courses/:course_id/users?enrollment_type=student` to include enrolled students with no submission (marked `Unsubmitted`) → optionally download attachments with the API token → write file or print.

With a fresh target exam set (see `exams target`) and no `--course`/`--exam`/`--assignment` flags, no pickers open at all: the target course and exam are used directly (`Using target course …` / `Using target exam …` is printed). `--course` still overrides the course (and then the target exam no longer applies); `--exam`/`--assignment` still override the exam.

Plagiarism note: the dedicated Originality Report endpoints (`/api/lti/.../originality_report`) require LTI JWT tokens, not user API tokens, so they cannot be fetched here. This command surfaces everything the REST submission payload exposes (`turnitin_data` per file: `similarity_score`, `status`, `state`, overlaps, report URLs; plus any passthrough `originality_*`/`vericite` keys). The schemas use `.passthrough()` so new fields are preserved in `.json` automatically.

Examples:

```
canvasmagicks exams ls --course VT2025-KD413A-K3548
canvasmagicks exams get --course VT2025-KD413A-K3548 --assignment 12345 --output exam.json --attachments no
canvasmagicks exams get --assignment 12345 --output exam.md --attachments yes
```

## exams target

Sets the "target" exam. Like `canvasmagicks course` does for courses (and `page target` for pages), this pins an assignment so `exams get` defaults to it. The target is **persisted for one hour** and is **linked to the course**: if the target course changes, the target exam is forgotten.

```
canvasmagicks exams target [--course <code>] [--exam <id>]
```

- `--course <code>` / `-c <code>` — choose the exam from this course code, overriding the saved default course.
- `--exam <id>` / `-e <id>` — set the target exam directly by its assignment id (e.g. `canvasmagicks exams target --exam 150558`), skipping the picker. The id comes from `canvasmagicks exams ls` and is validated against the resolved course.

When run interactively it loads the course's assignments and lets you type to narrow the list, pinning the current target exam at the top (press ENTER to keep it).

Setting the target exam also saves its course as the global default course (same as running `canvasmagicks course`), so subsequent `exams get` / `exams ls` runs — and other commands — resolve the course without prompting. The target exam itself is what lets `exams get` skip the assignment picker as well.

## students ls

Lists the students enrolled in a course (id, name, login id, enrollment state).

```
canvasmagicks students ls [--course <code>] [--all]
```

- `--course <code>` / `-c <code>` — course code, overriding the saved default course.
- `--all` — include inactive/completed enrollments. By default only active/invited enrollments are listed (Canvas's default `enrollment_state` filter on the users endpoint).

Flow: authenticate → resolve course (target student's course if a fresh target exists, else `--course` or saved default) → `GET /api/v1/courses/:course_id/users?enrollment_type[]=student&include[]=enrollments&include[]=email` (paginated).

## students export

Exports the course roster — or a single student — to JSON, Markdown or Excel.

```
canvasmagicks students export [--course <code>] [--student <id>] [--all] [--output <path>]
```

- `--course <code>` / `-c <code>` — course code, overriding the saved default course.
- `--student <id>` / `-s <id>` — numeric student user id, overriding the target student. If omitted, exports the target student (if a fresh one is set) or otherwise the whole roster.
- `--all` — include inactive/completed enrollments.
- `--output <path>` / `-o <path>` — output file. `.json` writes the full student objects (pretty-printed, passthrough fields preserved); `.md` writes one `## <name>` section per student (sorted by last name) with user id, login, email, SIS id and enrollment state; `.xlsx` writes a header row followed by one row per student. If omitted, you are prompted; empty input prints the Markdown report to stdout. Unsupported extensions error with `Use .json, .md or .xlsx`.

Flow: authenticate → resolve course → `GET .../users` (as in `students ls`) → narrow to one student via `--student`, else the target student, else the full list → write file or print.

## students target

Sets the "target" student — like `exams target` does for assignments — so `students export` defaults to it. Persisted for one hour, linked to the course.

```
canvasmagicks students target [--course <code>] [--student <id>]
```

- `--course <code>` / `-c <code>` — choose the student from this course code, overriding the saved default course.
- `--student <id>` / `-s <id>` — set the target student directly by user id, skipping the picker.

Setting the target student also saves its course as the global default course, and clears any target exam/page/group set bound to a different course (see `canvasmagicks course`).

## groups ls

Lists the groups within one group set (group category), with member names.

```
canvasmagicks groups ls [--course <code>] [--category <id>]
```

- `--course <code>` / `-c <code>` — course code, overriding the saved default course.
- `--category <id>` — numeric group set id, overriding the target group set. If omitted, uses the target group set (if fresh) or opens a searchable picker over the course's group sets.

Flow: authenticate → resolve course → resolve group set (`--category`, else target, else picker) → `GET /api/v1/group_categories/:group_category_id/groups?per_page=100` (paginated) → `GET /api/v1/groups/:group_id/users?per_page=100` for each group (paginated; a failure on one group warns and falls back to its member count).

## groups export

Exports one group set's groups and members to JSON, Markdown or Excel.

```
canvasmagicks groups export [--course <code>] [--category <id>] [--output <path>]
```

- `--course <code>` / `-c <code>` — course code, overriding the saved default course.
- `--category <id>` — group set id, same resolution as `groups ls`.
- `--output <path>` / `-o <path>` — output file. `.json` writes each group with its `members` array embedded; `.md` writes one `## <group name>` section per group (sorted by name) listing members; `.xlsx` writes one row per (group, member) pair. If omitted, you are prompted; empty input prints the Markdown report to stdout.

Flow: resolve course and group set as in `groups ls` → list the group set's groups → `GET /api/v1/groups/:group_id/users?per_page=100` for each group (paginated; a failure on one group warns and records it as having no members rather than aborting the export) → write file or print.

## groups target

Sets the "target" group set — like `exams target` does for assignments — so `groups ls`/`groups export` default to it. Persisted for one hour, linked to the course.

```
canvasmagicks groups target [--course <code>] [--category <id>]
```

- `--course <code>` / `-c <code>` — choose the group set from this course code, overriding the saved default course.
- `--category <id>` — set the target group set directly by id, skipping the picker.

Setting the target group set also saves its course as the global default course, and clears any target exam/page/student bound to a different course.

## groups create

Creates a new group set (group category) in a course and auto-assigns its active students to newly created groups. The only assignment strategy today is **jumble**: a randomized algorithm that tries to avoid putting two students in the same group if they've already shared a group in one or more existing group sets you choose as "history". This command writes real data to Canvas (a group category, groups, and group memberships) and always asks for confirmation before doing so, unless `--dry-run` is given.

```
canvasmagicks groups create [--course <code>] [--name <text>] [--group-size <n> | --group-count <n>] [--group-prefix <text>] [--history <ids>] [--dry-run]
```

- `--course <code>` / `-c <code>` — course code, overriding the saved default course.
- `--name <text>` — name for the new group set. Prompted if omitted.
- `--group-size <n>` — target number of students per group; the number of groups is `ceil(activeStudents / n)`, with the remainder spread across the first groups so sizes differ by at most one.
- `--group-count <n>` — number of groups directly, overriding `--group-size`; students are divided as evenly as possible. If it exceeds the number of active students, it's clamped down (one student per group).
- If neither `--group-size` nor `--group-count` is given, you're first asked to choose "by students per group" or "by number of groups", then prompted for the number.
- `--group-prefix <text>` — name prefix for created groups (default `Group`), giving `Group 1`, `Group 2`, ... in assignment order.
- `--history <ids>` — comma-separated ids of existing group sets in the course whose group memberships count as "have already been grouped together". Unknown ids are ignored with a warning. Pass an empty string (`--history ""`) to opt out of history entirely (pure random jumble). If omitted, and the course has existing group sets, you're shown a checklist of them (all checked by default) to choose which ones count.
- `--dry-run` — prints the planned group set name, size, and the proposed groups (with member names) and the number of unavoidable repeat pairings, then stops. No confirmation prompt is shown and nothing is created in Canvas.

Only **active students** (`students ls`'s default enrollment-state filter — active/invited) are considered; inactive/completed enrollments are never auto-assigned to a group.

Flow: authenticate → resolve course → resolve/prompt group set name → list active students (`GET .../courses/:course_id/users?enrollment_type[]=student`) → resolve group sizing → resolve history group sets (`--history`, else a checklist over `GET .../courses/:course_id/group_categories`) → for each selected history group set, list its groups and each group's members (`GET .../group_categories/:id/groups`, `GET .../groups/:id/users`) to build the set of student pairs that have already been grouped → run the jumble algorithm (up to 200 randomized greedy passes, keeping the one with fewest repeat pairings; stops early at zero) → print the plan and, if not `--dry-run`, ask for confirmation → on confirmation: `POST /api/v1/courses/:course_id/group_categories` (flat `name` param, not nested), then for each planned group `POST /api/v1/group_categories/:group_category_id/groups` (flat `name`), then for each student `POST /api/v1/groups/:group_id/memberships` (flat `user_id`). Per-student membership failures warn and are counted but don't stop the run; the final summary reports how many groups and memberships succeeded.

Note on optimality: with few existing group sets and generously-sized new groups, zero repeat pairings is often impossible by pigeonhole (e.g. reshuffling 12 students from 3 groups of 4 into 3 new groups of 4 always forces at least 3 repeat pairs) — the reported conflict count is the best the algorithm found across its attempts, not necessarily provably optimal, but observed to reach the true minimum on small cases.

Examples:

```
canvasmagicks groups create --course VT2025-KD413A-K3548 --name "Project groups" --group-size 4
canvasmagicks groups create --name "Lab groups" --group-count 6 --history ""
canvasmagicks groups create --name "Sprint 2 groups" --group-size 3 --history 41,42 --dry-run
```
