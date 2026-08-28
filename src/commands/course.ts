import { loadConfig, patchConfig } from "../lib/config";
import { resolveCourse } from "../lib/course";
import { getActiveTargetPage, clearTargetPage } from "../lib/target-page";

export async function runCourse(): Promise<void> {
  const config = await loadConfig();
  if (!config) {
    console.error("Not authenticated. Run `canvas auth` first.");
    process.exitCode = 1;
    return;
  }

  const resolved = await resolveCourse(config, {});
  if (!resolved) {
    console.error("No course selected.");
    process.exitCode = 1;
    return;
  }

  // If the target course is changing, the bound target page is no longer valid.
  const activeTarget = await getActiveTargetPage();
  if (activeTarget && activeTarget.courseId !== resolved.id) {
    await clearTargetPage();
  }

  await patchConfig({
    defaultCourseId: resolved.id,
    defaultCourseCode: resolved.course.course_code,
  });

  console.log(
    `Default course set to '${resolved.course.name}' (${resolved.course.course_code}).`,
  );
}
