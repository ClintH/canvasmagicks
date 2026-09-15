import { readFile } from "node:fs/promises";
import { z } from "zod";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
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

// Splits a student's assigned questions into `pageCount` roughly-even,
// contiguous chunks — one chunk per page.
function splitIntoPages<T>(items: T[], pageCount: number): T[][] {
  const count = Math.max(1, pageCount);
  const pages: T[][] = [];
  const perPage = Math.ceil(items.length / count);
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }
  while (pages.length < count) pages.push([]);
  return pages;
}

// Usable page height in twips (A4, 1" margins), minus a rough allowance for
// the heading — used to spread questions so there's room to write under each.
const USABLE_PAGE_TWIPS = 15840 - 2 * 1440 - 720;
const TWIPS_PER_QUESTION_TEXT = 300;
const MIN_SPACING_AFTER = 300;

function spacingAfterFor(questionsOnPage: number): number {
  if (questionsOnPage <= 0) return MIN_SPACING_AFTER;
  const remaining = USABLE_PAGE_TWIPS - questionsOnPage * TWIPS_PER_QUESTION_TEXT;
  return Math.max(MIN_SPACING_AFTER, Math.floor(remaining / questionsOnPage));
}

export async function buildRandomQuestionsDocx(
  students: StudentName[],
  questions: Question[],
  pagesPerStudent: number,
): Promise<Buffer> {
  const sections = groupBySection(questions);
  const children: Paragraph[] = [];

  students.forEach((student, studentIndex) => {
    const assigned = pickQuestionsForStudent(sections);
    const pages = splitIntoPages(assigned, pagesPerStudent);

    pages.forEach((pageQuestions, pageIndex) => {
      const isFirstPageOverall = studentIndex === 0 && pageIndex === 0;
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          pageBreakBefore: !isFirstPageOverall,
          text: pageIndex === 0 ? student.name : `${student.name} (cont.)`,
        }),
      );

      const spacingAfter = spacingAfterFor(pageQuestions.length);
      for (const q of pageQuestions) {
        children.push(
          new Paragraph({
            spacing: { before: 200, after: spacingAfter },
            children: [
              new TextRun({ text: `${q.section}: `, bold: true }),
              new TextRun({ text: q.question }),
            ],
          }),
        );
      }
    });
  });

  const doc = new Document({
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}
