import { command, flag, option, optional, string } from "cmd-ts";
import { input, select, checkbox, confirm } from "@inquirer/prompts";
import { loadConfig, type CanvasConfig } from "../../lib/config";
import { resolveCourse } from "../../lib/course";
import { listStudents, type Student } from "../../lib/students";
import {
  listGroupCategories,
  buildPairHistory,
  createGroupCategory,
  createGroup,
  addGroupMember,
  type GroupCategory,
} from "../../lib/groups";
import { computeGroupSizes, jumbleGroups, hasHistoryPair } from "../../util/group-assignment";

interface RunOptions {
  course?: string;
  name?: string;
  groupSize?: string;
  groupCount?: string;
  groupPrefix?: string;
  history?: string;
  dryRun: boolean;
}

function parsePositiveInt(raw: string, label: string): number | null {
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < 1) {
    console.error(`${label} must be a positive whole number, got '${raw}'.`);
    process.exitCode = 1;
    return null;
  }
  return n;
}

async function resolveSizing(
  studentCount: number,
  opts: { groupSize?: string; groupCount?: string },
): Promise<{ groupSize?: number; groupCount?: number } | null> {
  if (opts.groupSize !== undefined && opts.groupSize.trim() !== "") {
    const n = parsePositiveInt(opts.groupSize, "--group-size");
    return n === null ? null : { groupSize: n };
  }
  if (opts.groupCount !== undefined && opts.groupCount.trim() !== "") {
    const n = parsePositiveInt(opts.groupCount, "--group-count");
    return n === null ? null : { groupCount: n };
  }

  const mode = await select<"size" | "count">({
    message: "How do you want to size the groups?",
    choices: [
      { name: "By students per group", value: "size" },
      { name: "By number of groups", value: "count" },
    ],
  });
  const raw = await input({
    message:
      mode === "size"
        ? `Students per group (${studentCount} active students total):`
        : `Number of groups (${studentCount} active students total):`,
  });
  const n = parsePositiveInt(raw, mode === "size" ? "Students per group" : "Number of groups");
  if (n === null) return null;
  return mode === "size" ? { groupSize: n } : { groupCount: n };
}

async function resolveHistoryCategories(
  config: CanvasConfig,
  courseId: number,
  opts: { history?: string },
): Promise<GroupCategory[] | null> {
  // `--history ""` explicitly opts out of the picker with no history.
  if (opts.history !== undefined && opts.history.trim() === "") {
    return [];
  }

  let categories: GroupCategory[];
  try {
    categories = await listGroupCategories(config, courseId);
  } catch (err) {
    console.error(`Failed to load existing group sets: ${(err as Error).message}`);
    process.exitCode = 1;
    return null;
  }
  if (categories.length === 0) return [];

  if (opts.history !== undefined) {
    const ids = new Set(
      opts.history
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n)),
    );
    const matched = categories.filter((c) => ids.has(c.id));
    const unmatched = [...ids].filter((id) => !matched.some((c) => c.id === id));
    if (unmatched.length > 0) {
      console.warn(`Warning: no group set(s) with id(s) ${unmatched.join(", ")} in this course; ignoring.`);
    }
    return matched;
  }

  const picked = await checkbox<number>({
    message: "Which existing group sets count as prior pairings to avoid?",
    choices: categories.map((c) => ({ name: `${c.name} (#${c.id})`, value: c.id, checked: true })),
  });
  return categories.filter((c) => picked.includes(c.id));
}

export async function runGroupsCreate(opts: RunOptions): Promise<void> {
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

  const name = opts.name?.trim() || (await input({ message: "Name for the new group set:" })).trim();
  if (name === "") {
    console.error("A group set name is required.");
    process.exitCode = 1;
    return;
  }

  let students: Student[];
  try {
    students = await listStudents(config, courseId);
  } catch (err) {
    console.error(`Failed to load students: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }
  if (students.length === 0) {
    console.error(`Course '${resolved.course.name}' has no active students to group.`);
    process.exitCode = 1;
    return;
  }

  const sizing = await resolveSizing(students.length, opts);
  if (!sizing) return;
  const sizes = computeGroupSizes(students.length, sizing);

  const historyCategories = await resolveHistoryCategories(config, courseId, opts);
  if (!historyCategories) return;

  let pairs = new Set<string>();
  if (historyCategories.length > 0) {
    console.log(
      `Loading history from ${historyCategories.length} existing group set(s): ${historyCategories.map((c) => c.name).join(", ")}...`,
    );
    pairs = await buildPairHistory(config, historyCategories);
  }

  const studentIds = students.map((s) => s.id);
  const { groups, conflicts } = jumbleGroups(studentIds, sizes, hasHistoryPair(pairs));
  const byId = new Map(students.map((s) => [s.id, s]));
  const prefix = opts.groupPrefix?.trim() || "Group";

  console.log(
    `\nPlan: group set '${name}' with ${groups.length} group(s) for ${students.length} student(s) in '${resolved.course.name}'.`,
  );
  groups.forEach((group, i) => {
    const memberNames = group.map((id) => byId.get(id)?.name ?? `#${id}`).join(", ");
    console.log(`  ${prefix} ${i + 1} (${group.length}): ${memberNames}`);
  });
  if (historyCategories.length > 0) {
    console.log(
      conflicts === 0
        ? "No repeat pairings from the selected history."
        : `${conflicts} repeat pairing(s) could not be avoided given the group sizes and history.`,
    );
  }

  if (opts.dryRun) {
    console.log("\n[dry-run] No changes made.");
    return;
  }

  const proceed = await confirm({
    message: `\nCreate this group set in '${resolved.course.name}'? This creates real groups and enrollments in Canvas.`,
    default: false,
  });
  if (!proceed) {
    console.log("Aborted. No changes made.");
    return;
  }

  const category = await createGroupCategory(config, courseId, name);
  console.log(`Created group set '${category.name}' (#${category.id}).`);

  let groupsCreated = 0;
  let membersAdded = 0;
  let memberFailures = 0;
  for (let i = 0; i < groups.length; i++) {
    const groupName = `${prefix} ${i + 1}`;
    let createdGroup;
    try {
      createdGroup = await createGroup(config, category.id, groupName);
      groupsCreated++;
    } catch (err) {
      console.error(`Failed to create '${groupName}': ${(err as Error).message}`);
      process.exitCode = 1;
      continue;
    }
    for (const studentId of groups[i]!) {
      try {
        await addGroupMember(config, createdGroup.id, studentId);
        membersAdded++;
      } catch (err) {
        memberFailures++;
        console.warn(
          `Warning: could not add ${byId.get(studentId)?.name ?? `#${studentId}`} to '${groupName}': ${(err as Error).message}`,
        );
      }
    }
  }

  console.log(
    `\nDone. Created ${groupsCreated}/${groups.length} group(s), assigned ${membersAdded} student(s)` +
      (memberFailures > 0 ? ` (${memberFailures} failed — check warnings above).` : "."),
  );
  if (memberFailures > 0) process.exitCode = 1;
}

export const groupsCreate = command({
  name: "create",
  description: "Create a new group set and auto-assign active students to groups.",
  args: {
    course: option({
      type: optional(string),
      long: "course",
      short: "c",
      description: "Course code (e.g. VT2025-KD413A-K3548), overriding the default course.",
    }),
    name: option({
      type: optional(string),
      long: "name",
      description: "Name for the new group set. Prompts if omitted.",
    }),
    groupSize: option({
      type: optional(string),
      long: "group-size",
      description: "Target number of students per group. Prompts (choosing size vs. count) if neither this nor --group-count is given.",
    }),
    groupCount: option({
      type: optional(string),
      long: "group-count",
      description: "Number of groups to create, overriding --group-size.",
    }),
    groupPrefix: option({
      type: optional(string),
      long: "group-prefix",
      description: "Name prefix for created groups, e.g. 'Group' -> 'Group 1', 'Group 2' (default: 'Group').",
    }),
    history: option({
      type: optional(string),
      long: "history",
      description: "Comma-separated ids of existing group sets to avoid repeat pairings from. Pass an empty string for no history. Prompts with a checklist if omitted.",
    }),
    dryRun: flag({
      long: "dry-run",
      description: "Preview the group set and assignments without creating anything in Canvas.",
    }),
  },
  handler: async ({ course, name, groupSize, groupCount, groupPrefix, history, dryRun }) => {
    await runGroupsCreate({ course, name, groupSize, groupCount, groupPrefix, history, dryRun });
  },
});
