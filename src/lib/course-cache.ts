import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { CONFIG_DIR, type CanvasConfig } from "./config";
import { getCourses, type CanvasCourse } from "./canvas";

const CACHE_PATH = join(CONFIG_DIR, "courses-cache.json");
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CourseCache {
  fetchedAt: number;
  courses: CanvasCourse[];
}

function isFresh(cache: CourseCache | null): cache is CourseCache {
  return cache !== null && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

async function readCache(): Promise<CourseCache | null> {
  try {
    const text = await readFile(CACHE_PATH, "utf8");
    const parsed = JSON.parse(text) as CourseCache;
    if (!Array.isArray(parsed.courses)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(courses: CanvasCourse[]): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  const cache: CourseCache = { fetchedAt: Date.now(), courses };
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
}

// Returns the list of courses, served from an hourly on-disk cache. Pass
// `forceRefresh` to bypass the cache (e.g. after the user changes courses).
export async function getCachedCourses(
  config: CanvasConfig,
  forceRefresh = false,
): Promise<CanvasCourse[]> {
  if (!forceRefresh) {
    const cached = await readCache();
    if (isFresh(cached)) {
      return cached.courses;
    }
  }

  const courses = await getCourses(config);
  await writeCache(courses);
  return courses;
}
