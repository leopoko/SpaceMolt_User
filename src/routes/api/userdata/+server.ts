import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * User data sync API endpoint.
 *
 * Uses Upstash Redis (via Vercel Marketplace) to store per-user data blobs.
 * If Redis is not configured (no env vars), returns 503 gracefully.
 *
 * Data is keyed by `userdata:<username>` and stored as a JSON string.
 * A simple auth token (SHA-256 of username:password) is required to prevent
 * unauthorized reads/writes.
 *
 * GET /api/userdata?username=xxx
 *   Headers: Authorization: Bearer <token>
 *   Returns: { data: UserSyncData } or { data: null }
 *
 * PUT /api/userdata
 *   Headers: Authorization: Bearer <token>
 *   Body: { username: string, data: UserSyncData }
 *   Returns: { ok: true }
 */

function getRedis() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  // Dynamic import to avoid build errors when not configured
  return { url, token };
}

async function redisGet(key: string): Promise<string | null> {
  const cfg = getRedis();
  if (!cfg) return null;
  const { Redis } = await import('@upstash/redis');
  const redis = new Redis({ url: cfg.url, token: cfg.token });
  return redis.get<string>(key);
}

async function redisSet(key: string, value: string): Promise<void> {
  const cfg = getRedis();
  if (!cfg) return;
  const { Redis } = await import('@upstash/redis');
  const redis = new Redis({ url: cfg.url, token: cfg.token });
  await redis.set(key, value);
}

function getToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export const GET: RequestHandler = async ({ url, request }) => {
  const cfg = getRedis();
  if (!cfg) {
    return json({ data: null, reason: 'storage_not_configured' }, { status: 503 });
  }

  const username = url.searchParams.get('username');
  if (!username) {
    return json({ error: 'username required' }, { status: 400 });
  }

  const token = getToken(request);
  if (!token) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }

  // Verify token matches stored token for this user
  const storedToken = await redisGet(`usertoken:${username}`);
  if (storedToken && storedToken !== token) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }

  const raw = await redisGet(`userdata:${username}`);
  if (!raw) {
    return json({ data: null });
  }

  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return json({ data });
  } catch {
    return json({ data: null });
  }
};

export const PUT: RequestHandler = async ({ request }) => {
  const cfg = getRedis();
  if (!cfg) {
    return json({ ok: false, reason: 'storage_not_configured' }, { status: 503 });
  }

  const token = getToken(request);
  if (!token) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { username: string; data: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, { status: 400 });
  }

  if (!body.username || !body.data) {
    return json({ error: 'username and data required' }, { status: 400 });
  }

  // Store the auth token for this user (first writer sets the token)
  const storedToken = await redisGet(`usertoken:${body.username}`);
  if (storedToken && storedToken !== token) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!storedToken) {
    await redisSet(`usertoken:${body.username}`, token);
  }

  await redisSet(`userdata:${body.username}`, JSON.stringify(body.data));
  return json({ ok: true });
};
