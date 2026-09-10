import { subcommands } from "cmd-ts";
import { studentsLs } from "./ls";
import { studentsExport } from "./export";
import { studentsTarget } from "./target";

export const studentsCmd = subcommands({
  name: "students",
  cmds: {
    ls: studentsLs,
    export: studentsExport,
    target: studentsTarget,
  },
});
