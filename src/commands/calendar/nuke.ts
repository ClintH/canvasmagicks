import { command, flag, option, optional, string } from "cmd-ts";
import { confirm } from "@inquirer/prompts";
import { loadConfig } from "../../lib/config";
import { resolveCourse } from "../../lib/course";
import { listCourseEvents, deleteEvent, type CalendarEvent } from "../../lib/calendar";

const courseContext = (id: string | number) => `course_${id}`;

interface RunOptions {
  dryRun: boolean;
  course?: string;
}

function eventsToDelete(
  events: CalendarEvent[],
  contextCode: string,
): CalendarEvent[] {
  return events.filter(
    (e) => e.context_code === contextCode && (e.type ?? "event") === "event",
  );
}

export async function runCalendarNuke(opts: RunOptions): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.error("Not authenticated. Run `canvas auth` first.");
    process.exitCode = 1;
    return;
  }

  const resolved = await resolveCourse(config, { courseArg: opts.course });
  if (!resolved) {
    console.error("No course selected.");
    process.exitCode = 1;
    return;
  }
  const courseId = resolved.id;
  const courseName = resolved.course.name;
  const contextCode = courseContext(courseId);

  let all: CalendarEvent[];
  try {
    all = await listCourseEvents(config, courseId);
  } catch (err) {
    console.error(`Failed to load events: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

  const events = eventsToDelete(all, contextCode);
  const n = events.length;

  console.log(`Found ${n} calendar event(s) in course '${courseName}'.`);
  if (n === 0) {
    console.log("Nothing to delete.");
    return;
  }

  const proceed = await confirm({
    message: `Delete ${n} calendar event(s) from '${courseName}'? This cannot be undone.`,
    default: false,
  });

  if (opts.dryRun) {
    console.log(
      `[dry-run] Would delete ${n} event(s) from course '${courseName}'. No changes made.`,
    );
    return;
  }

  if (!proceed) {
    console.log("Aborted. No changes made.");
    return;
  }

  let deleted = 0;
  for (const ev of events) {
    if (ev.context_code !== contextCode) continue;
    await deleteEvent(config, ev.id);
    deleted++;
  }

  console.log(`Deleted ${deleted} calendar event(s) from course '${courseName}'.`);
}

export const calendarNuke = command({
  name: "nuke",
  description: "Delete all calendar events from a course.",
  args: {
    dryRun: flag({
      long: "dry-run",
      description:
        "Report how many events would be deleted without making any changes.",
    }),
    course: option({
      type: optional(string),
      long: "course",
      short: "c",
      description:
        "Course code to nuke (e.g. VT2025-KD413A-K3548), overriding the default course.",
    }),
  },
  handler: async ({ dryRun, course }) => {
    await runCalendarNuke({ dryRun, course });
  },
});
