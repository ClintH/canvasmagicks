import { command, option, optional, string } from "cmd-ts";
import { input } from "@inquirer/prompts";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "../../lib/config";
import { resolveCourse } from "../../lib/course";
import { resolveGroupCategory, listGroupsInCategory, listGroupMembers } from "../../lib/groups";
import { resolveTargetCourse } from "../../lib/target-group";
import { renderGroupsMarkdown, renderGroupsXlsx, type GroupWithMembers } from "../../util/groups-format";

export async function runGroupsExport(opts: {
  course?: string;
  category?: string;
  output?: string;
} = {}): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.error("Not authenticated. Run `canvas auth` first.");
    process.exitCode = 1;
    return;
  }

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

  let groups;
  try {
    groups = await listGroupsInCategory(config, category.id);
  } catch (err) {
    console.error(`Failed to load groups: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

  const entries: GroupWithMembers[] = [];
  for (const group of groups) {
    try {
      const members = await listGroupMembers(config, group.id);
      entries.push({ group, members });
    } catch (err) {
      console.warn(`Warning: could not list members of '${group.name}': ${(err as Error).message}`);
      entries.push({ group, members: [] });
    }
  }

  let outputPath = opts.output?.trim() || "";
  if (outputPath === "") {
    outputPath = (
      await input({ message: "Output file (.json, .md or .xlsx):" })
    ).trim();
  }
  if (outputPath === "") {
    console.log(renderGroupsMarkdown(category.name, resolved.course.name, entries));
    return;
  }

  const lower = outputPath.toLowerCase();
  const isJson = lower.endsWith(".json");
  const isMd = lower.endsWith(".md");
  const isXlsx = lower.endsWith(".xlsx");
  if (!isJson && !isMd && !isXlsx) {
    console.error(`Unsupported output extension for '${outputPath}'. Use .json, .md or .xlsx.`);
    process.exitCode = 1;
    return;
  }

  const absOutput = resolve(outputPath);
  let content: string | Buffer;
  if (isJson) {
    const payload = entries.map((e) => ({ ...e.group, members: e.members }));
    content = JSON.stringify(payload, null, 2) + "\n";
  } else if (isXlsx) {
    content = await renderGroupsXlsx(category.name, resolved.course.name, entries);
  } else {
    content = renderGroupsMarkdown(category.name, resolved.course.name, entries);
  }

  try {
    if (typeof content === "string") {
      await writeFile(absOutput, content, "utf8");
    } else {
      await writeFile(absOutput, content);
    }
  } catch (err) {
    console.error(`Could not write file: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Wrote ${absOutput} (${entries.length} group(s) in '${category.name}')`);
}

export const groupsExport = command({
  name: "export",
  description: "Export a group set's groups and members to JSON, Markdown or Excel.",
  args: {
    course: option({
      type: optional(string),
      long: "course",
      short: "c",
      description: "Course code (e.g. VT2025-KD413A-K3548), overriding the default course.",
    }),
    category: option({
      type: optional(string),
      long: "category",
      description: "Group set (group category) id, overriding the target group set. Prompts with a picker if omitted.",
    }),
    output: option({
      type: optional(string),
      long: "output",
      short: "o",
      description: "Output file path. Use .json for JSON, .md for Markdown or .xlsx for Excel (prompts if omitted; empty prints to stdout).",
    }),
  },
  handler: async ({ course, category, output }) => {
    await runGroupsExport({ course, category, output });
  },
});
