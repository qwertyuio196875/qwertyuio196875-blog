import { getCollection, type CollectionEntry } from 'astro:content';

export interface EssayView {
  entry: CollectionEntry<'essays'>;
  id: string;
  title: string;
  date: Date;
  dateStr: string;
  tags: string[];
  no: string;
  words: number;
  minutes: number;
}

export interface MomentView {
  entry: CollectionEntry<'moments'>;
  id: string;
  date: Date;
  dateStr: string;
  image?: string;
}

export function formatDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

/** 粗略去掉 Markdown 标记，用于首页摘要预览 */
export function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 随笔按发布时间升序，编号 No.001 起 */
export async function getEssays(): Promise<EssayView[]> {
  const entries = await getCollection('essays');
  return entries
    .sort((a, b) => a.data.date.getTime() - b.data.date.getTime())
    .map((entry, i) => {
      const words = (entry.body ?? '').replace(/\s/g, '').length;
      return {
        entry,
        id: entry.id,
        title: entry.data.title,
        date: entry.data.date,
        dateStr: formatDate(entry.data.date),
        tags: entry.data.tags ?? [],
        no: `No.${String(i + 1).padStart(3, '0')}`,
        words,
        minutes: Math.max(1, Math.round(words / 400)),
      };
    });
}

/** 说说按时间倒序（最新的在前）；同一天的多条再按文件名倒序（文件名含 HHMM，新的在前） */
export async function getMoments(): Promise<MomentView[]> {
  const entries = await getCollection('moments');
  return entries
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || b.id.localeCompare(a.id))
    .map((entry) => ({
      entry,
      id: entry.id,
      date: entry.data.date,
      dateStr: formatDate(entry.data.date),
      image: entry.data.image,
    }));
}
