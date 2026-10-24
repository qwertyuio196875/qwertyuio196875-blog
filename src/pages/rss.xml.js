import rss from '@astrojs/rss';
import { render } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { SITE } from '../consts';
import { getEssays, plainText } from '../lib/content';

export const GET = async (context) => {
  const essays = await getEssays(); // 升序
  const reversed = [...essays].reverse(); // RSS 新→旧

  const container = await AstroContainer.create();

  const items = await Promise.all(
    reversed.map(async (e) => {
      const { Content } = await render(e.entry);
      const html = await container.renderToString(Content);
      return {
        title: e.title,
        link: `/essays/${e.id}/`,
        pubDate: e.date,
        description: plainText(e.entry.body).slice(0, 80) + '…',
        categories: e.tags,
        content: html, // 全文
      };
    }),
  );

  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site,
    items,
  });
};
