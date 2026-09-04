import { command, option, optional, string } from "cmd-ts";
import { loadConfig } from "../../lib/config";
import { resolveCourse } from "../../lib/course";
import { listAssignments } from "../../lib/exams";
import { resolveTargetCourse } from "../../lib/target-exam";

export async function runExamsLs(opts: { course?: string }): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.error("Not authenticated. Run `canvas auth` first.");
    process.exitCode = 1;
    return;
  }

  // The target exam implies its course: skip the course picker when no
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

  try {
    const assignments = await listAssignments(config, resolved.id);
    if (assignments.length === 0) {
      console.log(`Course '${resolved.course.name}' has no assignments.`);
      return;
    }
    console.log(`Assignments in '${resolved.course.name}':`);
    for (const a of assignments) {
      const due = a.due_at ? `due ${a.due_at.slice(0, 10)}` : "no due date";
      const pts = a.points_possible != null ? `${a.points_possible} pts` : "ungraded";
      const types = a.submission_types?.join(",") ?? "—";
      console.log(`  ${a.id}\t${a.name}  [${due}, ${pts}, ${types}]`);
    }
  } catch (err) {
    console.error(`Failed to load assignments: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

export const examsLs = command({
  name: "ls",
  description: "List the assignments of a course.",
  args: {
    course: option({
      type: optional(string),
      long: "course",
      short: "c",
      description:
        "Course code to list assignments for (e.g. VT2025-KD413A-K3548), overriding the default course.",
    }),
  },
  handler: async ({ course }) => {
    await runExamsLs({ course });
  },
});
