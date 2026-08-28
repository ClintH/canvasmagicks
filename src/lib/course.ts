import type { CanvasConfig } from "./config";
import type { CanvasCourse } from "./canvas";
import { getCachedCourses } from "./course-cache";
import { searchPick, type PickItem } from "./picker";

export interface ResolvedCourse {
  id: number;
  course: CanvasCourse;
}

function labelFor(course: CanvasCourse, favorite: boolean): string {
  const star = favorite ? "★ " : "";
  return `${star}${course.name} (${course.course_code})`;
}

// Presents a searchable course picker. When `defaultCourse` is supplied it is
// pinned to the top of the list so the user can accept it with ENTER, or keep
// typing to narrow down and choose a different course.
export async function pickCourseId(
  courses: CanvasCourse[],
  opts: { defaultCourse?: CanvasCourse; favoriteIds?: Set<string> },
): Promise<string | null> {
  const items: PickItem<string>[] = courses.map((c) => ({
    label: labelFor(c, opts.favoriteIds?.has(String(c.id)) ?? false),
    value: String(c.id),
  }));

  const defaultItem = opts.defaultCourse
    ? {
        label: labelFor(
          opts.defaultCourse,
          opts.favoriteIds?.has(String(opts.defaultCourse.id)) ?? false,
        ),
        value: String(opts.defaultCourse.id),
      }
    : undefined;

  return searchPick(items, { message: "Select a course:", defaultItem });
}

export async function resolveCourse(
  config: CanvasConfig,
  opts: { courseArg?: string; preferredDefaultCourseId?: number },
): Promise<ResolvedCourse | null> {
  const courses = await getCachedCourses(config);

  if (opts.courseArg && opts.courseArg.trim() !== "") {
    const code = opts.courseArg.trim().toLowerCase();
    const match = courses.find(
      (c) => c.course_code.trim().toLowerCase() === code,
    );
    if (!match) {
      console.error(
        `No course found with course code '${opts.courseArg}'. ` +
          `Check the code (e.g. with \`canvas courses\`).`,
      );
      return null;
    }
    return { id: match.id, course: match };
  }

  const preferredId = opts.preferredDefaultCourseId ?? config.defaultCourseId;
  const defaultCourse =
    preferredId !== undefined
      ? courses.find((c) => c.id === preferredId)
      : undefined;

  let favoriteIds: Set<string> | undefined;
  if (defaultCourse) {
    try {
      const { listFavoriteCourses } = await import("./calendar");
      const favs = await listFavoriteCourses(config);
      favoriteIds = new Set(favs.map((c) => String(c.id)));
    } catch {
      favoriteIds = undefined;
    }
  }

  const pickedId = await pickCourseId(courses, { defaultCourse, favoriteIds });
  if (pickedId === null) return null;

  const course = courses.find((c) => String(c.id) === pickedId);
  if (!course) return null;

  return { id: course.id, course };
}
