import { subcommands } from "cmd-ts";
import { pageLs } from "./ls";
import { pageTarget } from "./target";
import { pageWrite } from "./write";
import { pageExport } from "./export";

export const pageCmd = subcommands({
  name: "page",
  cmds: {
    ls: pageLs,
    target: pageTarget,
    write: pageWrite,
    export: pageExport,
  },
});
