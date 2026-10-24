// 构建时拉取 GitHub 公开仓库清单，写入 src/generated/projects.json。
// 未认证限额 60 次/小时，对单人仓库清单足够。
// 排除清单：fork、归档、私有、名字在 EXCLUDE_NAMES 里的仓库。
// API 失败（限流/断网）时保留上一份文件，不让构建挂掉。
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GITHUB_USER = 'qwertyuio196875';
const EXCLUDE_NAMES = new Set(['-']);
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'generated', 'projects.json');

async function main() {
  const res = await fetch(
    `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'qwertyuio196875-blog-build',
      },
    },
  );

  if (!res.ok) {
    console.warn(`[fetch-projects] GitHub API 返回 ${res.status}，保留现有 projects.json 不变。`);
    return;
  }

  const data = await res.json();
  const repos = data
    .filter((r) => !r.fork && !r.archived && !r.private && !EXCLUDE_NAMES.has(r.name))
    .sort(
      (a, b) =>
        (b.stargazers_count || 0) - (a.stargazers_count || 0) ||
        String(b.pushed_at).localeCompare(String(a.pushed_at)),
    )
    .map((r) => ({
      name: r.name,
      description: r.description || '',
      language: r.language || '',
      stars: r.stargazers_count || 0,
      url: r.html_url,
      updated: r.pushed_at,
    }));

  const out = {
    generatedAt: new Date().toISOString(),
    source: 'github-api',
    repos,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`[fetch-projects] 已写入 ${repos.length} 个仓库。`);
}

main().catch((err) => {
  console.warn('[fetch-projects] 拉取失败，保留现有 projects.json：', err?.message || err);
});
