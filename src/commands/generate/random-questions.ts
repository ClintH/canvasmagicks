import { command, option, string } from "cmd-ts";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  loadStudentsFile,
  loadQuestionsFile,
  buildRandomQuestionsDocx,
} from "../../lib/random-questions";

export async function runGenerateRandomQuestions(opts: {
  students: string;
  questions: string;
  template: string;
  output: string;
}): Promise<void> {
  if (!opts.output.toLowerCase().endsWith(".docx")) {
    console.error(`Output file must end in .docx: '${opts.output}'`);
    process.exitCode = 1;
    return;
  }

  let template: Buffer;
  try {
    template = await readFile(opts.template);
  } catch (err) {
    console.error(`Could not read template file '${opts.template}': ${(err as Error).message}`);
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

  let buffer: Buffer;
  try {
    buffer = await buildRandomQuestionsDocx(template, students, questions);
  } catch (err) {
    console.error(`Could not render template '${opts.template}': ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

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
    template: option({
      type: string,
      long: "template",
      description:
        "DOCX template file (docx-templates syntax). See `generate random-questions-template` for a starter.",
    }),
    output: option({
      type: string,
      long: "output",
      short: "o",
      description: "Destination .docx file.",
    }),
  },
  handler: async ({ students, questions, template, output }) => {
    await runGenerateRandomQuestions({ students, questions, template, output });
  },
});
