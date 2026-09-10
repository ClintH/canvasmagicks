import ExcelJS from "exceljs";
import type { Group, GroupMember } from "../lib/schemas";

export interface GroupWithMembers {
  group: Group;
  members: GroupMember[];
}

function formatGeneratedAt(generatedAt: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${generatedAt.getFullYear()}-${pad(generatedAt.getMonth() + 1)}-${pad(generatedAt.getDate())} ` +
    `${pad(generatedAt.getHours())}:${pad(generatedAt.getMinutes())}`
  );
}

export function renderGroupsMarkdown(
  categoryName: string,
  courseName: string,
  groups: GroupWithMembers[],
  generatedAt: Date = new Date(),
): string {
  const lines: string[] = [];
  lines.push(`# ${categoryName} — groups`);
  lines.push("");
  lines.push(`_Generated ${formatGeneratedAt(generatedAt)}, course '${courseName}'_`);
  lines.push("");
  if (groups.length === 0) {
    lines.push("No groups found.");
    lines.push("");
    return lines.join("\n") + "\n";
  }
  const sorted = [...groups].sort((a, b) => a.group.name.localeCompare(b.group.name));
  for (const { group, members } of sorted) {
    lines.push(`## ${group.name}`);
    lines.push("");
    lines.push(`_${members.length} member(s)_`);
    lines.push("");
    if (members.length === 0) {
      lines.push("No members.");
    } else {
      const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name));
      for (const m of sortedMembers) {
        lines.push(`- ${m.name} (#${m.id})${m.email ? ` — ${m.email}` : ""}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n") + "\n";
}

export async function renderGroupsXlsx(
  categoryName: string,
  courseName: string,
  groups: GroupWithMembers[],
  generatedAt: Date = new Date(),
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Groups");

  ws.addRow([`${categoryName} — groups`]);
  ws.addRow([`Generated ${formatGeneratedAt(generatedAt)}`]);
  ws.addRow([`Course: ${courseName}`]);
  ws.addRow([]);
  const header = ws.addRow(["Group", "Member ID", "Member name", "Email"]);
  header.font = { bold: true };

  const sorted = [...groups].sort((a, b) => a.group.name.localeCompare(b.group.name));
  for (const { group, members } of sorted) {
    if (members.length === 0) {
      ws.addRow([group.name, "—", "(no members)", ""]);
      continue;
    }
    const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name));
    for (const m of sortedMembers) {
      ws.addRow([group.name, m.id, m.name, m.email ?? "—"]);
    }
  }

  ws.getColumn(1).width = 24;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 28;
  ws.getColumn(4).width = 28;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
