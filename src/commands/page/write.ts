import { command, flag, option, optional, string } from "cmd-ts";
import { ExistingPath } from "cmd-ts/batteries/fs";
import { input } from "@inquirer/prompts";
import { readFile } from "node:fs/promises";
import { loadConfig } from "../../lib/config";
import { resolveCourse } from "../../lib/course";
import { markdownToHtml } from "../../lib/markdown";
import {
  listPages,
  findPageBySlug,
  updatePage,
} from "../../lib/pages";
import {
  getTargetPage,
  getActiveTargetPage,
  setTargetPage,
} from "../../lib/target-page";
import { searchPick, type PickItem } from "../../lib/picker";

interface RunOptions {
  source?: string;
  course?: string;
  page?: string;
  dryRun: boolean;
}

export async function runPageWrite(opts: RunOptions): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.error("Not authenticated. Run `canvas auth` first.");
    process.exitCode = 1;
    return;
  }

  const activeTarget = await getActiveTargetPage();
  const resolved = await resolveCourse(config, {
    courseArg: opts.course,
    preferredDefaultCourseId: activeTarget?.courseId ?? config.defaultCourseId,
  });
  if (!resolved) {
    console.error("No course selected.");
    process.exitCode = 1;
    return;
  }
  const courseId = resolved.id;

  let pages;
  try {
    pages = await listPages(config, courseId);
  } catch (err) {
    console.error(`Failed to load pages: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }
  if (pages.length === 0) {
    console.error("This course has no pages to update.");
    process.exitCode = 1;
    return;
  }

  const target = await getTargetPage(courseId);

  let pageSlug: string;
  if (opts.page !== undefined && opts.page.trim() !== "") {
    const found = findPageBySlug(pages, opts.page.trim());
    if (!found) {
      console.error(`No page found with slug '${opts.page}' in this course.`);
      process.exitCode = 1;
      return;
    }
    pageSlug = found.url;
  } else {
    const defaultPage = target ? findPageBySlug(pages, target.pageSlug) : undefined;
    const items: PickItem<string>[] = pages.map((p) => ({
      label: `${p.title} (${p.url})`,
      value: p.url,
    }));
    const defaultItem = defaultPage
      ? { label: `${defaultPage.title} (${defaultPage.url})`, value: defaultPage.url }
      : undefined;
    const picked = await searchPick(items, {
      message: "Select the page to update:",
      defaultItem,
    });
    if (picked === null) {
      console.error("No page selected.");
      process.exitCode = 1;
      return;
    }
    pageSlug = picked;
  }

  const filePath =
    opts.source ??
    (await input({ message: "Path to the Markdown source file:" }));
  if (!filePath || filePath.trim() === "") {
    console.error("No source file provided.");
    process.exitCode = 1;
    return;
  }

  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (e) {
    console.error(`Could not read file: ${(e as Error).message}`);
    process.exitCode = 1;
    return;
  }

  const html = await markdownToHtml(text);
  const page = findPageBySlug(pages, pageSlug);

  if (opts.dryRun) {
    console.log(
      `[dry-run] Would set the body of page '${page?.title ?? pageSlug}' (${pageSlug}) ` +
        `in course ${courseId} from '${filePath}' (${html.length} chars of HTML). ` +
        `No changes made.`,
    );
    return;
  }

  await updatePage(config, courseId, page!.url, { body: html });
  await setTargetPage(courseId, pageSlug);
  console.log(
    `Updated page '${page?.title ?? pageSlug}' (${pageSlug}) in course ${courseId}.`,
  );
}

export const pageWrite = command({
  name: "write",
  description: "Set a course page's body to a Markdown file (converted to HTML).",
  args: {
    source: option({
      type: optional(ExistingPath),
      long: "source",
      short: "s",
      description: "Path to the Markdown source file (skips the file prompt).",
    }),
    course: option({
      type: optional(string),
      long: "course",
      short: "c",
      description:
        "Course code to update the page in (e.g. VT2025-KD413A-K3548), overriding the default course.",
    }),
    page: option({
      type: optional(string),
      long: "page",
      short: "p",
      description: "Page slug to update, skipping the page picker.",
    }),
    dryRun: flag({
      long: "dry-run",
      description:
        "Report which page would be updated without changing Canvas.",
    }),
  },
  handler: async ({ source, course, page, dryRun }) => {
    await runPageWrite({ source, course, page, dryRun });
  },
});
