import { subcommands } from "cmd-ts";
import { examsLs } from "./ls";
import { examsGet } from "./get";
import { examsTarget } from "./target";

export const examsCmd = subcommands({
  name: "exams",
  cmds: {
    ls: examsLs,
    get: examsGet,
    target: examsTarget,
  },
});
