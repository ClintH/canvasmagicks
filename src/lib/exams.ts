import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CanvasConfig } from "./config";
import { CanvasClient } from "./client";
import {
  AssignmentSchema,
  SubmissionSchema,
  SubmissionUserSchema,
  type Assignment,
  type Submission,
  type SubmissionUser,
} from "./schemas";

export type { Assignment, Submission, SubmissionUser } from "./schemas";

export async function listAssignments(
  config: CanvasConfig,
  courseId: number | string,
): Promise<Assignment[]> {
  const client = new CanvasClient(config);
  const json = await client.getAll(`courses/${courseId}/assignments`, {
    per_page: 100,
    order_by: "due_at",
  });
  return AssignmentSchema.array().parse(json);
}

export function findAssignmentById(
  assignments: Assignment[],
  rawId: string,
): Assignment | undefined {
  const id = Number(rawId.trim());
  if (!Number.isFinite(id)) return undefined;
  return assignments.find((a) => a.id === id);
}

export async function listSubmissions(
  config: CanvasConfig,
  courseId: number | string,
  assignmentId: number | string,
): Promise<Submission[]> {
  const client = new CanvasClient(config);
  const json = await client.getAll(
    `courses/${courseId}/assignments/${assignmentId}/submissions`,
    {
      per_page: 100,
      "include[]": [
        "user",
        "submission_comments",
        "submission_history",
        "attachments",
      ],
    },
  );
  return SubmissionSchema.array().parse(json);
}

export async function listCourseStudents(
  config: CanvasConfig,
  courseId: number | string,
): Promise<SubmissionUser[]> {
  const client = new CanvasClient(config);
  const json = await client.getAll(`courses/${courseId}/users`, {
    per_page: 100,
    enrollment_type: "student",
  });
  return SubmissionUserSchema.array().parse(json);
}

// Downloads a Canvas attachment URL (requires auth) to `destPath`,
// creating parent directories as needed.
export async function downloadAttachment(
  config: CanvasConfig,
  attachmentUrl: string,
  destPath: string,
): Promise<void> {
  const res = await fetch(attachmentUrl, {
    headers: { Authorization: `Bearer ${config.token}` },
  });
  if (!res.ok) {
    throw new Error(`download returned ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(destPath), { recursive: true });
  await writeFile(destPath, buf);
}
