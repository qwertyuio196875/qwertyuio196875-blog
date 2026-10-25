// 后台 API 共享库：环境检查、Cookie、会话加解密、载荷校验、GitHub 请求。
// 运行在 Cloudflare Pages Functions（Workers 运行时）。
// 设计依据 docs/adr/0003-git-based-admin-publishing.md。

export interface Env {
  GH_OAUTH_CLIENT_ID?: string;
  GH_OAUTH_CLIENT_SECRET?: string;
  ADMIN_SESSION_SECRET?: string;
}

export interface Ctx {
  request: Request;
  env: Env;
}

export const OWNER_LOGIN = 'qwertyuio196875';
export const REPO = 'qwertyuio196875/qwertyuio196875-blog';
export const BRANCH = 'main';

export const STATE_COOKIE = 'adm_st';
export const SESSION_COOKIE = 'adm_ss';
export const SESSION_TTL_SEC = 7 * 24 * 3600;

// ---------- 响应与环境 ----------

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(init?.headers ?? {}) },
  });
}

export function missingEnv(env: Env): string[] {
  const pairs: Array<[string, string | undefined]> = [
    ['GH_OAUTH_CLIENT_ID', env.GH_OAUTH_CLIENT_ID],
    ['GH_OAUTH_CLIENT_SECRET', env.GH_OAUTH_CLIENT_SECRET],
    ['ADMIN_SESSION_SECRET', env.ADMIN_SESSION_SECRET],
  ];
  return pairs.filter(([, v]) => !v || !v.trim()).map(([k]) => k);
}

export function envError(missing: string[]): Response {
  return json(
    { error: `后台尚未配置：缺少环境变量 ${missing.join('、')}，配置方法见仓库 docs/admin-setup.md` },
    { status: 503 },
  );
}

// ---------- Cookie ----------

export function getCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

export function setCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

// ---------- 会话：GitHub 令牌封进 AES-GCM 加密 Cookie，页面脚本永远拿不到令牌 ----------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function bytesToB64Url(bytes: Uint8Array): string {
  return bytesToB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sessionKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function sealSession(env: Env, token: string): Promise<string> {
  const key = await sessionKey(env.ADMIN_SESSION_SECRET!);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(
    JSON.stringify({ token, expires: Date.now() + SESSION_TTL_SEC * 1000 }),
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext),
  );
  const out = new Uint8Array(iv.length + ciphertext.length);
  out.set(iv);
  out.set(ciphertext, iv.length);
  return bytesToB64Url(out);
}

export interface Session {
  token: string;
  expires: number;
}

export async function openSession(env: Env, request: Request): Promise<Session | null> {
  const raw = getCookie(request, SESSION_COOKIE);
  if (!raw || !env.ADMIN_SESSION_SECRET) return null;
  try {
    const key = await sessionKey(env.ADMIN_SESSION_SECRET);
    const bytes = b64UrlToBytes(raw);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, 12) },
      key,
      bytes.slice(12),
    );
    const session = JSON.parse(decoder.decode(plaintext)) as Session;
    if (!session.token || typeof session.expires !== 'number' || session.expires < Date.now())
      return null;
    return session;
  } catch {
    return null;
  }
}

// ---------- 发布载荷 ----------

export interface PublishBody {
  text: string;
  date: string; // 用户设备本地日期 YYYY-MM-DD
  time: string; // HHMM
  image?: { b64: string };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{4}$/;
const MAX_TEXT = 1000;
// 客户端已压缩到约 1600px / 几百 KB；这里只拦明显异常的体积
const MAX_IMAGE_B64 = 3.5 * 1024 * 1024;

export function validatePublish(raw: unknown): { ok: true; body: PublishBody } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: '请求体不是 JSON 对象' };
  const b = raw as Record<string, unknown>;

  const text = typeof b.text === 'string' ? b.text.replace(/\r\n?/g, '\n').trim() : '';
  if (!text) return { ok: false, error: '说说内容不能为空' };
  if (text.length > MAX_TEXT) return { ok: false, error: `说说内容超过 ${MAX_TEXT} 字上限` };

  const date = typeof b.date === 'string' ? b.date : '';
  const time = typeof b.time === 'string' ? b.time : '';
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return { ok: false, error: '日期或时间格式不正确' };
  const hh = Number(time.slice(0, 2));
  const mm = Number(time.slice(2, 4));
  const ts = Date.parse(`${date}T00:00:00Z`);
  if (hh > 23 || mm > 59 || Number.isNaN(ts) || Math.abs(ts - Date.now()) > 36 * 3600 * 1000)
    return { ok: false, error: '日期或时间数值不合法' };

  let image: { b64: string } | undefined;
  if (b.image !== undefined && b.image !== null) {
    if (typeof b.image !== 'object' || typeof (b.image as Record<string, unknown>).b64 !== 'string')
      return { ok: false, error: '配图数据不合法' };
    const b64 = (b.image as { b64: string }).b64;
    if (b64.length > MAX_IMAGE_B64) return { ok: false, error: '配图过大，请重新选择' };
    image = { b64 };
  }

  return { ok: true, body: { text, date, time, image } };
}

export function utf8ToB64(s: string): string {
  return bytesToB64(encoder.encode(s));
}

/** 组装说说 Markdown：与 src/content/moments/ 既有格式一致 */
export function momentMarkdown(body: PublishBody, imagePath?: string): string {
  const lines = ['---', `date: ${body.date}`];
  if (imagePath) lines.push(`image: ${imagePath}`);
  lines.push('---', '');
  return lines.join('\n') + '\n' + body.text + '\n';
}

// ---------- GitHub ----------

interface GhResult {
  status: number;
  body: Record<string, unknown> | null;
}

export async function gh(path: string, token: string, init?: RequestInit): Promise<GhResult> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'qwertyuio196875-blog-admin',
      ...(init?.headers ?? {}),
    },
  });
  let body: Record<string, unknown> | null = null;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* 空响应体 */
  }
  return { status: res.status, body };
}
