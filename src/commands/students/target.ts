import { command, option, optional, string } from "cmd-ts";
import { loadConfig, patchConfig } from "../../lib/config";
import { resolveCourse } from "../../lib/course";
import { findStudentById, listStudents } from "../../lib/students";
import { getTargetStudent, setTargetStudent } from "../../lib/target-student";
import { searchPick, type PickItem } from "../../lib/picker";

function labelFor(name: string, id: number, loginId?: string | null): string {
  return `${name} (#${id}${loginId ? `, ${loginId}` : ""})`;
}

export async function runStudentsTarget(opts: {
  course?: string;
  student?: string;
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

  let students;
  try {
    students = await listStudents(config, courseId);
  } catch (err) {
    console.error(`Failed to load students: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

  if (students.length === 0) {
    console.log("This course has no students to target.");
    process.exitCode = 1;
    return;
  }

  let studentId: number;

  if (opts.student !== undefined && opts.student.trim() !== "") {
    const found = findStudentById(students, opts.student.trim());
    if (!found) {
      console.error(
        `No student with id '${opts.student.trim()}' in this course. ` +
          `Check the id (e.g. with \`canvas students ls\`).`,
      );
      process.exitCode = 1;
      return;
    }
    studentId = found.id;
  } else {
    const target = await getTargetStudent(courseId);
    const defaultStudent = target
      ? students.find((s) => s.id === target.studentId)
      : undefined;

    const items: PickItem<string>[] = students.map((s) => ({
      label: labelFor(s.name, s.id, s.login_id),
      value: String(s.id),
    }));
    const defaultItem = defaultStudent
      ? { label: labelFor(defaultStudent.name, defaultStudent.id, defaultStudent.login_id), value: String(defaultStudent.id) }
      : undefined;

    const picked = await searchPick(items, {
      message: "Select the target student:",
      defaultItem,
    });
    if (picked === null) {
      console.error("No student selected.");
      process.exitCode = 1;
      return;
    }
    studentId = Number(picked);
  }

  await setTargetStudent(courseId, studentId);
  // The target student implies its course: save it as the global default too
  // so `students ls` / `students export` resolve without prompting.
  await patchConfig({
    defaultCourseId: resolved.id,
    defaultCourseCode: resolved.course.course_code,
  });
  const student = students.find((s) => s.id === studentId);
  if (!student) {
    console.log(`Target student set to #${studentId} for course ${courseId}. Valid for 1 hour.`);
  } else {
    console.log(
      `Target student set to '${student.name}' (#${studentId}) for course ${courseId}. Valid for 1 hour.`,
    );
  }
}

export const studentsTarget = command({
  name: "target",
  description:
    "Set the target student (persisted for an hour, linked to the course).",
  args: {
    course: option({
      type: optional(string),
      long: "course",
      short: "c",
      description:
        "Course code to choose the student from (e.g. VT2025-KD413A-K3548), overriding the default course.",
    }),
    student: option({
      type: optional(string),
      long: "student",
      short: "s",
      description: "Student user id to set as the target, skipping the picker.",
    }),
  },
  handler: async ({ course, student }) => {
    await runStudentsTarget({ course, student });
  },
});
