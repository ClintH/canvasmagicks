import {
  command,
  option,
  optional,
  string,
  subcommands,
  run,
  flag,
} from "cmd-ts";
import { loadConfig } from "./lib/config";
import { runAuth } from "./commands/auth";
import { runWhoami } from "./commands/whoami";
import { runCourses } from "./commands/courses";
import { runCourse } from "./commands/course";
import { pageCmd } from "./commands/page";
import { calendarCmd } from "./commands/calendar";
import { examsCmd } from "./commands/exams";

const auth = command({
  name: "auth",
  description: "Log in to Canvas by entering your API token.",
  args: {
    domain: option({
      type: optional(string),
      long: "domain",
      short: "d",
      description: "Canvas instance domain, e.g. https://canvas.instructure.com",
    }),
  },
  handler: async ({ domain }) => {
    const existing = await loadConfig();
    const initialDomain = domain ?? existing?.domain ?? "";
    const result = await runAuth(initialDomain);

    if (!result) {
      process.exitCode = 1;
    }
  },
});

const whoami = command({
  name: "whoami",
  description: "Show the authenticated Canvas user.",
  args: {},
  handler: async () => {
    await runWhoami();
  },
});

const courses = command({
  name: "courses",
  description: "List your Canvas courses.",
  args: {},
  handler: async () => {
    await runCourses();
  },
});

const course = command({
  name: "course",
  description: "Set the default course used by other commands.",
  args: {},
  handler: async () => {
    await runCourse();
  },
});

const app = subcommands({
  name: "canvasmagicks",
  description: "Command line interface for Canvas LMS.",
  cmds: {
    auth,
    whoami,
    courses,
    course,
    page: pageCmd,
    calendar: calendarCmd,
    exams: examsCmd,
  },
});

export async function main(): Promise<void> {
  await run(app, process.argv.slice(2));
}
