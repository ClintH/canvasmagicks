import { subcommands } from "cmd-ts";
import { generateRandomQuestions } from "./random-questions";
import { generateRandomQuestionsTemplate } from "./random-questions-template";

export const generateCmd = subcommands({
  name: "generate",
  cmds: {
    "random-questions": generateRandomQuestions,
    "random-questions-template": generateRandomQuestionsTemplate,
  },
});
