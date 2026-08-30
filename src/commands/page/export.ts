import { command, flag, option, optional, string } from "cmd-ts";
import { Directory } from "cmd-ts/batteries/fs";
import { input } from "@inquirer/prompts";
import { mkdir, writeFile } from "node:fs/promises";
import { loadConfig } from "../../lib/config";
import { resolveCourse } from "../../lib/course";
import { htmlToMarkdown } from "../../lib/markdown";
import { getPage, listPages, type CanvasPage } from "../../lib/pages";
import { getTargetPage, getActiveTargetPage } from "../../lib/target-page";

interface RunOptions {
  output?: string;
  course?: string;
  page?: string;
  dryRun: boolean;
}

async function exportPages(
  config: Awaited<ReturnType<typeof loadConfig>>,
  courseId: number,
  courseName: string,
  pages: CanvasPage[],
  outputDir: string,
  dryRun: boolean,
): Promise<void> {
  if (pages.length === 0) {
    console.log(`Course '${courseName}' has no pages to export.`);
    return;
  }

  if (dryRun) {
    console.log(`[dry-run] Would export ${pages.length} page(s) to '${outputDir}':`);
    for (const p of pages) {
      console.log(`  - ${p.url}.md (${p.title ?? "untitled"})`);
    }
    return;
  }

  await mkdir(outputDir, { recursive: true });

  for (const p of pages) {
    const filePath = `${outputDir}/${p.url}.md`;
    if (p.body) {
      const markdown = htmlToMarkdown(p.body);
      await writeFile(filePath, markdown, "utf8");
      console.log(`Exported '${p.title ?? p.url}' -> ${filePath}`);
    } else {
      console.warn(`Warning: Page '${p.title ?? p.url}' has no body, skipping.`);
    }
  }
}

export async function runPageExport(opts: RunOptions): Promise<void> {
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

  let pages: CanvasPage[];

  if (opts.page !== undefined && opts.page.trim() !== "") {
    const pageSlug = opts.page.trim();
    try {
      const page = await getPage(config, courseId, pageSlug);
      pages = [page];
    } catch (err) {
      console.error(`Failed to load page '${pageSlug}': ${(err as Error).message}`);
      process.exitCode = 1;
      return;
    }
  } else {
    const target = await getTargetPage(courseId);
    if (target) {
      try {
        const page = await getPage(config, courseId, target.pageSlug);
        pages = [page];
      } catch (err) {
        console.error(`Failed to load target page '${target.pageSlug}': ${(err as Error).message}`);
        process.exitCode = 1;
        return;
      }
    } else {
      try {
        pages = await listPages(config, courseId);
      } catch (err) {
        console.error(`Failed to load pages: ${(err as Error).message}`);
        process.exitCode = 1;
        return;
      }

      if (pages.length === 0) {
        console.log(`Course '${resolved.course.name}' has no pages.`);
        return;
      }
    }
  }

  const outputDir =
    opts.output ??
    (await input({ message: "Output directory for Markdown files:" }));

  if (!outputDir || outputDir.trim() === "") {
    console.error("No output directory provided.");
    process.exitCode = 1;
    return;
  }

  await exportPages(config, courseId, resolved.course.name, pages, outputDir.trim(), opts.dryRun);
}

export const pageExport = command({
  name: "export",
  description: "Export page(s) as Markdown files.",
  args: {
    output: option({
      type: optional(Directory),
      long: "output",
      short: "o",
      description: "Output directory for Markdown files.",
    }),
    course: option({
      type: optional(string),
      long: "course",
      short: "c",
      description:
        "Course code to export pages from (e.g. VT2025-KD413A-K3548), overriding the default course.",
    }),
    page: option({
      type: optional(string),
      long: "page",
      short: "p",
      description: "Export a specific page by slug, skipping the picker.",
    }),
    dryRun: flag({
      long: "dry-run",
      description: "Show which pages would be exported without writing files.",
    }),
  },
  handler: async ({ output, course, page, dryRun }) => {
    await runPageExport({ output, course, page, dryRun });
  },
});
