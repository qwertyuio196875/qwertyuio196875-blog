// GET /api/admin/session —— 报告当前是否已登录（后台页加载时探测用）
import { OWNER_LOGIN, json, openSession } from './lib';
import type { Ctx } from './lib';

export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const session = await openSession(env, request);
  return json(
    session
      ? { authed: true, login: OWNER_LOGIN, expires: session.expires }
      : { authed: false },
  );
}
