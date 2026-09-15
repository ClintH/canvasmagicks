import { subcommands } from "cmd-ts";
import { generateRandomQuestions } from "./random-questions";

export const generateCmd = subcommands({
  name: "generate",
  cmds: {
    "random-questions": generateRandomQuestions,
  },
});
