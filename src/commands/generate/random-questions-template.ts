import { command, option, string } from "cmd-ts";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildDefaultTemplateDocx } from "../../lib/random-questions";

export async function runGenerateRandomQuestionsTemplate(opts: { output: string }): Promise<void> {
  if (!opts.output.toLowerCase().endsWith(".docx")) {
    console.error(`Output file must end in .docx: '${opts.output}'`);
    process.exitCode = 1;
    return;
  }

  const buffer = await buildDefaultTemplateDocx();

  const absOutput = resolve(opts.output);
  try {
    await writeFile(absOutput, buffer);
  } catch (err) {
    console.error(`Could not write file: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Wrote ${absOutput}`);
}

export const generateRandomQuestionsTemplate = command({
  name: "random-questions-template",
  description:
    "Write a starter DOCX template for `generate random-questions --template`, editable in Word.",
  args: {
    output: option({
      type: string,
      long: "output",
      short: "o",
      description: "Destination .docx file.",
    }),
  },
  handler: async ({ output }) => {
    await runGenerateRandomQuestionsTemplate({ output });
  },
});
