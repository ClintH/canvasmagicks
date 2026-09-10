import { command, option, optional, string } from "cmd-ts";
import { loadConfig, patchConfig } from "../../lib/config";
import { resolveCourse } from "../../lib/course";
import { findGroupCategoryById, listGroupCategories } from "../../lib/groups";
import { getTargetGroup, setTargetGroup } from "../../lib/target-group";
import { searchPick, type PickItem } from "../../lib/picker";

export async function runGroupsTarget(opts: {
  course?: string;
  category?: string;
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

  let categories;
  try {
    categories = await listGroupCategories(config, courseId);
  } catch (err) {
    console.error(`Failed to load group sets: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

  if (categories.length === 0) {
    console.log("This course has no group sets to target.");
    process.exitCode = 1;
    return;
  }

  let categoryId: number;

  if (opts.category !== undefined && opts.category.trim() !== "") {
    const found = findGroupCategoryById(categories, opts.category.trim());
    if (!found) {
      console.error(
        `No group set with id '${opts.category.trim()}' in this course. ` +
          `Check the id (e.g. with \`canvas groups ls\`).`,
      );
      process.exitCode = 1;
      return;
    }
    categoryId = found.id;
  } else {
    const target = await getTargetGroup(courseId);
    const defaultCategory = target
      ? categories.find((c) => c.id === target.categoryId)
      : undefined;

    const items: PickItem<string>[] = categories.map((c) => ({
      label: `${c.name} (#${c.id})`,
      value: String(c.id),
    }));
    const defaultItem = defaultCategory
      ? { label: `${defaultCategory.name} (#${defaultCategory.id})`, value: String(defaultCategory.id) }
      : undefined;

    const picked = await searchPick(items, {
      message: "Select the target group set:",
      defaultItem,
    });
    if (picked === null) {
      console.error("No group set selected.");
      process.exitCode = 1;
      return;
    }
    categoryId = Number(picked);
  }

  await setTargetGroup(courseId, categoryId);
  // The target group set implies its course: save it as the global default
  // too so `groups ls` / `groups export` resolve without prompting.
  await patchConfig({
    defaultCourseId: resolved.id,
    defaultCourseCode: resolved.course.course_code,
  });
  const category = categories.find((c) => c.id === categoryId);
  if (!category) {
    console.log(`Target group set to #${categoryId} for course ${courseId}. Valid for 1 hour.`);
  } else {
    console.log(
      `Target group set to '${category.name}' (#${categoryId}) for course ${courseId}. Valid for 1 hour.`,
    );
  }
}

export const groupsTarget = command({
  name: "target",
  description:
    "Set the target group set (persisted for an hour, linked to the course).",
  args: {
    course: option({
      type: optional(string),
      long: "course",
      short: "c",
      description:
        "Course code to choose the group set from (e.g. VT2025-KD413A-K3548), overriding the default course.",
    }),
    category: option({
      type: optional(string),
      long: "category",
      description: "Group set (group category) id to set as the target, skipping the picker.",
    }),
  },
  handler: async ({ course, category }) => {
    await runGroupsTarget({ course, category });
  },
});
