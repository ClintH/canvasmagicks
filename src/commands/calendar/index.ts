import { subcommands } from "cmd-ts";
import { calendarNuke } from "./nuke";
import { calendarImport } from "./import";
import { calendarImportMarkdown } from "./import-markdown";
import { calendarSync } from "./sync";

export const calendarCmd = subcommands({
  name: "calendar",
  cmds: {
    nuke: calendarNuke,
    import: calendarImport,
    "import-markdown": calendarImportMarkdown,
    sync: calendarSync,
  },
});
