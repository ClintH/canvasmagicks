import ExcelJS from "exceljs";
import type { Student } from "../lib/schemas";
import { enrollmentStateOf } from "../lib/students";

// Sorts by last name: prefers the Canvas `sortable_name` ("Last, First"),
// falling back to the last whitespace-separated token of the display name.
export function lastNameOf(s: Student): string {
  const sortable = s.sortable_name?.trim();
  if (sortable) {
    const last = sortable.split(",")[0]?.trim();
    if (last) return last.toLowerCase();
  }
  const tokens = s.name.trim().split(/\s+/);
  return (tokens[tokens.length - 1] ?? s.name).toLowerCase();
}

export function sortByLastName(a: Student, b: Student): number {
  return lastNameOf(a).localeCompare(lastNameOf(b)) || a.name.localeCompare(b.name);
}

function formatGeneratedAt(generatedAt: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${generatedAt.getFullYear()}-${pad(generatedAt.getMonth() + 1)}-${pad(generatedAt.getDate())} ` +
    `${pad(generatedAt.getHours())}:${pad(generatedAt.getMinutes())}`
  );
}

export function renderStudentsMarkdown(
  courseName: string,
  students: Student[],
  generatedAt: Date = new Date(),
): string {
  const lines: string[] = [];
  lines.push(`# Students — ${courseName}`);
  lines.push("");
  lines.push(`_Generated ${formatGeneratedAt(generatedAt)}_`);
  lines.push("");
  if (students.length === 0) {
    lines.push("No students found.");
    lines.push("");
    return lines.join("\n") + "\n";
  }
  const sorted = [...students].sort(sortByLastName);
  for (const s of sorted) {
    lines.push(`## ${s.name}`);
    lines.push("");
    lines.push(`- User id: ${s.id}`);
    lines.push(`- Login: ${s.login_id ?? "—"}`);
    lines.push(`- Email: ${s.email ?? "—"}`);
    lines.push(`- SIS id: ${s.sis_user_id ?? "—"}`);
    lines.push(`- Enrollment: ${enrollmentStateOf(s)}`);
    lines.push("");
  }
  return lines.join("\n") + "\n";
}

export async function renderStudentsXlsx(
  courseName: string,
  students: Student[],
  generatedAt: Date = new Date(),
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Students");

  ws.addRow([`Students — ${courseName}`]);
  ws.addRow([`Generated ${formatGeneratedAt(generatedAt)}`]);
  ws.addRow([]);
  const header = ws.addRow(["User ID", "Name", "Login", "Email", "SIS ID", "Enrollment"]);
  header.font = { bold: true };

  const sorted = [...students].sort(sortByLastName);
  for (const s of sorted) {
    ws.addRow([s.id, s.name, s.login_id ?? "—", s.email ?? "—", s.sis_user_id ?? "—", enrollmentStateOf(s)]);
  }

  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 28;
  ws.getColumn(5).width = 14;
  ws.getColumn(6).width = 16;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
