export const NETWORK = "eip155:196"; // X Layer — the only OKX-supported settlement network
export const CHAIN_ID = 196;
export const USDT0_ADDRESS = "0x779Ded0c9e1022225f8E0630b35a9b54bE713736";
export const USDT0_DECIMALS = 6;
// USDT0's on-chain EIP-712 domain. name() is "USD₮0" (₮ = U+20AE, built from the code
// point so no file-encoding can corrupt it); version "1". Clients that sign EIP-3009
// locally (x402 pay-local) need this advertised in the 402 challenge's `extra`.
export const USDT0_EIP712_NAME = "USD" + String.fromCodePoint(0x20ae) + "0";
export const USDT0_EIP712_VERSION = "1";

export interface PaymentConfig {
  enabled: boolean;
  payTo: string;
  // Explicit atomic { amount, asset }. A "$0.03" USD string makes the SDK invoke a
  // scheme-side price parser that ExactEvmScheme doesn't implement.
  price: { amount: string; asset: string };
  maxTimeoutSeconds: number;
  okx: { apiKey: string; secretKey: string; passphrase: string; baseUrl?: string };
}

function toAtomic(price: string, decimals: number): string {
  const decimal = Number(String(price).replace(/[^0-9.]/g, "")) || 0;
  return BigInt(Math.round(decimal * 10 ** decimals)).toString();
}

export function loadPaymentConfig(): PaymentConfig {
  return {
    enabled: process.env.PAYMENTS_ENABLED === "true",
    payTo: process.env.PAY_TO_ADDRESS ?? "",
    price: { amount: toAtomic(process.env.PRICE ?? "0.03", USDT0_DECIMALS), asset: USDT0_ADDRESS },
    maxTimeoutSeconds: Number(process.env.MAX_TIMEOUT_SECONDS ?? 120),
    okx: {
      apiKey: process.env.OKX_API_KEY ?? "",
      secretKey: process.env.OKX_SECRET_KEY ?? "",
      passphrase: process.env.OKX_PASSPHRASE ?? "",
      baseUrl: process.env.OKX_BASE_URL || undefined,
    },
  };
}

export function assertPaymentConfig(c: PaymentConfig): void {
  const missing: string[] = [];
  if (!c.payTo) missing.push("PAY_TO_ADDRESS");
  if (!c.okx.apiKey) missing.push("OKX_API_KEY");
  if (!c.okx.secretKey) missing.push("OKX_SECRET_KEY");
  if (!c.okx.passphrase) missing.push("OKX_PASSPHRASE");
  if (missing.length)
    throw new Error(
      `PAYMENTS_ENABLED=true but missing: ${missing.join(", ")}. Set them in .env, or PAYMENTS_ENABLED=false for dev.`,
    );
}
