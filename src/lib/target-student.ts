import { join } from "node:path";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { CONFIG_DIR } from "./config";

const TARGET_STUDENT_PATH = join(CONFIG_DIR, "target-student.json");
const TTL_MS = 60 * 60 * 1000;

interface TargetStudent {
  courseId: number;
  studentId: number;
  savedAt: number;
}

async function readRaw(): Promise<TargetStudent | null> {
  try {
    const text = await readFile(TARGET_STUDENT_PATH, "utf8");
    const parsed = JSON.parse(text) as Partial<TargetStudent>;
    if (
      typeof parsed.courseId === "number" &&
      typeof parsed.studentId === "number" &&
      typeof parsed.savedAt === "number"
    ) {
      return {
        courseId: parsed.courseId,
        studentId: parsed.studentId,
        savedAt: parsed.savedAt,
      };
    }
  } catch {
    // no cache yet
  }
  return null;
}

function isFresh(t: TargetStudent): boolean {
  return Date.now() - t.savedAt < TTL_MS;
}

// Returns the target student id if one is cached, still fresh (within an
// hour), and bound to the given course. Returns null otherwise (e.g. the
// course changed or the cache expired).
export async function getTargetStudent(
  courseId: number,
): Promise<{ studentId: number } | null> {
  const t = await readRaw();
  if (!t || !isFresh(t) || t.courseId !== courseId) return null;
  return { studentId: t.studentId };
}

// Returns the active target student (course + student) if still fresh,
// regardless of which course is currently in context.
export async function getActiveTargetStudent(): Promise<
  { courseId: number; studentId: number } | null
> {
  const t = await readRaw();
  if (!t || !isFresh(t)) return null;
  return { courseId: t.courseId, studentId: t.studentId };
}

export async function setTargetStudent(
  courseId: number,
  studentId: number,
): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  const t: TargetStudent = { courseId, studentId, savedAt: Date.now() };
  await writeFile(TARGET_STUDENT_PATH, JSON.stringify(t, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
}

// Forgets any cached target student (e.g. when the target course changes).
export async function clearTargetStudent(): Promise<void> {
  try {
    await unlink(TARGET_STUDENT_PATH);
  } catch {
    // already absent
  }
}

// Resolves the active target student's course without prompting, so
// `students ls` / `students export` can skip the course picker when a fresh
// target exists. Returns null when there is no fresh target or the course is
// no longer listed (callers fall back to the normal picker flow).
export async function resolveTargetCourse(
  config: import("./config").CanvasConfig,
): Promise<import("./course").ResolvedCourse | null> {
  const active = await getActiveTargetStudent();
  if (!active) return null;
  const { getCachedCourses } = await import("./course-cache");
  const courses = await getCachedCourses(config);
  const course = courses.find((c) => c.id === active.courseId);
  if (!course) return null;
  return { id: course.id, course };
}
