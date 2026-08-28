import { loadConfig } from "../lib/config";
import { getCachedCourses } from "../lib/course-cache";

export async function runCourses(): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.error("Not authenticated. Run `canvas auth` first.");
    process.exitCode = 1;
    return;
  }

  try {
    const courses = await getCachedCourses(config);
    console.table(
      courses.map((c) => ({
        code: c.course_code,
        name: c.name,
        id: c.id,
        state: c.workflow_state ?? "",
      })),
    );
  } catch (err) {
    console.error(`Failed to load courses: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}
