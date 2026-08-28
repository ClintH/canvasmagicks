import { marked } from "marked";
import { formatEventTitle, type Activity } from "./activities";

// Converts Markdown into the HTML that Canvas expects for wiki page bodies.
export async function markdownToHtml(md: string): Promise<string> {
  return marked.parse(md);
}

function sortByDateTime(list: Activity[]): Activity[] {
  return [...list].sort((a, b) =>
    a.date === b.date
      ? a.startTime.localeCompare(b.startTime)
      : a.date.localeCompare(b.date),
  );
}

// One event line: "YYYY-MM-DD HH:MM-HH:MM *Title (responsible+inv1,inv2)"
// `focus` is the person whose section this line appears in: a leading "*"
// marks events they are responsible for, and the parenthesised list shows the
// other participants as "responsible+involved,list" (with the responsible name
// omitted when the line is in their own section).
function eventLine(a: Activity, omitYear: boolean): string {
  // Two trailing spaces => a Markdown hard line break, so each event sits on its
  // own line without becoming a bulleted list item.
  return `${formatDate(a.date, omitYear)} ${dayAbbrev(a.date)} ${padTime(a.startTime)}-${padTime(a.endTime)} ${formatEventTitle(a)}  `;
}

function padTime(time: string): string {
  const [h, m] = time.split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayAbbrev(date: string): string {
  return WEEKDAYS[new Date(`${date}T00:00:00`).getDay()];
}

function formatDate(date: string, omitYear: boolean): string {
  const [, m, d] = date.split("-");
  const md = `${m}-${d}`;
  if (omitYear) return md;
  return `${date.split("-")[0]}-${md}`;
}

export function renderMarkdown(activities: Activity[], generatedAt: Date = new Date()): string {
  const people = new Map<string, Set<Activity>>();
  const addPerson = (name: string, activity: Activity) => {
    if (!name) return;
    const set = people.get(name) ?? new Set<Activity>();
    set.add(activity);
    people.set(name, set);
  };
  for (const a of activities) {
    addPerson(a.responsible ?? "", a);
    for (const inv of a.involved) addPerson(inv, a);
  }

  const omitYear = new Set(activities.map((a) => a.date.slice(0, 4))).size === 1;

  const lines: string[] = [];
  lines.push("# Activities");
  lines.push("");
  lines.push(`_Generated ${formatLocalDateTime(generatedAt)}_`);
  lines.push("");
  pushEvents(lines, activities, omitYear);
  lines.push("");

  const names = [...people.keys()].sort((x, y) => x.localeCompare(y));
  for (const name of names) {
    lines.push(`## ${name}`);
    lines.push("");
    pushEvents(lines, [...(people.get(name) ?? [])], omitYear, 3);
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

function pushEvents(
  lines: string[],
  list: Activity[],
  omitYear: boolean,
  headerLevel = 2,
): void {
  let prevWeek: number | null = null;
  for (const a of sortByDateTime(list)) {
    const wk = a.week;
    if (prevWeek === null) {
      lines.push(`${"#".repeat(headerLevel)} Week ${wk}`);
      lines.push("");
    } else if (wk !== prevWeek) {
      lines.push("");
      lines.push(`${"#".repeat(headerLevel)} Week ${wk}`);
      lines.push("");
    }
    lines.push(eventLine(a, omitYear));
    prevWeek = wk;
  }
}

function formatLocalDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${date} ${time}`;
}
