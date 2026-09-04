import { command, option, optional, string } from "cmd-ts";
import { loadConfig, patchConfig } from "../../lib/config";
import { resolveCourse } from "../../lib/course";
import { findAssignmentById, listAssignments } from "../../lib/exams";
import { getTargetExam, setTargetExam } from "../../lib/target-exam";
import { searchPick, type PickItem } from "../../lib/picker";

function labelFor(name: string, id: number, dueAt?: string | null): string {
  return `${name} (#${id}${dueAt ? `, due ${dueAt.slice(0, 10)}` : ""})`;
}

export async function runExamsTarget(opts: {
  course?: string;
  exam?: string;
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

  let assignments;
  try {
    assignments = await listAssignments(config, courseId);
  } catch (err) {
    console.error(`Failed to load assignments: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

  if (assignments.length === 0) {
    console.log("This course has no assignments to target.");
    process.exitCode = 1;
    return;
  }

  let examId: number;

  if (opts.exam !== undefined && opts.exam.trim() !== "") {
    const found = findAssignmentById(assignments, opts.exam.trim());
    if (!found) {
      console.error(
        `No assignment with id '${opts.exam.trim()}' in this course. ` +
          `Check the id (e.g. with \`canvas exams ls\`).`,
      );
      process.exitCode = 1;
      return;
    }
    examId = found.id;
  } else {
    const target = await getTargetExam(courseId);
    const defaultAssignment = target
      ? assignments.find((a) => a.id === target.examId)
      : undefined;

    const items: PickItem<string>[] = assignments.map((a) => ({
      label: labelFor(a.name, a.id, a.due_at),
      value: String(a.id),
    }));
    const defaultItem = defaultAssignment
      ? {
          label: labelFor(
            defaultAssignment.name,
            defaultAssignment.id,
            defaultAssignment.due_at,
          ),
          value: String(defaultAssignment.id),
        }
      : undefined;

    const picked = await searchPick(items, {
      message: "Select the target exam:",
      defaultItem,
    });
    if (picked === null) {
      console.error("No exam selected.");
      process.exitCode = 1;
      return;
    }
    examId = Number(picked);
  }

  await setTargetExam(courseId, examId);
  // The target exam implies its course: save it as the global default too so
  // `exams get` / `exams ls` (and other commands) resolve without prompting.
  await patchConfig({
    defaultCourseId: resolved.id,
    defaultCourseCode: resolved.course.course_code,
  });
  const exam = assignments.find((a) => a.id === examId);
  if (!exam) {
    console.log(`Target exam set to #${examId} for course ${courseId}. Valid for 1 hour.`);
  } else {
    console.log(
      `Target exam set to '${exam.name}' (#${examId}) for course ${courseId}. Valid for 1 hour.`,
    );
  }
}

export const examsTarget = command({
  name: "target",
  description:
    "Set the target exam (persisted for an hour, linked to the course).",
  args: {
    course: option({
      type: optional(string),
      long: "course",
      short: "c",
      description:
        "Course code to choose the exam from (e.g. VT2025-KD413A-K3548), overriding the default course.",
    }),
    exam: option({
      type: optional(string),
      long: "exam",
      short: "e",
      description: "Assignment id to set as the target, skipping the picker.",
    }),
  },
  handler: async ({ course, exam }) => {
    await runExamsTarget({ course, exam });
  },
});
