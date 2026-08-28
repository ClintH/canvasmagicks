import { command, option, optional, string } from "cmd-ts";
import { ExistingPath } from "cmd-ts/batteries/fs";
import { input } from "@inquirer/prompts";
import { readFile } from "node:fs/promises";
import { loadConfig } from "../../lib/config";
import { parseActivities } from "../../lib/activities";
import { listCourseEvents } from "../../lib/calendar";
import { resolveCourse } from "../../lib/course";
import { analyzeCalendarSync, type SyncChange } from "../../lib/sync";

interface RunOptions {
  source?: string;
  course?: string;
}

function printChange(change: SyncChange): void {
  const when = `${change.date} ${change.startTime}`;
  if (change.kind === "updated" && change.fieldChanges) {
    const fields = change.fieldChanges.map((f) => f.field).join(", ");
    console.log(`UPDATED  ${when}  ${change.title}         (${fields})`);
    for (const fc of change.fieldChanges) {
      console.log(`        Canvas: '${fc.from}'`);
      console.log(`          JSON: '${fc.to}'`);
    }
    return;
  }
  const tag = change.kind === "added" ? "ADDED  " : "DELETED";
  console.log(`${tag}  ${when}  ${change.title}`);
}

export async function runCalendarSync(opts: RunOptions): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.error("Not authenticated. Run `canvas auth` first.");
    process.exitCode = 1;
    return;
  }

  const filePath =
    opts.source ??
    (await input({
      message: "Path to the calendar JSON file:",
      default: "example/schedule.json",
    }));
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (e) {
    console.error(`Could not read file: ${(e as Error).message}`);
    process.exitCode = 1;
    return;
  }

  const parsed = parseActivities(text);
  if (!parsed.ok) {
    console.error("Invalid calendar data:");
    for (const issue of parsed.issues) {
      console.error(`  - Activity ${issue.index}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }
  const activities = parsed.data;

  const resolved = await resolveCourse(config, { courseArg: opts.course });
  if (!resolved) {
    console.error("No course selected.");
    process.exitCode = 1;
    return;
  }
  const courseId = resolved.id;
  const courseName = resolved.course.name;

  let events;
  try {
    events = await listCourseEvents(config, courseId);
  } catch (err) {
    console.error(`Failed to load events: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

  const report = analyzeCalendarSync(activities, events);

  console.log(
    `\nAnalyzing ${activities.length} activities against ${events.length} event(s) in '${courseName}':\n`,
  );

  for (const change of report.changes) {
    printChange(change);
  }

  console.log(
    `\nSummary: ${report.addedCount} added, ${report.deletedCount} deleted, ` +
      `${report.updatedCount} updated (${report.unchangedCount} unchanged).`,
  );
}

export const calendarSync = command({
  name: "sync",
  description: "Show differences between a calendar JSON file and a course's Canvas calendar.",
  args: {
    source: option({
      type: optional(ExistingPath),
      long: "source",
      short: "s",
      description: "Path to the calendar JSON file (skips the file prompt).",
    }),
    course: option({
      type: optional(string),
      long: "course",
      short: "c",
      description:
        "Course code to compare against (e.g. VT2025-KD413A-K3548), overriding the default course.",
    }),
  },
  handler: async ({ source, course }) => {
    await runCalendarSync({ source, course });
  },
});
