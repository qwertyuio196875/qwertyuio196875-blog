// GET /api/admin/auth —— 发起 GitHub OAuth：设 state 防 CSRF，302 跳 GitHub 授权页
import { STATE_COOKIE, envError, json, missingEnv, setCookie } from './lib';
import type { Ctx } from './lib';

export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const missing = missingEnv(env);
  if (missing.length) return envError(missing);

  const state = crypto.randomUUID().replace(/-/g, '');
  const origin = new URL(request.url).origin;
  const params = new URLSearchParams({
    client_id: env.GH_OAUTH_CLIENT_ID!,
    redirect_uri: `${origin}/admin/`,
    scope: 'public_repo',
    state,
  });

  return new Response(null, {
    status: 302,
    headers: {
      location: `https://github.com/login/oauth/authorize?${params}`,
      'set-cookie': setCookie(STATE_COOKIE, state, 600),
    },
  });
}
