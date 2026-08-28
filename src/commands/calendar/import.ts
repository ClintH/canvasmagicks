import { command, flag, option, optional, string } from "cmd-ts";
import { ExistingPath } from "cmd-ts/batteries/fs";
import { input, confirm, select } from "@inquirer/prompts";
import { readFile } from "node:fs/promises";
import { loadConfig, patchConfig, type CanvasConfig } from "../../lib/config";
import { renderMarkdown, markdownToHtml } from "../../lib/markdown";
import { listPages, createPage, updatePage } from "../../lib/pages";
import {
  parseActivities,
  buildTitle,
  buildDescription,
  type Activity,
} from "../../lib/activities";
import {
  listCourseEvents,
  createEvent,
  deleteEvent,
  toIso,
  type CalendarEvent,
} from "../../lib/calendar";
import { resolveCourse } from "../../lib/course";

interface RunOptions {
  dryRun: boolean;
  source?: string;
  course?: string;
}

const courseContext = (courseId: string | number) => `course_${courseId}`;

export async function runCalendarImport(opts: RunOptions): Promise<void> {
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

  const missingLocation = activities.filter(
    (a) => !a.location || a.location.trim() === "",
  );
  let defaultLocation = config.defaultLocation ?? "";
  if (missingLocation.length > 0) {
    const entered = await input({
      message: `Default location for ${missingLocation.length} activit(y/ies) without one:`,
      default: defaultLocation,
    });
    defaultLocation = entered.trim();
    for (const a of missingLocation) {
      a.location = defaultLocation;
    }
    if (!opts.dryRun && defaultLocation) {
      await patchConfig({ defaultLocation });
    }
  }

  const prefix = await confirm({
    message: "Prefix involved people to the event description? (e.g. 'Involved: Clint, Jemma')",
    default: true,
  });
  const updateStaffing = await confirm({
    message: "Update a 'Staffing_' page in the course with the schedule overview?",
    default: true,
  });

  const resolved = await resolveCourse(config, { courseArg: opts.course });
  if (!resolved) {
    console.error("No course selected.");
    process.exitCode = 1;
    return;
  }
  const courseId = resolved.id;
  const courseName = resolved.course.name;
  const contextCode = courseContext(courseId);

  let existing = await listCourseEvents(config, courseId);
  let mode: string = "merge";
  if (existing.length > 0) {
    mode = await select({
      message: `Course calendar already has ${existing.length} event(s). Merge or wipe first?`,
      choices: [
        { name: "Merge (keep existing, resolve conflicts)", value: "merge" },
        { name: "Wipe first (delete all existing events in this course)", value: "wipe" },
      ],
    });
  }

  const scope =
    mode === "wipe"
      ? "wipe existing events, then import"
      : "import (merging with existing events)";
  const extra = updateStaffing ? ", and update the staffing page" : "";
  const proceed = await confirm({
    message: `About to ${scope} ${activities.length} activities into the selected course${extra}. Continue?`,
    default: false,
  });
  if (!proceed) {
    console.log("Aborted. No changes were made.");
    return;
  }

  if (mode === "wipe") {
    const confirmWipe = await confirm({
      message: `Delete ${existing.length} event(s) from this course? This cannot be undone.`,
      default: false,
    });
    if (!confirmWipe) {
      console.log("Aborted. No changes made.");
      return;
    }
    if (opts.dryRun) {
      console.log(`[dry-run] Would delete ${existing.length} event(s).`);
    } else {
      let deleted = 0;
      for (const ev of existing) {
        if (ev.context_code !== contextCode) continue;
        await deleteEvent(config, ev.id);
        deleted++;
      }
      console.log(`Deleted ${deleted} event(s).`);
    }
    existing = [];
  }

  let added = 0;
  let replaced = 0;
  let kept = 0;

  for (const activity of activities) {
    const title = buildTitle(activity);
    const description = buildDescription(activity, prefix);
    const startAt = toIso(activity.date, activity.startTime);
    const endAt = toIso(activity.date, activity.endTime);
    const locationName = activity.location ?? defaultLocation;

    const matchIdx = existing.findIndex(
      (ev) => new Date(ev.start_at).getTime() === new Date(startAt).getTime(),
    );

    if (matchIdx !== -1) {
      const match = existing[matchIdx];
      existing.splice(matchIdx, 1);

      if (match.title === title) {
        if (opts.dryRun) {
          console.log(`[dry-run] Would replace '${title}' at ${activity.date} ${activity.startTime}.`);
        } else {
          await deleteEvent(config, match.id);
          await createEvent(config, { context_code: contextCode, title, description, start_at: startAt, end_at: endAt, location_name: locationName });
        }
        replaced++;
        continue;
      }

      const choice = await select({
        message: `Conflict at ${activity.date} ${activity.startTime}: keep existing, replace, or keep both?`,
        choices: [
          { name: `Keep existing: '${match.title}'`, value: "keep" },
          { name: `Replace with new: '${title}'`, value: "replace" },
          { name: "Use both (add new alongside existing)", value: "both" },
        ],
      });

      if (choice === "keep") {
        kept++;
        continue;
      }
      if (choice === "replace") {
        if (opts.dryRun) {
          console.log(`[dry-run] Would replace '${match.title}' with '${title}'.`);
        } else {
          await deleteEvent(config, match.id);
          await createEvent(config, { context_code: contextCode, title, description, start_at: startAt, end_at: endAt, location_name: locationName });
        }
        replaced++;
        continue;
      }
      if (opts.dryRun) {
        console.log(`[dry-run] Would add '${title}' alongside existing.`);
      } else {
        await createEvent(config, { context_code: contextCode, title, description, start_at: startAt, end_at: endAt, location_name: locationName });
      }
      added++;
      continue;
    }

    if (opts.dryRun) {
      console.log(`[dry-run] Would add '${title}' at ${activity.date} ${activity.startTime}.`);
    } else {
      await createEvent(config, { context_code: contextCode, title, description, start_at: startAt, end_at: endAt, location_name: locationName });
    }
    added++;
  }

  if (opts.dryRun) {
    console.log(
      `\n[dry-run] Summary: would add ${added}, replace ${replaced}, keep ${kept}. No changes made.`,
    );
  } else {
    console.log(`\nDone. Added ${added} new, replaced ${replaced}, kept ${kept} existing.`);
  }

  if (updateStaffing) {
    const overview = renderMarkdown(activities);
    try {
      await syncStaffingPage(config, courseId, courseName, overview, opts.dryRun);
    } catch (e) {
      console.error(`Failed to update staffing page: ${(e as Error).message}`);
      process.exitCode = 1;
    }
  }
}

const STAFFING_PREFIX = "Staffing_";

async function syncStaffingPage(
  config: CanvasConfig,
  courseId: number | string,
  courseName: string,
  markdown: string,
  dryRun: boolean,
): Promise<void> {
  const html = await markdownToHtml(markdown);
  const pages = await listPages(config, courseId);
  const existing = pages.find((p) => p.title.startsWith(STAFFING_PREFIX));
  if (existing) {
    if (dryRun) {
      console.log(`[dry-run] Would update staffing page '${existing.title}'.`);
      return;
    }
    await updatePage(config, courseId, existing.url, { body: html });
    console.log(`Updated staffing page '${existing.title}'.`);
    return;
  }

  const title = `${STAFFING_PREFIX}${courseName}`;
  if (dryRun) {
    console.log(`[dry-run] Would create staffing page '${title}' (unpublished).`);
    return;
  }
  const created = await createPage(config, courseId, { title, body: html, published: false });
  console.log(`Created staffing page '${created.title}' (unpublished).`);
}

export const calendarImport = command({
  name: "import",
  description: "Import a course calendar from a JSON file.",
  args: {
    dryRun: flag({
      long: "dry-run",
      description: "Report what would change without making any changes.",
    }),
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
        "Course code to import into (e.g. VT2025-KD413A-K3548), overriding the default course.",
    }),
  },
  handler: async ({ dryRun, source, course }) => {
    await runCalendarImport({ dryRun, source, course });
  },
});
