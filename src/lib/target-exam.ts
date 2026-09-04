import { join } from "node:path";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { CONFIG_DIR } from "./config";

const TARGET_EXAM_PATH = join(CONFIG_DIR, "target-exam.json");
const TTL_MS = 60 * 60 * 1000;

interface TargetExam {
  courseId: number;
  examId: number;
  savedAt: number;
}

async function readRaw(): Promise<TargetExam | null> {
  try {
    const text = await readFile(TARGET_EXAM_PATH, "utf8");
    const parsed = JSON.parse(text) as Partial<TargetExam>;
    if (
      typeof parsed.courseId === "number" &&
      typeof parsed.examId === "number" &&
      typeof parsed.savedAt === "number"
    ) {
      return {
        courseId: parsed.courseId,
        examId: parsed.examId,
        savedAt: parsed.savedAt,
      };
    }
  } catch {
    // no cache yet
  }
  return null;
}

function isFresh(t: TargetExam): boolean {
  return Date.now() - t.savedAt < TTL_MS;
}

// Returns the target exam id if one is cached, still fresh (within an hour),
// and bound to the given course. Returns null otherwise (e.g. the course
// changed or the cache expired).
export async function getTargetExam(
  courseId: number,
): Promise<{ examId: number } | null> {
  const t = await readRaw();
  if (!t || !isFresh(t) || t.courseId !== courseId) return null;
  return { examId: t.examId };
}

// Returns the active target exam (course + exam) if still fresh, regardless of
// which course is currently in context.
export async function getActiveTargetExam(): Promise<
  { courseId: number; examId: number } | null
> {
  const t = await readRaw();
  if (!t || !isFresh(t)) return null;
  return { courseId: t.courseId, examId: t.examId };
}

export async function setTargetExam(
  courseId: number,
  examId: number,
): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  const t: TargetExam = { courseId, examId, savedAt: Date.now() };
  await writeFile(TARGET_EXAM_PATH, JSON.stringify(t, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
}

// Forgets any cached target exam (e.g. when the target course changes).
export async function clearTargetExam(): Promise<void> {
  try {
    await unlink(TARGET_EXAM_PATH);
  } catch {
    // already absent
  }
}

// Resolves the active target exam's course without prompting, so `exams get`
// / `exams ls` can skip the course picker when a fresh target exists. Returns
// null when there is no fresh target or the course is no longer listed
// (callers fall back to the normal picker flow).
export async function resolveTargetCourse(
  config: import("./config").CanvasConfig,
): Promise<import("./course").ResolvedCourse | null> {
  const active = await getActiveTargetExam();
  if (!active) return null;
  const { getCachedCourses } = await import("./course-cache");
  const courses = await getCachedCourses(config);
  const course = courses.find((c) => c.id === active.courseId);
  if (!course) return null;
  return { id: course.id, course };
}
