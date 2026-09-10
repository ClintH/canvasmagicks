import type { CanvasConfig } from "./config";
import { CanvasClient } from "./client";
import { StudentSchema, type Student } from "./schemas";

export type { Student } from "./schemas";

export async function listStudents(
  config: CanvasConfig,
  courseId: number | string,
  opts: { includeInactive?: boolean } = {},
): Promise<Student[]> {
  const client = new CanvasClient(config);
  const json = await client.getAll(`courses/${courseId}/users`, {
    per_page: 100,
    "enrollment_type[]": "student",
    "include[]": ["enrollments", "email"],
    ...(opts.includeInactive
      ? { "enrollment_state[]": ["active", "invited", "inactive", "completed"] }
      : {}),
  });
  return StudentSchema.array().parse(json);
}

export function findStudentById(students: Student[], rawId: string): Student | undefined {
  const id = Number(rawId.trim());
  if (!Number.isFinite(id)) return undefined;
  return students.find((s) => s.id === id);
}

// Best-effort enrollment state summary, e.g. "active" or "invited, active"
// when a student has more than one enrollment in the course.
export function enrollmentStateOf(student: Student): string {
  const states = (student.enrollments ?? [])
    .map((e) => e.enrollment_state)
    .filter((s): s is string => Boolean(s));
  if (states.length === 0) return "—";
  return [...new Set(states)].join(", ");
}
