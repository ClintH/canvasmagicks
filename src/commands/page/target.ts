import { command, option, optional, string } from "cmd-ts";
import { input } from "@inquirer/prompts";
import { loadConfig } from "../../lib/config";
import { resolveCourse } from "../../lib/course";
import { listPages, findPageBySlug, createPage } from "../../lib/pages";
import { getTargetPage, setTargetPage } from "../../lib/target-page";
import { searchPick, type PickItem } from "../../lib/picker";

const CREATE_NEW_PAGE = "__create_new_page__";

export async function runPageTarget(opts: {
  course?: string;
  page?: string;
}): Promise<void> {
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

  let pages;
  try {
    pages = await listPages(config, courseId);
  } catch (err) {
    console.error(`Failed to load pages: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

  if (pages.length === 0) {
    console.log("This course has no pages to target.");
    process.exitCode = 1;
    return;
  }

  let pageSlug: string;

  if (opts.page !== undefined && opts.page.trim() !== "") {
    const found = findPageBySlug(pages, opts.page.trim());
    if (!found) {
      console.error(
        `No page found with slug '${opts.page}' in this course.`,
      );
      process.exitCode = 1;
      return;
    }
    pageSlug = found.url;
  } else {
    const target = await getTargetPage(courseId);
    const defaultPage = target
      ? findPageBySlug(pages, target.pageSlug)
      : undefined;

    const items: PickItem<string>[] = [
      { label: "✚ Create new page…", value: CREATE_NEW_PAGE },
      ...pages.map((p) => ({
        label: `${p.title} (${p.url})`,
        value: p.url,
      })),
    ];
    const defaultItem = defaultPage
      ? { label: `${defaultPage.title} (${defaultPage.url})`, value: defaultPage.url }
      : undefined;

    const picked = await searchPick(items, {
      message: "Select the target page:",
      defaultItem,
    });
    if (picked === null) {
      console.error("No page selected.");
      process.exitCode = 1;
      return;
    }

    if (picked === CREATE_NEW_PAGE) {
      const title = await input({ message: "Title for the new page:" });
      if (!title.trim()) {
        console.error("No title provided; page not created.");
        process.exitCode = 1;
        return;
      }
      try {
        const created = await createPage(config, courseId, {
          title: title.trim(),
          body: "",
          published: false,
        });
        pageSlug = created.url;
      } catch (err) {
        console.error(`Failed to create page: ${(err as Error).message}`);
        process.exitCode = 1;
        return;
      }
    } else {
      pageSlug = picked;
    }
  }

  await setTargetPage(courseId, pageSlug);
  const page = findPageBySlug(pages, pageSlug);
  if (!page) {
    console.log(
      `Target page set to new page '${pageSlug}' for course ${courseId}. Valid for 1 hour.`,
    );
  } else {
    console.log(
      `Target page set to '${page.title}' (${pageSlug}) for course ${courseId}. Valid for 1 hour.`,
    );
  }
}

export const pageTarget = command({
  name: "target",
  description:
    "Set the target page (persisted for an hour, linked to the course).",
  args: {
    course: option({
      type: optional(string),
      long: "course",
      short: "c",
      description:
        "Course code to choose the page from (e.g. VT2025-KD413A-K3548), overriding the default course.",
    }),
    page: option({
      type: optional(string),
      long: "page",
      short: "p",
      description: "Page slug to set as the target, skipping the picker.",
    }),
  },
  handler: async ({ course, page }) => {
    await runPageTarget({ course, page });
  },
});
