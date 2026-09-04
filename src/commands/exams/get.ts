import { command, option, optional, string } from "cmd-ts";
import { input, select } from "@inquirer/prompts";
import { writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { loadConfig, type CanvasConfig } from "../../lib/config";
import { resolveCourse } from "../../lib/course";
import { searchPick, type PickItem } from "../../lib/picker";
import { getTargetExam, resolveTargetCourse } from "../../lib/target-exam";
import {
  downloadAttachment,
  findAssignmentById,
  listAssignments,
  listCourseStudents,
  listSubmissions,
  type Assignment,
} from "../../lib/exams";
import type { Submission } from "../../lib/schemas";
import {
  renderSubmissionsMarkdown,
  renderSubmissionsXlsx,
  sanitizeFileName,
  type EnrichedSubmission,
} from "../../util/exam-submission-format";

type AttachmentsChoice = "yes" | "no";

function normalizeAttachmentsChoice(raw: string): AttachmentsChoice | null {
  const v = raw.trim().toLowerCase();
  if (v === "yes" || v === "y") return "yes";
  if (v === "no" || v === "n") return "no";
  return null;
}

async function resolveAttachmentsChoice(raw?: string): Promise<AttachmentsChoice | null> {
  if (raw !== undefined && raw.trim() !== "") {
    const parsed = normalizeAttachmentsChoice(raw);
    if (!parsed) {
      console.error(`Invalid value for --attachments: '${raw}'. Use 'yes' or 'no'.`);
      process.exitCode = 1;
      return null;
    }
    return parsed;
  }
  return select<AttachmentsChoice>({
    message: "Download submission attachments?",
    choices: [
      { name: "Yes — download files next to the output", value: "yes" },
      { name: "No — links only", value: "no" },
    ],
  });
}

async function resolveAssignment(
  config: CanvasConfig,
  courseId: number,
  opts: { assignment?: string; exam?: string },
): Promise<Assignment | null> {
  let assignments: Assignment[];
  try {
    assignments = await listAssignments(config, courseId);
  } catch (err) {
    console.error(`Failed to load assignments: ${(err as Error).message}`);
    process.exitCode = 1;
    return null;
  }
  if (assignments.length === 0) {
    console.error("This course has no assignments.");
    process.exitCode = 1;
    return null;
  }
  // `--exam` overrides `--assignment` when both are given.
  const explicit = opts.exam?.trim() || opts.assignment?.trim() || "";
  const flagName = opts.exam?.trim() ? "--exam" : "--assignment";
  if (explicit !== "") {
    const match = findAssignmentById(assignments, explicit);
    if (!match) {
      console.error(
        `No assignment with id '${explicit}' in this course. ` +
          `Check the id (e.g. with \`canvas exams ls\`).`,
      );
      process.exitCode = 1;
      return null;
    }
    if (opts.exam?.trim() && opts.assignment?.trim()) {
      console.warn(
        `Warning: both --exam and --assignment given; using ${flagName} '${explicit}'.`,
      );
    }
    return match;
  }
  const target = await getTargetExam(courseId);
  const defaultAssignment = target
    ? assignments.find((a) => a.id === target.examId)
    : undefined;
  if (defaultAssignment) {
    console.log(`Using target exam '${defaultAssignment.name}' (#${defaultAssignment.id}).`);
    return defaultAssignment;
  }
  if (target) {
    console.warn(
      `Warning: target exam #${target.examId} no longer exists in this course; choose another.`,
    );
  }
  const items: PickItem<string>[] = assignments.map((a) => ({
    label: `${a.name} (#${a.id}${a.due_at ? `, due ${a.due_at.slice(0, 10)}` : ""})`,
    value: String(a.id),
  }));
  const picked = await searchPick(items, { message: "Select an assignment:" });
  if (picked === null) return null;
  return assignments.find((a) => String(a.id) === picked) ?? null;
}

function displayNameFor(s: Submission): string {
  const name = s.user?.name?.trim();
  if (name) return name;
  return `User ${s.user_id}`;
}

export async function runExamsGet(opts: {
  course?: string;
  assignment?: string;
  exam?: string;
  output?: string;
  attachments?: string;
} = {}): Promise<void> {
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

  const assignment = await resolveAssignment(config, resolved.id, {
    assignment: opts.assignment,
    exam: opts.exam,
  });
  if (!assignment) {
    if (process.exitCode === 0) {
      console.error("No assignment selected.");
      process.exitCode = 1;
    }
    return;
  }

  const attachmentsChoice = await resolveAttachmentsChoice(opts.attachments);
  if (!attachmentsChoice) return;
  const wantAttachments = attachmentsChoice === "yes";

  let submissions: Submission[];
  try {
    submissions = await listSubmissions(config, resolved.id, assignment.id);
  } catch (err) {
    console.error(`Failed to fetch submissions: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

  // Merge in enrolled students that have no submission object yet so every
  // student gets an entry (unsubmitted placeholders).
  let entries: EnrichedSubmission[] = submissions.map((s) => ({
    submission: s,
    studentName: displayNameFor(s),
    localFiles: new Map<number, string>(),
  }));
  try {
    const students = await listCourseStudents(config, resolved.id);
    const seen = new Set(submissions.map((s) => s.user_id));
    for (const st of students) {
      if (seen.has(st.id)) continue;
      entries.push({
        submission: {
          user_id: st.id,
          user: st,
          workflow_state: "unsubmitted",
          attachments: [],
          submission_comments: [],
        },
        studentName: st.name,
        localFiles: new Map<number, string>(),
      });
    }
  } catch (err) {
    console.warn(`Warning: could not list enrolled students: ${(err as Error).message}`);
  }

  let outputPath = opts.output?.trim() || "";
  if (outputPath === "") {
    outputPath = (
      await input({ message: "Output file (.json, .md or .xlsx):" })
    ).trim();
  }
  if (outputPath === "") {
    // No file requested: print Markdown to stdout (attachments as links only).
    console.log(
      renderSubmissionsMarkdown(assignment.name, resolved.course.name, entries),
    );
    if (wantAttachments) {
      console.warn("Attachments not downloaded (no output file).");
    }
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
  const outDir = dirname(absOutput);
  const stem = basename(absOutput, extname(absOutput));
  const filesDir = join(outDir, `${stem}_files`);

  if (wantAttachments) {
    let n = 0;
    for (const e of entries) {
      for (const a of e.submission.attachments ?? []) {
        const rawName = a.display_name?.trim() || a.filename?.trim() || `attachment_${a.id}`;
        const safe = `${e.submission.user_id}_${sanitizeFileName(rawName)}`;
        const dest = join(filesDir, safe);
        try {
          await downloadAttachment(config, a.url, dest);
          e.localFiles.set(a.id, join(`${stem}_files`, safe));
          n++;
        } catch (err) {
          console.warn(
            `Warning: could not download '${rawName}' for ${e.studentName}: ${(err as Error).message}`,
          );
        }
      }
    }
    if (n > 0) console.log(`Downloaded ${n} attachment(s) to '${filesDir}'.`);
    else console.log("No attachments to download.");
  }

  let content: string | Buffer;
  if (isJson) {
    const payload = entries.map((e) => ({
      ...e.submission,
      student_name: e.studentName,
      local_files: [...e.localFiles.entries()].map(([attachment_id, local_path]) => ({
        attachment_id,
        local_path,
      })),
    }));
    content = JSON.stringify(payload, null, 2) + "\n";
  } else if (isXlsx) {
    content = await renderSubmissionsXlsx(entries, {
      assignmentName: assignment.name,
      courseName: resolved.course.name,
      dueAt: assignment.due_at,
    });
  } else {
    content = renderSubmissionsMarkdown(assignment.name, resolved.course.name, entries);
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
  console.log(`Wrote ${absOutput} (${entries.length} submission(s) for '${assignment.name}')`);
}

export const examsGet = command({
  name: "get",
  description: "Download all submissions for an assignment to JSON, Markdown or Excel.",
  args: {
    course: option({
      type: optional(string),
      long: "course",
      short: "c",
      description: "Course code (e.g. VT2025-KD413A-K3548), overriding the default course.",
    }),
    assignment: option({
      type: optional(string),
      long: "assignment",
      short: "a",
      description: "Assignment id (see `canvas exams ls`). Prompts with a picker if omitted.",
    }),
    exam: option({
      type: optional(string),
      long: "exam",
      short: "e",
      description: "Exam (assignment) id, overriding --assignment and the target exam.",
    }),
    output: option({
      type: optional(string),
      long: "output",
      short: "o",
      description: "Output file path. Use .json for JSON, .md for Markdown or .xlsx for Excel (prompts if omitted; empty prints to stdout).",
    }),
    attachments: option({
      type: optional(string),
      long: "attachments",
      description: "Download submission attachments ('yes' or 'no'). Prompted if omitted.",
    }),
  },
  handler: async ({ course, assignment, exam, output, attachments }) => {
    await runExamsGet({ course, assignment, exam, output, attachments });
  },
});
