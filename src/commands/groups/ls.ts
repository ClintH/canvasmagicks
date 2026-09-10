import { command, option, optional, string } from "cmd-ts";
import { loadConfig } from "../../lib/config";
import { resolveCourse } from "../../lib/course";
import { resolveGroupCategory, listGroupsInCategory } from "../../lib/groups";
import { resolveTargetCourse } from "../../lib/target-group";

export async function runGroupsLs(opts: { course?: string; category?: string }): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.error("Not authenticated. Run `canvas auth` first.");
    process.exitCode = 1;
    return;
  }

  // The target group set implies its course: skip the course picker when no
  // explicit --course is given and a fresh target exists.
  const fromTarget =
    !opts.course || opts.course.trim() === ""
      ? ((await resolveTargetCourse(config)) ?? null)
      : null;
  if (fromTarget) {
    console.log(`Using target course '${fromTarget.course.name}' (${fromTarget.course.course_code}).`);
  }
  const resolved = fromTarget ?? (await resolveCourse(config, { courseArg: opts.course }));
  if (!resolved) {
    console.error("No course selected.");
    process.exitCode = 1;
    return;
  }

  const category = await resolveGroupCategory(config, resolved.id, { category: opts.category });
  if (!category) {
    if (process.exitCode === 0) {
      console.error("No group set selected.");
      process.exitCode = 1;
    }
    return;
  }

  try {
    const groups = await listGroupsInCategory(config, category.id);
    if (groups.length === 0) {
      console.log(`Group set '${category.name}' has no groups.`);
      return;
    }
    console.log(`Groups in '${category.name}':`);
    for (const g of groups) {
      const count = g.members_count != null ? `${g.members_count} member(s)` : "member count unknown";
      console.log(`  ${g.id}\t${g.name}  [${count}]`);
    }
  } catch (err) {
    console.error(`Failed to load groups: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

export const groupsLs = command({
  name: "ls",
  description: "List the groups in a group set (group category).",
  args: {
    course: option({
      type: optional(string),
      long: "course",
      short: "c",
      description:
        "Course code to list group sets for (e.g. VT2025-KD413A-K3548), overriding the default course.",
    }),
    category: option({
      type: optional(string),
      long: "category",
      description: "Group set (group category) id, overriding the target group set. Prompts with a picker if omitted.",
    }),
  },
  handler: async ({ course, category }) => {
    await runGroupsLs({ course, category });
  },
});
