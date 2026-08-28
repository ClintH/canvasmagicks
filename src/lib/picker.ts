import { search } from "@inquirer/prompts";

export interface PickItem<T> {
  label: string;
  value: T;
}

interface SearchPickOptions<T> {
  message: string;
  defaultItem?: PickItem<T>;
  defaultPrefix?: string;
}

// A searchable single-select prompt. When `defaultItem` is supplied it is
// pinned to the top of the list so the user can accept it with ENTER, or keep
// typing to narrow down and choose a different value.
export async function searchPick<T>(
  items: PickItem<T>[],
  opts: SearchPickOptions<T>,
): Promise<T | null> {
  const defaultEntry: PickItem<T> | undefined = opts.defaultItem
    ? {
        label: `${opts.defaultPrefix ?? "Use default: "}${opts.defaultItem.label}`,
        value: opts.defaultItem.value,
      }
    : undefined;

  try {
    const picked = await search<T>({
      message: opts.message,
      source: async (input) => {
        const q = (input ?? "").toLowerCase().trim();
        const out: { name: string; value: T }[] = [];
        const push = (it: PickItem<T>) =>
          out.push({ name: it.label, value: it.value });
        if (defaultEntry && (!q || defaultEntry.label.toLowerCase().includes(q))) {
          push(defaultEntry);
        }
        for (const it of items) {
          if (defaultEntry && it.value === defaultEntry.value) continue;
          if (!q || it.label.toLowerCase().includes(q)) push(it);
        }
        return out;
      },
    });
    return picked ?? null;
  } catch {
    return null;
  }
}
