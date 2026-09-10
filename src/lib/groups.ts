import type { CanvasConfig } from "./config";
import { CanvasClient } from "./client";
import {
  GroupCategorySchema,
  GroupSchema,
  GroupMemberSchema,
  type GroupCategory,
  type Group,
  type GroupMember,
} from "./schemas";
import { getTargetGroup } from "./target-group";
import { searchPick, type PickItem } from "./picker";
import { pairKey } from "../util/group-assignment";

export type { GroupCategory, Group, GroupMember } from "./schemas";

export async function listGroupCategories(
  config: CanvasConfig,
  courseId: number | string,
): Promise<GroupCategory[]> {
  const client = new CanvasClient(config);
  const json = await client.getAll(`courses/${courseId}/group_categories`, {
    per_page: 100,
  });
  return GroupCategorySchema.array().parse(json);
}

export function findGroupCategoryById(
  categories: GroupCategory[],
  rawId: string,
): GroupCategory | undefined {
  const id = Number(rawId.trim());
  if (!Number.isFinite(id)) return undefined;
  return categories.find((c) => c.id === id);
}

export async function listGroupsInCategory(
  config: CanvasConfig,
  categoryId: number | string,
): Promise<Group[]> {
  const client = new CanvasClient(config);
  const json = await client.getAll(`group_categories/${categoryId}/groups`, {
    per_page: 100,
  });
  return GroupSchema.array().parse(json);
}

export async function listGroupMembers(
  config: CanvasConfig,
  groupId: number | string,
): Promise<GroupMember[]> {
  const client = new CanvasClient(config);
  const json = await client.getAll(`groups/${groupId}/users`, {
    per_page: 100,
  });
  return GroupMemberSchema.array().parse(json);
}

// Resolves a single group set (category) for a course: an explicit id wins,
// then the cached target, then an interactive picker. Shared by `groups ls`
// and `groups export`, which both operate on one group set at a time.
export async function resolveGroupCategory(
  config: CanvasConfig,
  courseId: number,
  opts: { category?: string },
): Promise<GroupCategory | null> {
  let categories: GroupCategory[];
  try {
    categories = await listGroupCategories(config, courseId);
  } catch (err) {
    console.error(`Failed to load group sets: ${(err as Error).message}`);
    process.exitCode = 1;
    return null;
  }
  if (categories.length === 0) {
    console.error("This course has no group sets.");
    process.exitCode = 1;
    return null;
  }

  const explicit = opts.category?.trim() || "";
  if (explicit !== "") {
    const match = findGroupCategoryById(categories, explicit);
    if (!match) {
      console.error(
        `No group set with id '${explicit}' in this course. ` +
          `Check the id (e.g. with \`canvas groups target\`).`,
      );
      process.exitCode = 1;
      return null;
    }
    return match;
  }

  const target = await getTargetGroup(courseId);
  const defaultCategory = target
    ? categories.find((c) => c.id === target.categoryId)
    : undefined;
  if (defaultCategory) {
    console.log(`Using target group set '${defaultCategory.name}' (#${defaultCategory.id}).`);
    return defaultCategory;
  }
  if (target) {
    console.warn(
      `Warning: target group set #${target.categoryId} no longer exists in this course; choose another.`,
    );
  }

  const items: PickItem<string>[] = categories.map((c) => ({
    label: `${c.name} (#${c.id})`,
    value: String(c.id),
  }));
  const picked = await searchPick(items, { message: "Select a group set:" });
  if (picked === null) return null;
  return categories.find((c) => String(c.id) === picked) ?? null;
}

// Builds the set of student pairs that have already shared a group in any of
// the given (pre-existing) group sets, used by the jumble algorithm to avoid
// repeat pairings. Skips categories/groups that fail to load rather than
// aborting the whole run.
export async function buildPairHistory(
  config: CanvasConfig,
  categories: GroupCategory[],
): Promise<Set<string>> {
  const pairs = new Set<string>();
  for (const category of categories) {
    let groups: Group[];
    try {
      groups = await listGroupsInCategory(config, category.id);
    } catch (err) {
      console.warn(`Warning: could not load groups in '${category.name}': ${(err as Error).message}`);
      continue;
    }
    for (const group of groups) {
      let members: GroupMember[];
      try {
        members = await listGroupMembers(config, group.id);
      } catch (err) {
        console.warn(`Warning: could not load members of '${group.name}': ${(err as Error).message}`);
        continue;
      }
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          pairs.add(pairKey(members[i]!.id, members[j]!.id));
        }
      }
    }
  }
  return pairs;
}

// Canvas's Group Categories/Groups/Memberships endpoints take flat
// (unprefixed) form params, unlike the `wiki_page[...]`/`calendar_event[...]`
// nesting used elsewhere in this codebase.
export async function createGroupCategory(
  config: CanvasConfig,
  courseId: number | string,
  name: string,
): Promise<GroupCategory> {
  const client = new CanvasClient(config);
  const form = new URLSearchParams();
  form.set("name", name);
  const json = await client.postForm(`courses/${courseId}/group_categories`, form);
  return GroupCategorySchema.parse(json);
}

export async function createGroup(
  config: CanvasConfig,
  categoryId: number | string,
  name: string,
): Promise<Group> {
  const client = new CanvasClient(config);
  const form = new URLSearchParams();
  form.set("name", name);
  const json = await client.postForm(`group_categories/${categoryId}/groups`, form);
  return GroupSchema.parse(json);
}

export async function addGroupMember(
  config: CanvasConfig,
  groupId: number | string,
  userId: number,
): Promise<void> {
  const client = new CanvasClient(config);
  const form = new URLSearchParams();
  form.set("user_id", String(userId));
  await client.postForm(`groups/${groupId}/memberships`, form);
}
