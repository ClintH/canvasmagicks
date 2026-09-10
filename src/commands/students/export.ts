import { command, option, optional, string, flag, boolean } from "cmd-ts";
import { input } from "@inquirer/prompts";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "../../lib/config";
import { resolveCourse } from "../../lib/course";
import { resolveTargetCourse, getTargetStudent } from "../../lib/target-student";
import { findStudentById, listStudents, type Student } from "../../lib/students";
import { renderStudentsMarkdown, renderStudentsXlsx } from "../../util/students-format";

// `--student` (or a fresh target student) narrows the export to one student;
// otherwise the full roster is exported.
async function resolveStudents(
  config: import("../../lib/config").CanvasConfig,
  courseId: number,
  opts: { student?: string; all?: boolean },
): Promise<Student[] | null> {
  let students: Student[];
  try {
    students = await listStudents(config, courseId, { includeInactive: opts.all });
  } catch (err) {
    console.error(`Failed to load students: ${(err as Error).message}`);
    process.exitCode = 1;
    return null;
  }

  const explicit = opts.student?.trim() || "";
  if (explicit !== "") {
    const match = findStudentById(students, explicit);
    if (!match) {
      console.error(
        `No student with id '${explicit}' in this course. ` +
          `Check the id (e.g. with \`canvas students ls\`).`,
      );
      process.exitCode = 1;
      return null;
    }
    return [match];
  }

  const target = await getTargetStudent(courseId);
  if (target) {
    const match = students.find((s) => s.id === target.studentId);
    if (match) {
      console.log(`Using target student '${match.name}' (#${match.id}).`);
      return [match];
    }
    console.warn(
      `Warning: target student #${target.studentId} no longer matches this course's roster; exporting all students.`,
    );
  }

  return students;
}

export async function runStudentsExport(opts: {
  course?: string;
  student?: string;
  all?: boolean;
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

  const students = await resolveStudents(config, resolved.id, {
    student: opts.student,
    all: opts.all,
  });
  if (!students) return;

  let outputPath = opts.output?.trim() || "";
  if (outputPath === "") {
    outputPath = (
      await input({ message: "Output file (.json, .md or .xlsx):" })
    ).trim();
  }
  if (outputPath === "") {
    console.log(renderStudentsMarkdown(resolved.course.name, students));
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
    content = JSON.stringify(students, null, 2) + "\n";
  } else if (isXlsx) {
    content = await renderStudentsXlsx(resolved.course.name, students);
  } else {
    content = renderStudentsMarkdown(resolved.course.name, students);
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
  console.log(`Wrote ${absOutput} (${students.length} student(s))`);
}

export const studentsExport = command({
  name: "export",
  description: "Export the course roster (or one target student) to JSON, Markdown or Excel.",
  args: {
    course: option({
      type: optional(string),
      long: "course",
      short: "c",
      description: "Course code (e.g. VT2025-KD413A-K3548), overriding the default course.",
    }),
    student: option({
      type: optional(string),
      long: "student",
      short: "s",
      description: "Student user id, overriding the target student. Omit to export the whole roster (or the target student, if set).",
    }),
    all: flag({
      type: boolean,
      long: "all",
      description: "Include inactive/completed enrollments (default: active/invited only).",
    }),
    output: option({
      type: optional(string),
      long: "output",
      short: "o",
      description: "Output file path. Use .json for JSON, .md for Markdown or .xlsx for Excel (prompts if omitted; empty prints to stdout).",
    }),
  },
  handler: async ({ course, student, all, output }) => {
    await runStudentsExport({ course, student, all, output });
  },
});
