// POST /api/admin/token —— 用 GitHub 跳回的 code 换访问令牌；
// 校验 state、确认登录者就是站主，然后把令牌封进加密会话 Cookie。
import {
  OWNER_LOGIN,
  SESSION_COOKIE,
  SESSION_TTL_SEC,
  STATE_COOKIE,
  envError,
  gh,
  getCookie,
  json,
  missingEnv,
  sealSession,
  setCookie,
} from './lib';
import type { Ctx } from './lib';

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  const missing = missingEnv(env);
  if (missing.length) return envError(missing);

  let payload: { code?: string; state?: string };
  try {
    payload = (await request.json()) as { code?: string; state?: string };
  } catch {
    return json({ error: '请求体不是 JSON' }, { status: 400 });
  }

  const cookieState = getCookie(request, STATE_COOKIE);
  if (!payload.code || !payload.state || !cookieState || payload.state !== cookieState)
    return json({ error: '登录校验失败（state 不匹配），请回到后台重新登录' }, { status: 400 });

  const origin = new URL(request.url).origin;
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.GH_OAUTH_CLIENT_ID,
      client_secret: env.GH_OAUTH_CLIENT_SECRET,
      code: payload.code,
      redirect_uri: `${origin}/admin/`,
    }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error_description?: string };
  if (!tokenJson.access_token)
    return json(
      { error: `GitHub 授权失败：${tokenJson.error_description ?? 'code 无效或已过期'}` },
      { status: 401 },
    );

  const user = await gh('/user', tokenJson.access_token);
  const login = typeof user.body?.login === 'string' ? user.body.login : '';
  if (user.status !== 200 || login.toLowerCase() !== OWNER_LOGIN)
    return json({ error: `此账号（${login || '未知'}）无权使用后台` }, { status: 403 });

  const sealed = await sealSession(env, tokenJson.access_token);
  const headers = new Headers();
  headers.append('set-cookie', setCookie(SESSION_COOKIE, sealed, SESSION_TTL_SEC));
  headers.append('set-cookie', setCookie(STATE_COOKIE, '', 0)); // state 用完即焚
  return json({ ok: true, login: OWNER_LOGIN }, { headers });
}
