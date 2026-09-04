import ExcelJS from "exceljs";
import type { Submission } from "../lib/schemas";
import { htmlToMarkdown } from "../lib/markdown";

// Sanitizes a filename so it is safe to write inside the sidecar `_files`
// directory (no path separators, no `..`, bounded length).
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_");
  const trimmed = cleaned.replace(/^[_.]+|[_.]+$/g, "") || "file";
  return trimmed.slice(0, 120);
}

export interface EnrichedSubmission {
  submission: Submission;
  studentName: string;
  localFiles: Map<number, string>;
}

function sortByStudentName(a: EnrichedSubmission, b: EnrichedSubmission): number {
  return a.studentName.localeCompare(b.studentName);
}

// Sorts by last name: prefers the Canvas `sortable_name` ("Last, First"),
// falling back to the last whitespace-separated token of the display name.
export function lastNameOf(e: EnrichedSubmission): string {
  const sortable = e.submission.user?.sortable_name?.trim();
  if (sortable) {
    const last = sortable.split(",")[0]?.trim();
    if (last) return last.toLowerCase();
  }
  const tokens = e.studentName.trim().split(/\s+/);
  return (tokens[tokens.length - 1] ?? e.studentName).toLowerCase();
}

export function sortByLastName(a: EnrichedSubmission, b: EnrichedSubmission): number {
  return lastNameOf(a).localeCompare(lastNameOf(b)) || sortByStudentName(a, b);
}

export function isUnsubmitted(s: Submission): boolean {
  return (
    s.workflow_state === "unsubmitted" ||
    (!s.submitted_at && !s.body && !s.url && (s.attachments ?? []).length === 0)
  );
}

function formatLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function statusFlags(s: Submission): string {
  const flags: string[] = [];
  if (s.workflow_state) flags.push(s.workflow_state);
  if (s.late) flags.push("late");
  if (s.missing) flags.push("missing");
  if (s.excused) flags.push("excused");
  return flags.length > 0 ? ` (${flags.join(", ")})` : "";
}

function turnitinSummary(turnitinData: Record<string, unknown> | null | undefined): string[] {
  if (!turnitinData) return [];
  const lines: string[] = [];
  for (const [key, raw] of Object.entries(turnitinData)) {
    if (typeof raw !== "object" || raw === null) continue;
    const entry = raw as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof entry["similarity_score"] === "number") {
      parts.push(`similarity ${entry["similarity_score"]}%`);
    }
    if (typeof entry["status"] === "string" && entry["status"] !== "") {
      parts.push(`status ${entry["status"]}`);
    }
    if (typeof entry["state"] === "string" && entry["state"] !== "") {
      parts.push(`state ${entry["state"]}`);
    }
    const overlaps: string[] = [];
    for (const field of ["web_overlap", "publication_overlap", "student_overlap"]) {
      if (typeof entry[field] === "number") overlaps.push(`${field} ${entry[field]}%`);
    }
    if (overlaps.length > 0) parts.push(overlaps.join(", "));
    const detail = parts.length > 0 ? `: ${parts.join("; ")}` : "";
    lines.push(`- ${key}${detail}`);
    if (typeof entry["web_overlap_url"] === "string" && entry["web_overlap_url"] !== "") {
      lines.push(`  Report: ${entry["web_overlap_url"]}`);
    }
  }
  return lines;
}

function renderOne(e: EnrichedSubmission): string[] {
  const lines: string[] = [];
  const s = e.submission;
  lines.push(`# ${e.studentName}`);
  lines.push("");
  lines.push(`- User id: ${s.user_id}`);
  lines.push(
    `- Submitted: ${formatLocalDateTime(s.submitted_at ?? null)}${statusFlags(s)} | ` +
      `Attempt ${s.attempt ?? "—"} | Score ${s.score ?? "—"}${s.grade ? ` (${s.grade})` : ""} | Type ${s.submission_type ?? "—"}`,
  );
  if (s.html_url) lines.push(`- Links: [speedgrader](${s.html_url})${s.preview_url ? ` · [preview](${s.preview_url})` : ""}`);
  lines.push("");

  // Submission state is already clear from the metadata above; unsubmitted
  // students get no further sections.
  if (isUnsubmitted(s)) {
    return lines;
  }

  if (s.body && s.body.trim() !== "") {
    lines.push("## Text submission");
    lines.push("");
    try {
      lines.push(htmlToMarkdown(s.body));
    } catch {
      lines.push(s.body);
    }
    lines.push("");
  }

  if (s.url && s.url.trim() !== "") {
    lines.push(`Url: ${s.url.trim()}  `);
  }

  const attachments = s.attachments ?? [];
  if (attachments.length > 0) {
    for (const a of attachments) {
      const name = a.display_name?.trim() || a.filename?.trim() || `attachment ${a.id}`;
      const size = a.size != null ? ` (${Math.round(a.size / 1024)} KB)` : "";
      lines.push(`File: ${name}${size} [canvas](${a.url})  `);
    }
  }

  const plagiarism = turnitinSummary(
    (s.turnitin_data ?? null) as Record<string, unknown> | null | undefined,
  );
  // Also surface any originality/vericite-flavoured top-level keys preserved
  // by the passthrough schema.
  const extraKeys = Object.keys(s).filter((k) =>
    /originality|vericite|plagiarism/i.test(k),
  );
  if (plagiarism.length > 0 || extraKeys.length > 0) {
    lines.push("## Plagiarism");
    lines.push("");
    lines.push(...plagiarism);
    for (const k of extraKeys) {
      if (k === "turnitin_data") continue;
      lines.push(`- ${k}: ${(JSON.stringify((s as Record<string, unknown>)[k]) ?? "").slice(0, 500)}`);
    }
    if (plagiarism.length === 0 && extraKeys.length === 0) {
      lines.push("No plagiarism data.");
    }
    lines.push("");
  }

  const comments = s.submission_comments ?? [];
  if (comments.length > 0) {
    lines.push("## Comments");
    lines.push("");
    for (const c of comments) {
      const author = c.author_name?.trim() || `user ${c.author_id ?? "?"}`;
      lines.push(`- ${formatLocalDateTime(c.created_at)} ${author}: ${c.comment}`);
      for (const ca of c.attachments ?? []) {
        const cname = ca.display_name?.trim() || ca.filename?.trim() || `attachment ${ca.id}`;
        lines.push(`  - attachment: ${cname} ([canvas](${ca.url}))`);
      }
    }
    lines.push("");
  }

  if (lines[lines.length - 1] !== "") lines.push("");
  return lines;
}

export function renderSubmissionsMarkdown(
  assignmentName: string,
  courseName: string,
  entries: EnrichedSubmission[],
  generatedAt: Date = new Date(),
): string {
  const lines: string[] = [];
  lines.push(`# ${assignmentName} — submissions`);
  lines.push("");
  const pad = (n: number) => String(n).padStart(2, "0");
  const gen =
    `${generatedAt.getFullYear()}-${pad(generatedAt.getMonth() + 1)}-${pad(generatedAt.getDate())} ` +
    `${pad(generatedAt.getHours())}:${pad(generatedAt.getMinutes())}`;
  lines.push(`_Generated ${gen}, course '${courseName}'_`);
  lines.push("");
  if (entries.length === 0) {
    lines.push("No submissions found.");
    lines.push("");
    return lines.join("\n") + "\n";
  }
  const sorted = [...entries].sort(sortByLastName);
  for (const e of sorted) {
    lines.push(...renderOne(e));
  }
  return lines.join("\n") + "\n";
}

export interface XlsxReportMeta {
  assignmentName: string;
  courseName: string;
  dueAt?: string | null;
  generatedAt?: Date;
}

// Builds an XLSX workbook: exam-name heading, errata rows (generated time,
// course, submission deadline), a bold column-header row, then one row per
// student (sorted by last name): student id, name, submitted Y/N.
export async function renderSubmissionsXlsx(
  entries: EnrichedSubmission[],
  meta: XlsxReportMeta,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Submissions");

  const generatedAt = meta.generatedAt ?? new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const gen =
    `${generatedAt.getFullYear()}-${pad(generatedAt.getMonth() + 1)}-${pad(generatedAt.getDate())} ` +
    `${pad(generatedAt.getHours())}:${pad(generatedAt.getMinutes())}`;

  ws.addRow([meta.assignmentName]);
  ws.addRow([`Generated ${gen}`]);
  ws.addRow([`Course: ${meta.courseName}`]);
  ws.addRow([`Submission deadline: ${meta.dueAt ?? "—"}`]);
  ws.addRow([]);
  const header = ws.addRow(["Student ID", "Name", "Submitted"]);
  header.font = { bold: true };

  const sorted = [...entries].sort(sortByLastName);
  const firstDataRow = ws.rowCount + 1;
  for (const e of sorted) {
    ws.addRow([e.submission.user_id, e.studentName, isUnsubmitted(e.submission) ? "N" : "Y"]);
  }

  if (sorted.length > 0) {
    const lastDataRow = ws.rowCount;
    const submittedRow = ws.addRow(["", "Submitted", { formula: `COUNTIF(C${firstDataRow}:C${lastDataRow},"Y")` }]);
    const noSubmissionRow = ws.addRow(["", "No submission", { formula: `COUNTIF(C${firstDataRow}:C${lastDataRow},"N")` }]);
    const rateRow = ws.addRow([
      "",
      "Submission rate",
      {
        formula: `C${submittedRow.number}/(C${submittedRow.number}+C${noSubmissionRow.number})`,
      },
    ]);
    rateRow.getCell(3).numFmt = "0%";
  }

  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 32;
  ws.getColumn(3).width = 11;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
