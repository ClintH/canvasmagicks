import { command, option, optional, string } from "cmd-ts";
import { loadConfig } from "../../lib/config";
import { resolveCourse } from "../../lib/course";
import { listPages } from "../../lib/pages";
import { getActiveTargetPage } from "../../lib/target-page";

export async function runPageLs(opts: { course?: string }): Promise<void> {
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

  try {
    const pages = await listPages(config, resolved.id);
    if (pages.length === 0) {
      console.log(`Course '${resolved.course.name}' has no pages.`);
      return;
    }
    console.log(`Pages in '${resolved.course.name}':`);
    for (const p of pages) {
      const status = p.published ? "published" : "unpublished";
      const name = p.title?.trim() || p.url;
      console.log(`  ${p.url}\t${name}  [${status}]`);
    }
  } catch (err) {
    console.error(`Failed to load pages: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

export const pageLs = command({
  name: "ls",
  description: "List the pages of a course, showing their ids.",
  args: {
    course: option({
      type: optional(string),
      long: "course",
      short: "c",
      description:
        "Course code to list pages for (e.g. VT2025-KD413A-K3548), overriding the default course.",
    }),
  },
  handler: async ({ course }) => {
    await runPageLs({ course });
  },
});
