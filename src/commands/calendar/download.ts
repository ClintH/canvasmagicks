import { command, option, optional, string } from "cmd-ts";
import { input } from "@inquirer/prompts";
import { writeFile } from "node:fs/promises";
import { loadConfig } from "../../lib/config";
import { resolveCourse } from "../../lib/course";
import { listCourseEventsFull } from "../../lib/calendar";
import {
  renderCalendarEventsMarkdown,
  renderCalendarEventsIcal,
} from "../../util/calendar-event-format";
import type { CalendarEvent } from "../../lib/schemas";

function filterByTitle<T extends { title: string }>(items: T[], filterTitle?: string): T[] {
  const needle = filterTitle?.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((i) => i.title.toLowerCase().includes(needle));
}

export async function runCalendarDownload(opts: {
  course?: string;
  output?: string;
  prefix?: string;
  filterTitle?: string;
} = {}): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.error("Not authenticated. Run `canvas auth` first.");
    process.exitCode = 1;
    return;
  }

  const needsInteractive = opts.course === undefined || opts.output === undefined;

  const resolved = await resolveCourse(config, { courseArg: opts.course });
  if (!resolved) {
    console.error("No course selected.");
    process.exitCode = 1;
    return;
  }

  let outputPath = opts.output;
  if (outputPath === undefined || outputPath.trim() === "") {
    outputPath = await input({
      message: "Output file (.json, .md or .ics):",
    });
  }

  if (!outputPath || outputPath.trim() === "") {
    console.error("No output file provided. Use --output <path> with .json, .md or .ics extension.");
    process.exitCode = 1;
    return;
  }
  outputPath = outputPath.trim();

  const lowerExt = outputPath.toLowerCase();
  const isJson = lowerExt.endsWith(".json");
  const isMd = lowerExt.endsWith(".md");
  const isIcs = lowerExt.endsWith(".ics");
  if (!isJson && !isMd && !isIcs) {
    console.error(`Unsupported output extension for '${outputPath}'. Use .json, .md or .ics.`);
    process.exitCode = 1;
    return;
  }

  let prefix = opts.prefix;
  if (isIcs && prefix === undefined && needsInteractive) {
    prefix = await input({
      message: "Prefix for ICS event summaries (empty for none):",
      default: "",
    });
  }
  const cleanPrefix = prefix?.trim() ?? "";

  let filterTitle = opts.filterTitle;
  if (filterTitle === undefined && needsInteractive) {
    filterTitle = await input({
      message: "Filter by title (substring, empty for all):",
      default: "",
    });
  }
  const cleanFilterTitle = filterTitle?.trim() ?? "";

  let events;
  try {
    events = await listCourseEventsFull(config, resolved.id);
  } catch (err) {
    console.error(`Failed to fetch calendar events: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

  const contextCode = `course_${resolved.id}`;
  let filtered = events.filter((e) => e.context_code === contextCode && (e.type ?? "event") === "event");
  filtered = filterByTitle(filtered, cleanFilterTitle);

  if (filtered.length === 0) {
    if (cleanFilterTitle) {
      console.warn(`Warning: filter-title '${cleanFilterTitle}' matched 0 events in course '${resolved.course.name}'`);
    } else {
      console.warn(`Warning: no calendar events found in course '${resolved.course.name}'`);
    }
  }

  let content: string;
  if (isJson) {
    content = JSON.stringify(filtered, null, 2) + "\n";
  } else if (isMd) {
    content = renderCalendarEventsMarkdown(filtered as CalendarEvent[]);
  } else {
    content = renderCalendarEventsIcal(filtered as CalendarEvent[], cleanPrefix);
  }

  try {
    await writeFile(outputPath, content, "utf8");
  } catch (e) {
    console.error(`Could not write file: ${(e as Error).message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Wrote ${outputPath} (${filtered.length} events from '${resolved.course.name}')`);
}

export const calendarDownload = command({
  name: "download",
  description: "Download calendar events from a course to JSON, Markdown or iCal.",
  args: {
    course: option({
      type: optional(string),
      long: "course",
      short: "c",
      description: "Course code to download from (e.g. VT2025-KD413A-K3548), overriding the default course.",
    }),
    output: option({
      type: optional(string),
      long: "output",
      short: "o",
      description: "Output file path. Use .json for JSON, .md for Markdown or .ics for iCal (required; prompts if omitted).",
    }),
    prefix: option({
      type: optional(string),
      long: "prefix",
      description: "Prefix for ICS event summaries (e.g. --prefix \"Private\" → \"Private <title>\"). Prompted if omitted when writing .ics.",
    }),
    filterTitle: option({
      type: optional(string),
      long: "filter-title",
      description: "Only export events whose title contains this text (case-insensitive substring).",
    }),
  },
  handler: async ({ course, output, prefix, filterTitle }) => {
    await runCalendarDownload({ course, output, prefix, filterTitle });
  },
});
