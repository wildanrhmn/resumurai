/**
 * Circuit breaker. When the engine can't serve (Claude credit/auth/overload), we trip
 * a short breaker and reject BEFORE the payment gate — so a buyer is never charged for
 * a request we can't fulfil. A success closes it.
 */
let openUntil = 0;
const cooldown = () => Number(process.env.BREAKER_COOLDOWN_MS ?? 120_000);

export function isBreakerOpen(): boolean {
  return Date.now() < openUntil;
}
export function tripBreaker(): void {
  openUntil = Date.now() + cooldown();
}
export function closeBreaker(): void {
  openUntil = 0;
}
