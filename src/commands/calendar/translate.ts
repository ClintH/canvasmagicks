import { command, option, optional, string } from "cmd-ts";
import { ExistingPath } from "cmd-ts/batteries/fs";
import { input } from "@inquirer/prompts";
import { readFile, writeFile } from "node:fs/promises";
import { parseActivities, type Activity } from "../../lib/activities";
import { renderMarkdown } from "../../lib/markdown";
import { renderIcal } from "../../util/ical";

function parseWho(raw?: string): { original: string[]; lower: string[] } {
  if (!raw || raw.trim() === "") return { original: [], lower: [] };
  const original = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const lower = original.map((s) => s.toLowerCase());
  return { original, lower };
}

function filterByWho(activities: Activity[], whoLower: string[]): Activity[] {
  if (whoLower.length === 0) return activities;
  const set = new Set(whoLower);
  return activities.filter((a) => {
    const responsible = (a.responsible ?? "").trim().toLowerCase();
    if (responsible && set.has(responsible)) return true;
    for (const inv of a.involved) {
      if (set.has(inv.trim().toLowerCase())) return true;
    }
    return false;
  });
}

function findMissingNames(activities: Activity[], whoLower: string[]): Set<string> {
  const present = new Set<string>();
  for (const a of activities) {
    const r = (a.responsible ?? "").trim().toLowerCase();
    if (r) present.add(r);
    for (const inv of a.involved) present.add(inv.trim().toLowerCase());
  }
  const missing = new Set<string>();
  for (const n of whoLower) {
    if (!present.has(n)) missing.add(n);
  }
  return missing;
}

function buildMarkdownWithEmptyWarning(
  filtered: Activity[],
  whoOriginal: string[],
  filterTitle?: string,
): string {
  if (filtered.length > 0) return renderMarkdown(filtered);
  const base = renderMarkdown([]);
  const parts: string[] = [];
  if (whoOriginal.length > 0) parts.push(whoOriginal.join(", "));
  if (filterTitle?.trim()) parts.push(`title contains '${filterTitle.trim()}'`);
  const warning = parts.length > 0 ? `No activities matched filter: ${parts.join(", ")}` : "No activities matched filter.";
  // Insert warning after _Generated line
  const lines = base.split("\n");
  const genIdx = lines.findIndex((l) => l.startsWith("_Generated"));
  if (genIdx !== -1) {
    lines.splice(genIdx + 1, 0, "", warning);
    return lines.join("\n");
  }
  return `${base}\n${warning}\n`;
}

function filterByTitle<T extends { title: string }>(items: T[], filterTitle?: string): T[] {
  const needle = filterTitle?.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((i) => i.title.toLowerCase().includes(needle));
}

export async function runCalendarTranslate(opts: {
  source?: string;
  output?: string;
  who?: string;
  prefix?: string;
  filterTitle?: string;
} = {}): Promise<void> {
  const needsInteractive = opts.source === undefined || opts.output === undefined;
  const filePath =
    opts.source ??
    (await input({
      message: "Path to the calendar JSON file:",
      default: "example/schedule.json",
    }));

  if (!filePath || filePath.trim() === "") {
    console.error("No source file provided.");
    process.exitCode = 1;
    return;
  }

  let outputPath = opts.output;
  if (outputPath === undefined || outputPath.trim() === "") {
    outputPath = await input({
      message: "Output file (.md or .ics):",
    });
  }

  if (!outputPath || outputPath.trim() === "") {
    console.error("No output file provided. Use --output <path> with .md or .ics extension.");
    process.exitCode = 1;
    return;
  }
  outputPath = outputPath.trim();

  let whoRaw = opts.who;
  if (whoRaw === undefined && needsInteractive) {
    whoRaw = await input({
      message: "Filter by who (comma-separated names, empty for all):",
      default: "",
    });
  }

  const { original: whoOriginal, lower: whoLower } = parseWho(whoRaw);

  let filterTitle = opts.filterTitle;
  if (filterTitle === undefined && needsInteractive) {
    filterTitle = await input({
      message: "Filter by title (substring, empty for all):",
      default: "",
    });
  }
  const cleanFilterTitle = filterTitle?.trim() ?? "";

  const lowerExt = outputPath.toLowerCase();
  const isMd = lowerExt.endsWith(".md");
  const isIcs = lowerExt.endsWith(".ics");
  if (!isMd && !isIcs) {
    console.error(`Unsupported output extension for '${outputPath}'. Use .md for Markdown or .ics for iCal.`);
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

  const total = parsed.data.length;
  let filtered = filterByWho(parsed.data, whoLower);
  filtered = filterByTitle(filtered, cleanFilterTitle);

  if (whoLower.length > 0) {
    const missing = findMissingNames(parsed.data, whoLower);
    for (const m of missing) {
      const display = whoOriginal[whoLower.indexOf(m)] ?? m;
      console.warn(`Warning: no entries for '${display}'`);
    }
    if (filtered.length === 0) {
      console.warn(`Warning: filter matched 0 activities (requested: ${whoOriginal.join(", ")})`);
    }
  }
  if (cleanFilterTitle && filtered.length === 0) {
    console.warn(`Warning: filter-title '${cleanFilterTitle}' matched 0 activities`);
  }

  let content: string;
  if (isMd) {
    content = buildMarkdownWithEmptyWarning(filtered, whoOriginal, cleanFilterTitle);
  } else {
    content = renderIcal(filtered, cleanPrefix);
  }

  try {
    await writeFile(outputPath, content, "utf8");
  } catch (e) {
    console.error(`Could not write file: ${(e as Error).message}`);
    process.exitCode = 1;
    return;
  }

  if (whoLower.length > 0) {
    console.log(`Wrote ${outputPath} (${filtered.length}/${total} activities, filtered by ${whoOriginal.join(", ")})`);
  } else {
    console.log(`Wrote ${outputPath} (${filtered.length} activities)`);
  }
}

export const calendarTranslate = command({
  name: "translate",
  description: "Translate a calendar JSON file to Markdown (.md) or iCal (.ics), optionally filtered by who.",
  args: {
    source: option({
      type: optional(ExistingPath),
      long: "source",
      short: "s",
      description: "Path to the calendar JSON file (skips the file prompt).",
    }),
    output: option({
      type: optional(string),
      long: "output",
      short: "o",
      description: "Output file path. Use .md for Markdown or .ics for iCal (required; prompts if omitted).",
    }),
    who: option({
      type: optional(string),
      long: "who",
      description: "Comma-separated list of names to filter by (responsible or involved, case-insensitive).",
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
  handler: async ({ source, output, who, prefix, filterTitle }) => {
    await runCalendarTranslate({ source, output, who, prefix, filterTitle });
  },
});
