// POST /api/admin/publish —— 发布说说：把配图（可选）和 Markdown 提交进 GitHub 仓库，
// 推送后由 Cloudflare Pages 自动构建生效（约 1~2 分钟）。
import {
  BRANCH,
  REPO,
  gh,
  json,
  momentMarkdown,
  openSession,
  utf8ToB64,
  validatePublish,
} from './lib';
import type { Ctx } from './lib';

async function putFile(token: string, path: string, message: string, b64: string) {
  return gh(`/repos/${REPO}/contents/${path}`, token, {
    method: 'PUT',
    body: JSON.stringify({ message, branch: BRANCH, content: b64 }),
  });
}

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  const session = await openSession(env, request);
  if (!session) return json({ error: '未登录或登录已过期，请回到后台重新登录' }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: '请求体不是 JSON' }, { status: 400 });
  }
  const validated = validatePublish(raw);
  if (!validated.ok) return json({ error: validated.error }, { status: 400 });
  const body = validated.body;

  const stamp = `${body.date}-${body.time}`; // 2026-10-25-1430
  const mdPath = `src/content/moments/${stamp}.md`;

  // 配图：先传图，再把图写进说说 frontmatter
  let imagePath: string | undefined;
  if (body.image) {
    imagePath = `/moments/${stamp.replace(/-/g, '')}.jpg`;
    let put = await putFile(session.token, `public${imagePath}`, `moments: 配图 ${stamp}`, body.image.b64);
    if (put.status >= 300) {
      // 同一分钟发过第二条带图说说会撞文件名，加随机后缀重试一次
      imagePath = `/moments/${stamp.replace(/-/g, '')}-${Math.random().toString(36).slice(2, 4)}.jpg`;
      put = await putFile(session.token, `public${imagePath}`, `moments: 配图 ${stamp}`, body.image.b64);
    }
    if (put.status >= 300)
      return json(
        { error: `配图提交失败（GitHub ${put.status}）：${String(put.body?.message ?? '')}` },
        { status: 502 },
      );
  }

  const md = momentMarkdown(body, imagePath);
  const mdMessage = `moments: 发布说说 ${stamp}`;
  let mdPathFinal = mdPath;
  let put = await putFile(session.token, mdPathFinal, mdMessage, utf8ToB64(md));
  if (put.status >= 300) {
    // 同一分钟的第二条说说会撞文件名，加随机后缀重试一次
    mdPathFinal = `src/content/moments/${stamp}-${Math.random().toString(36).slice(2, 4)}.md`;
    put = await putFile(session.token, mdPathFinal, mdMessage, utf8ToB64(md));
  }
  if (put.status >= 300)
    return json(
      { error: `说说提交失败（GitHub ${put.status}）：${String(put.body?.message ?? '')}` },
      { status: 502 },
    );

  const commit = put.body?.commit as { html_url?: string } | undefined;
  return json({
    ok: true,
    path: mdPathFinal,
    imagePath,
    commitUrl: typeof commit?.html_url === 'string' ? commit.html_url : null,
  });
}
