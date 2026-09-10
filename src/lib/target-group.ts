import { join } from "node:path";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { CONFIG_DIR } from "./config";

const TARGET_GROUP_PATH = join(CONFIG_DIR, "target-group.json");
const TTL_MS = 60 * 60 * 1000;

interface TargetGroup {
  courseId: number;
  categoryId: number;
  savedAt: number;
}

async function readRaw(): Promise<TargetGroup | null> {
  try {
    const text = await readFile(TARGET_GROUP_PATH, "utf8");
    const parsed = JSON.parse(text) as Partial<TargetGroup>;
    if (
      typeof parsed.courseId === "number" &&
      typeof parsed.categoryId === "number" &&
      typeof parsed.savedAt === "number"
    ) {
      return {
        courseId: parsed.courseId,
        categoryId: parsed.categoryId,
        savedAt: parsed.savedAt,
      };
    }
  } catch {
    // no cache yet
  }
  return null;
}

function isFresh(t: TargetGroup): boolean {
  return Date.now() - t.savedAt < TTL_MS;
}

// Returns the target group set (category) id if one is cached, still fresh
// (within an hour), and bound to the given course. Returns null otherwise
// (e.g. the course changed or the cache expired).
export async function getTargetGroup(
  courseId: number,
): Promise<{ categoryId: number } | null> {
  const t = await readRaw();
  if (!t || !isFresh(t) || t.courseId !== courseId) return null;
  return { categoryId: t.categoryId };
}

// Returns the active target group set (course + category) if still fresh,
// regardless of which course is currently in context.
export async function getActiveTargetGroup(): Promise<
  { courseId: number; categoryId: number } | null
> {
  const t = await readRaw();
  if (!t || !isFresh(t)) return null;
  return { courseId: t.courseId, categoryId: t.categoryId };
}

export async function setTargetGroup(
  courseId: number,
  categoryId: number,
): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  const t: TargetGroup = { courseId, categoryId, savedAt: Date.now() };
  await writeFile(TARGET_GROUP_PATH, JSON.stringify(t, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
}

// Forgets any cached target group set (e.g. when the target course changes).
export async function clearTargetGroup(): Promise<void> {
  try {
    await unlink(TARGET_GROUP_PATH);
  } catch {
    // already absent
  }
}

// Resolves the active target group set's course without prompting, so
// `groups ls` / `groups export` can skip the course picker when a fresh
// target exists. Returns null when there is no fresh target or the course is
// no longer listed (callers fall back to the normal picker flow).
export async function resolveTargetCourse(
  config: import("./config").CanvasConfig,
): Promise<import("./course").ResolvedCourse | null> {
  const active = await getActiveTargetGroup();
  if (!active) return null;
  const { getCachedCourses } = await import("./course-cache");
  const courses = await getCachedCourses(config);
  const course = courses.find((c) => c.id === active.courseId);
  if (!course) return null;
  return { id: course.id, course };
}
