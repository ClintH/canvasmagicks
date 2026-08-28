import type { CanvasConfig } from "./config";
import { CanvasClient, buildForm } from "./client";

export interface CanvasPage {
  id: number;
  title: string;
  url: string;
  body?: string;
  published?: boolean;
}

export async function listPages(
  config: CanvasConfig,
  courseId: number | string,
): Promise<CanvasPage[]> {
  const client = new CanvasClient(config);
  return (await client.getAll(`courses/${courseId}/pages`, {
    per_page: 100,
  })) as CanvasPage[];
}

export interface CreatePageInput {
  title: string;
  body: string;
  published?: boolean;
}

export async function createPage(
  config: CanvasConfig,
  courseId: number | string,
  input: CreatePageInput,
): Promise<CanvasPage> {
  const client = new CanvasClient(config);
  const form = buildForm(
    { title: input.title, body: input.body, published: input.published },
    "wiki_page",
  );
  return (await client.postForm(
    `courses/${courseId}/pages`,
    form,
  )) as CanvasPage;
}

export interface UpdatePageInput {
  body: string;
}

// Canvas identifies a page by its `url` slug in the API path, not the numeric
// `id`. `updatePage` accepts that slug.
export async function updatePage(
  config: CanvasConfig,
  courseId: number | string,
  pageUrl: string,
  input: UpdatePageInput,
): Promise<CanvasPage> {
  const client = new CanvasClient(config);
  const form = buildForm({ body: input.body }, "wiki_page");
  return (await client.putForm(
    `courses/${courseId}/pages/${encodeURIComponent(pageUrl)}`,
    form,
  )) as CanvasPage;
}

export function findPageBySlug(
  pages: CanvasPage[],
  slug: string,
): CanvasPage | undefined {
  const s = slug.trim().toLowerCase();
  return pages.find((p) => p.url.trim().toLowerCase() === s);
}
