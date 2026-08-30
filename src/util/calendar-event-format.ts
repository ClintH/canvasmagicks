import type { CalendarEvent } from "../lib/schemas";
import { htmlToMarkdown } from "../lib/markdown";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function toIcalUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function dtStampNow(): string {
  return toIcalUtc(new Date().toISOString());
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let pos = 0;
  while (pos < line.length) {
    const chunk = line.slice(pos, pos + 75);
    parts.push(chunk);
    pos += 75;
  }
  return parts.join("\r\n ");
}

function formatLocalDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateDow(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const dow = WEEKDAYS[d.getDay()];
  return `${yyyy}-${mm}-${dd} ${dow}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function stripHtml(html: string): string {
  try {
    return htmlToMarkdown(html).replace(/\n+/g, " ").trim();
  } catch {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
}

function sortByStart(a: CalendarEvent, b: CalendarEvent): number {
  return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
}

export function renderCalendarEventsMarkdown(
  events: CalendarEvent[],
  generatedAt: Date = new Date(),
): string {
  const lines: string[] = [];
  lines.push("# Calendar Events");
  lines.push("");
  lines.push(`_Generated ${formatLocalDateTime(generatedAt)}_`);
  lines.push("");

  if (events.length === 0) {
    lines.push("No events found.");
    lines.push("");
    return lines.join("\n") + "\n";
  }

  const sorted = [...events].sort(sortByStart);
  for (const ev of sorted) {
    const dateDow = formatDateDow(ev.start_at);
    const start = formatTime(ev.start_at);
    const end = ev.end_at ? formatTime(ev.end_at) : start;
    const loc = ev.location_name ? ` @ ${ev.location_name}` : "";
    lines.push(`${dateDow} ${start}-${end} ${ev.title}${loc}  `);
    if (ev.description) {
      const desc = stripHtml(ev.description);
      if (desc) lines.push(`  ${desc}  `);
    }
  }
  lines.push("");
  return lines.join("\n") + "\n";
}

export function renderCalendarEventsIcal(
  events: CalendarEvent[],
  prefix?: string,
  nowIso?: string,
): string {
  const dtstamp = nowIso ? toIcalUtc(nowIso) : dtStampNow();
  const cleanPrefix = prefix?.trim() ?? "";
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//canvasmagicks//EN");
  lines.push("CALSCALE:GREGORIAN");

  const sorted = [...events].sort(sortByStart);
  for (const ev of sorted) {
    const rawTitle = ev.title;
    const title = cleanPrefix ? `${cleanPrefix} ${rawTitle}` : rawTitle;
    const startIso = ev.start_at;
    let endIso = ev.end_at;
    if (!endIso) {
      const d = new Date(startIso);
      d.setHours(d.getHours() + 1);
      endIso = d.toISOString();
    }
    const desc = ev.description ? stripHtml(ev.description) : "";
    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:canvas-${ev.id}@canvasmagicks`));
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${toIcalUtc(startIso)}`);
    lines.push(`DTEND:${toIcalUtc(endIso)}`);
    lines.push(foldLine(`SUMMARY:${escapeIcal(title)}`));
    if (desc) lines.push(foldLine(`DESCRIPTION:${escapeIcal(desc)}`));
    if (ev.location_name) lines.push(foldLine(`LOCATION:${escapeIcal(ev.location_name)}`));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
