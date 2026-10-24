import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 随笔：有标题、日期、可选标签的 Markdown 长文
const essays = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/essays' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});

// 说说：无标题的短动态，按时间倒序，可附图（图片放 public/moments/）
const moments = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/moments' }),
  schema: z.object({
    date: z.coerce.date(),
    image: z.string().optional(),
  }),
});

// 关于：单篇 about.md
const about = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/about' }),
  schema: z.object({}),
});

export const collections = { essays, moments, about };
