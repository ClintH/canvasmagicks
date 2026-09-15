import { command, option, optional, string, number } from "cmd-ts";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  loadStudentsFile,
  loadQuestionsFile,
  buildRandomQuestionsDocx,
} from "../../lib/random-questions";

export async function runGenerateRandomQuestions(opts: {
  students: string;
  questions: string;
  output: string;
  pagesPerStudent?: number;
}): Promise<void> {
  const pagesPerStudent = opts.pagesPerStudent ?? 1;
  if (pagesPerStudent < 1) {
    console.error("--pages-per-student must be at least 1.");
    process.exitCode = 1;
    return;
  }

  if (!opts.output.toLowerCase().endsWith(".docx")) {
    console.error(`Output file must end in .docx: '${opts.output}'`);
    process.exitCode = 1;
    return;
  }

  let students;
  try {
    students = await loadStudentsFile(opts.students);
  } catch (err) {
    console.error(`Could not read students file '${opts.students}': ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }
  if (students.length === 0) {
    console.error(`No students found in '${opts.students}'.`);
    process.exitCode = 1;
    return;
  }

  let questions;
  try {
    questions = await loadQuestionsFile(opts.questions);
  } catch (err) {
    console.error(`Could not read questions file '${opts.questions}': ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }
  if (questions.length === 0) {
    console.error(`No questions found in '${opts.questions}'.`);
    process.exitCode = 1;
    return;
  }

  const buffer = await buildRandomQuestionsDocx(students, questions, pagesPerStudent);

  const absOutput = resolve(opts.output);
  try {
    await writeFile(absOutput, buffer);
  } catch (err) {
    console.error(`Could not write file: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Wrote ${absOutput} (${students.length} student(s))`);
}

export const generateRandomQuestions = command({
  name: "random-questions",
  description: "Generate a DOCX handout with one random question per section per student.",
  args: {
    students: option({
      type: string,
      long: "students",
      description: "Students JSON file (e.g. from `canvas students export`).",
    }),
    questions: option({
      type: string,
      long: "questions",
      description: "Questions JSON file: an array of { section, question, id }.",
    }),
    output: option({
      type: string,
      long: "output",
      short: "o",
      description: "Destination .docx file.",
    }),
    pagesPerStudent: option({
      type: optional(number),
      long: "pages-per-student",
      description: "Number of pages to spread each student's questions across (default: 1).",
    }),
  },
  handler: async ({ students, questions, output, pagesPerStudent }) => {
    await runGenerateRandomQuestions({ students, questions, output, pagesPerStudent });
  },
});
