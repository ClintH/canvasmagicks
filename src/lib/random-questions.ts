import { readFile } from "node:fs/promises";
import { z } from "zod";
import { createReport } from "docx-templates";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  PageBreak,
  HeadingLevel,
} from "docx";

export const QuestionSchema = z
  .object({
    section: z.string(),
    question: z.string(),
    id: z.number(),
  })
  .passthrough();
export type Question = z.infer<typeof QuestionSchema>;

// The students file is whatever `students export --output x.json` produces:
// a Canvas user object per student. Only `name` is needed here.
const StudentNameSchema = z.object({ name: z.string() }).passthrough();
export type StudentName = z.infer<typeof StudentNameSchema>;

export async function loadStudentsFile(path: string): Promise<StudentName[]> {
  const raw = JSON.parse(await readFile(path, "utf8"));
  return StudentNameSchema.array().parse(raw);
}

export async function loadQuestionsFile(path: string): Promise<Question[]> {
  const raw = JSON.parse(await readFile(path, "utf8"));
  return QuestionSchema.array().parse(raw);
}

// Groups questions by section, preserving each section's first-appearance
// order in the input file.
export function groupBySection(questions: Question[]): Map<string, Question[]> {
  const sections = new Map<string, Question[]>();
  for (const q of questions) {
    const list = sections.get(q.section);
    if (list) list.push(q);
    else sections.set(q.section, [q]);
  }
  return sections;
}

// Picks one random question per section for a single student.
export function pickQuestionsForStudent(sections: Map<string, Question[]>): Question[] {
  const picked: Question[] = [];
  for (const [, questions] of sections) {
    const q = questions[Math.floor(Math.random() * questions.length)];
    if (q) picked.push(q);
  }
  return picked;
}

// A single page of the report: either a student's exam questions, or the
// instruction page that follows it. Fed to the docx-templates template as
// the `pages` loop variable.
export type ReportQuestion = { section: string; question: string };
export type ReportPage =
  | {
      kind: "exam";
      pageBreakBefore: boolean;
      studentName: string;
      questions: ReportQuestion[];
    }
  | {
      kind: "instructions";
      pageBreakBefore: boolean;
      studentName: string;
    };

// Builds the flat, interleaved page list: each student's exam-questions page
// immediately followed by an instructions page.
export function buildReportPages(
  students: StudentName[],
  questions: Question[],
): ReportPage[] {
  const sections = groupBySection(questions);
  const pages: ReportPage[] = [];

  for (const student of students) {
    const assigned = pickQuestionsForStudent(sections);
    pages.push({
      kind: "exam",
      pageBreakBefore: pages.length > 0,
      studentName: student.name,
      questions: assigned.map((q) => ({ section: q.section, question: q.question })),
    });
    pages.push({
      kind: "instructions",
      pageBreakBefore: true,
      studentName: student.name,
    });
  }

  return pages;
}

export async function buildRandomQuestionsDocx(
  template: Buffer,
  students: StudentName[],
  questions: Question[],
): Promise<Buffer> {
  const pages = buildReportPages(students, questions);
  const report = await createReport({
    template,
    data: { pages },
    cmdDelimiter: "+++",
    rejectNullish: true,
  });
  return Buffer.from(report);
}

// A starter template, matching the command structure `buildRandomQuestionsDocx`
// expects: usable as-is with `--template`, or as a starting point to edit in
// Word (e.g. to restyle the heading, or reword the instructions).
export async function buildDefaultTemplateDocx(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun("+++FOR page IN pages+++")] }),
          new Paragraph({ children: [new TextRun("+++IF $page.pageBreakBefore+++")] }),
          new Paragraph({ children: [new PageBreak()] }),
          new Paragraph({ children: [new TextRun("+++END-IF+++")] }),

          new Paragraph({ children: [new TextRun("+++IF $page.kind === 'exam'+++")] }),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun("+++$page.studentName+++")],
          }),
          new Paragraph({ children: [new TextRun("+++FOR q IN $page.questions+++")] }),
          new Paragraph({
            spacing: { before: 200, after: 600 },
            children: [
              new TextRun({ text: "+++$q.section+++: ", bold: true }),
              new TextRun("+++$q.question+++"),
            ],
          }),
          new Paragraph({ children: [new TextRun("+++END-FOR q+++")] }),
          new Paragraph({ children: [new TextRun("+++END-IF+++")] }),

          new Paragraph({ children: [new TextRun("+++IF $page.kind === 'instructions'+++")] }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, text: "Instructions" }),
          new Paragraph({
            text: "Complete your assigned question in the space provided on the previous page.",
          }),
          new Paragraph({ text: "Write your name at the top of every page you turn in." }),
          new Paragraph({
            text: "You have the full class period. Raise your hand if you have questions.",
          }),
          new Paragraph({ children: [new TextRun("+++END-IF+++")] }),

          new Paragraph({ children: [new TextRun("+++END-FOR page+++")] }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
