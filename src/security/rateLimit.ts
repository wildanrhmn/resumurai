import type { NextFunction, Request, Response } from "express";

/**
 * Fixed-window per-IP + global rate limiting, plus a rolling daily budget.
 * Paid x402 routes get a lenient limiter (callers cover their own cost); the free
 * /try route gets a tight limiter + a hard daily kill-switch (it spends OUR balance).
 */

interface Bucket {
  count: number;
  resetAt: number;
}

function makeLimiter(opts: { windowMs: number; perIp: number; global: number; label: string }) {
  const ipBuckets = new Map<string, Bucket>();
  let globalBucket: Bucket = { count: 0, resetAt: Date.now() + opts.windowMs };

  return function limiter(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    if (now >= globalBucket.resetAt) globalBucket = { count: 0, resetAt: now + opts.windowMs };
    const ip = req.ip ?? "unknown";
    let b = ipBuckets.get(ip);
    if (!b || now >= b.resetAt) {
      b = { count: 0, resetAt: now + opts.windowMs };
      ipBuckets.set(ip, b);
    }

    if (globalBucket.count >= opts.global || b.count >= opts.perIp) {
      const retry = Math.ceil((Math.min(b.resetAt, globalBucket.resetAt) - now) / 1000);
      res.setHeader("Retry-After", String(Math.max(1, retry)));
      res.status(429).json({ error: "Rate limit exceeded. Please retry shortly.", retry_after_seconds: retry });
      return;
    }
    b.count++;
    globalBucket.count++;

    // Opportunistic cleanup so the IP map can't grow unbounded.
    if (ipBuckets.size > 5000) for (const [k, v] of ipBuckets) if (now >= v.resetAt) ipBuckets.delete(k);
    next();
  };
}

export const paidLimiter = makeLimiter({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 600_000),
  perIp: Number(process.env.RATE_LIMIT_MAX ?? 20),
  global: Number(process.env.RATE_LIMIT_GLOBAL_MAX ?? 200),
  label: "paid",
});

export const demoLimiter = makeLimiter({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 600_000),
  perIp: Number(process.env.DEMO_RATE_MAX ?? 5),
  global: Number(process.env.DEMO_RATE_GLOBAL_MAX ?? 40),
  label: "demo",
});

/** Rolling 24h kill-switch for free calls — bounds our Claude spend. */
let dayCount = 0;
let dayResetAt = Date.now() + 86_400_000;
export function dailyBudget(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  if (now >= dayResetAt) {
    dayCount = 0;
    dayResetAt = now + 86_400_000;
  }
  const max = Number(process.env.DAILY_FREE_MAX ?? 400);
  if (dayCount >= max) {
    const retry = Math.ceil((dayResetAt - now) / 1000);
    res.status(429).json({
      limit_reached: true,
      error: "The free daily demo limit has been reached. It resets within 24 hours — or use the paid API endpoint.",
      retry_after_seconds: retry,
    });
    return;
  }
  dayCount++;
  next();
}
