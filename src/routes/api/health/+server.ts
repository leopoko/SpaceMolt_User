import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

/**
 * Health check endpoint for debugging Redis configuration.
 * Returns which env vars are set (values are masked).
 */
export const GET: RequestHandler = async () => {
  const vars = {
    KV_REST_API_URL: env.KV_REST_API_URL ? 'set' : 'missing',
    KV_REST_API_TOKEN: env.KV_REST_API_TOKEN ? 'set' : 'missing',
    UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL ? 'set' : 'missing',
    UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN ? 'set' : 'missing',
  };

  const configured = (vars.KV_REST_API_URL === 'set' && vars.KV_REST_API_TOKEN === 'set')
    || (vars.UPSTASH_REDIS_REST_URL === 'set' && vars.UPSTASH_REDIS_REST_TOKEN === 'set');

  // Quick connectivity test if configured
  let redisOk = false;
  if (configured) {
    try {
      const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL!;
      const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN!;
      const { Redis } = await import('@upstash/redis');
      const redis = new Redis({ url, token });
      await redis.ping();
      redisOk = true;
    } catch (e) {
      redisOk = false;
    }
  }

  return json({
    status: configured ? (redisOk ? 'ok' : 'redis_error') : 'not_configured',
    env_vars: vars,
    redis_connected: redisOk,
  });
};
