import { subcommands } from "cmd-ts";
import { calendarNuke } from "./nuke";
import { calendarImport } from "./import";
import { calendarTranslate } from "./translate";
import { calendarDownload } from "./download";
import { calendarSync } from "./sync";

export const calendarCmd = subcommands({
  name: "calendar",
  cmds: {
    nuke: calendarNuke,
    import: calendarImport,
    translate: calendarTranslate,
    download: calendarDownload,
    sync: calendarSync,
  },
});
