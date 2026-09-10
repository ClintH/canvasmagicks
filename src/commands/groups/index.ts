import { subcommands } from "cmd-ts";
import { groupsLs } from "./ls";
import { groupsExport } from "./export";
import { groupsTarget } from "./target";
import { groupsCreate } from "./create";

export const groupsCmd = subcommands({
  name: "groups",
  cmds: {
    ls: groupsLs,
    export: groupsExport,
    target: groupsTarget,
    create: groupsCreate,
  },
});
