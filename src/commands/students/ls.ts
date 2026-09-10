import { command, option, optional, string, flag, boolean } from "cmd-ts";
import { loadConfig } from "../../lib/config";
import { resolveCourse } from "../../lib/course";
import { listStudents, enrollmentStateOf } from "../../lib/students";
import { resolveTargetCourse } from "../../lib/target-student";

export async function runStudentsLs(opts: { course?: string; all?: boolean }): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.error("Not authenticated. Run `canvas auth` first.");
    process.exitCode = 1;
    return;
  }

  // The target student implies its course: skip the course picker when no
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
    const students = await listStudents(config, resolved.id, { includeInactive: opts.all });
    if (students.length === 0) {
      console.log(`Course '${resolved.course.name}' has no students.`);
      return;
    }
    console.log(`Students in '${resolved.course.name}':`);
    for (const s of students) {
      console.log(`  ${s.id}\t${s.name}  [${s.login_id ?? "no login"}, ${enrollmentStateOf(s)}]`);
    }
  } catch (err) {
    console.error(`Failed to load students: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

export const studentsLs = command({
  name: "ls",
  description: "List the students enrolled in a course.",
  args: {
    course: option({
      type: optional(string),
      long: "course",
      short: "c",
      description:
        "Course code to list students for (e.g. VT2025-KD413A-K3548), overriding the default course.",
    }),
    all: flag({
      type: boolean,
      long: "all",
      description: "Include inactive/completed enrollments (default: active/invited only).",
    }),
  },
  handler: async ({ course, all }) => {
    await runStudentsLs({ course, all });
  },
});
