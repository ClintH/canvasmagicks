import { command, option, optional } from "cmd-ts";
import { ExistingPath } from "cmd-ts/batteries/fs";
import { input } from "@inquirer/prompts";
import { readFile, writeFile } from "node:fs/promises";
import { parseActivities } from "../../lib/activities";
import { renderMarkdown } from "../../lib/markdown";

export async function runCalendarImportMarkdown(opts: { source?: string } = {}): Promise<void> {
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

  const md = renderMarkdown(parsed.data);
  const outPath = filePath.replace(/\.json$/i, "") + ".md";
  await writeFile(outPath, md, "utf8");
  console.log(`Wrote ${outPath}`);
}

export const calendarImportMarkdown = command({
  name: "import-markdown",
  description: "Convert a calendar JSON file into a Markdown summary.",
  args: {
    source: option({
      type: optional(ExistingPath),
      long: "source",
      short: "s",
      description: "Path to the calendar JSON file (skips the file prompt).",
    }),
  },
  handler: async ({ source }) => {
    await runCalendarImportMarkdown({ source });
  },
});
