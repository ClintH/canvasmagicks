import type { Activity } from "../lib/activities";
import { formatEventTitle } from "../lib/activities";
import { toIso } from "../lib/calendar";

function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function toIcalUtc(iso: string): string {
  const d = new Date(iso);
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
  // RFC 5545: lines should be <= 75 octets; fold with CRLF + space
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

function buildIcalDescription(activity: Activity): string {
  const parts: string[] = [];
  if (activity.involved.length > 0) {
    parts.push(`Involved: ${activity.involved.join(", ")}`);
  }
  if (activity.responsible) {
    parts.push(`Responsible: ${activity.responsible}`);
  }
  if (activity.notes) {
    parts.push(activity.notes);
  }
  return parts.join("\n\n");
}

export function renderIcal(activities: Activity[], prefix?: string, nowIso?: string): string {
  const dtstamp = nowIso ? toIcalUtc(nowIso) : dtStampNow();
  const cleanPrefix = prefix?.trim() ?? "";
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//canvasmagicks//EN");
  lines.push("CALSCALE:GREGORIAN");

  activities.forEach((activity, idx) => {
    const rawTitle = formatEventTitle(activity);
    const title = cleanPrefix ? `${cleanPrefix} ${rawTitle}` : rawTitle;
    const description = buildIcalDescription(activity);
    const startIso = toIso(activity.date, activity.startTime);
    const endIso = toIso(activity.date, activity.endTime);
    const uid = `${activity.date}-${activity.startTime.replace(":", "")}-${slugify(activity.title)}-${idx}@canvasmagicks`;

    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:${escapeIcal(uid)}`));
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${toIcalUtc(startIso)}`);
    lines.push(`DTEND:${toIcalUtc(endIso)}`);
    lines.push(foldLine(`SUMMARY:${escapeIcal(title)}`));
    if (description) {
      lines.push(foldLine(`DESCRIPTION:${escapeIcal(description)}`));
    }
    if (activity.location && activity.location.trim() !== "") {
      lines.push(foldLine(`LOCATION:${escapeIcal(activity.location)}`));
    }
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
