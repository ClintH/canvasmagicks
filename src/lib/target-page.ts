import { join } from "node:path";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { CONFIG_DIR } from "./config";

const TARGET_PAGE_PATH = join(CONFIG_DIR, "target-page.json");
const TTL_MS = 60 * 60 * 1000;

interface TargetPage {
  courseId: number;
  pageSlug: string;
  savedAt: number;
}

async function readRaw(): Promise<TargetPage | null> {
  try {
    const text = await readFile(TARGET_PAGE_PATH, "utf8");
    const parsed = JSON.parse(text) as Partial<TargetPage>;
    if (
      typeof parsed.courseId === "number" &&
      typeof parsed.pageSlug === "string" &&
      typeof parsed.savedAt === "number"
    ) {
      return {
        courseId: parsed.courseId,
        pageSlug: parsed.pageSlug,
        savedAt: parsed.savedAt,
      };
    }
  } catch {
    // no cache yet
  }
  return null;
}

function isFresh(t: TargetPage): boolean {
  return Date.now() - t.savedAt < TTL_MS;
}

// Returns the target page slug if one is cached, still fresh (within an hour),
// and bound to the given course. Returns null otherwise (e.g. the course
// changed or the cache expired).
export async function getTargetPage(
  courseId: number,
): Promise<{ pageSlug: string } | null> {
  const t = await readRaw();
  if (!t || !isFresh(t) || t.courseId !== courseId) return null;
  return { pageSlug: t.pageSlug };
}

// Returns the active target page (course + page) if still fresh, regardless of
// which course is currently in context. Used to default page-set's course.
export async function getActiveTargetPage(): Promise<
  { courseId: number; pageSlug: string } | null
> {
  const t = await readRaw();
  if (!t || !isFresh(t)) return null;
  return { courseId: t.courseId, pageSlug: t.pageSlug };
}

export async function setTargetPage(
  courseId: number,
  pageSlug: string,
): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  const t: TargetPage = { courseId, pageSlug, savedAt: Date.now() };
  await writeFile(TARGET_PAGE_PATH, JSON.stringify(t, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
}

// Forgets any cached target page (e.g. when the target course changes).
export async function clearTargetPage(): Promise<void> {
  try {
    await unlink(TARGET_PAGE_PATH);
  } catch {
    // already absent
  }
}
