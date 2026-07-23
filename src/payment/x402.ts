import type { RequestHandler } from "express";
import {
  assertPaymentConfig,
  loadPaymentConfig,
  NETWORK,
  USDT0_DECIMALS,
  USDT0_EIP712_NAME,
  USDT0_EIP712_VERSION,
} from "./config.js";

/**
 * OKX Payment SDK wiring (github.com/okx/payments). Export names verified against the
 * installed packages: OKXFacilitatorClient (x402-core); x402ResourceServer,
 * x402HTTPResourceServer, paymentMiddlewareFromHTTPServer (x402-express);
 * ExactEvmScheme (x402-evm/exact/server — the SERVER scheme, implements parsePrice).
 * Loaded via dynamic import so dev mode (PAYMENTS_ENABLED=false) never touches them.
 */

export interface PaymentLayer {
  middleware: RequestHandler;
  initialize: () => Promise<void>;
}

export async function createPaymentLayer(routeKeys: string[]): Promise<PaymentLayer> {
  const cfg = loadPaymentConfig();
  assertPaymentConfig(cfg);

  const core: any = await import("@okxweb3/x402-core" as string);
  const evm: any = await import("@okxweb3/x402-evm/exact/server" as string);
  const srv: any = await import("@okxweb3/x402-express" as string);

  const facilitatorClient = new core.OKXFacilitatorClient({
    apiKey: cfg.okx.apiKey,
    secretKey: cfg.okx.secretKey,
    passphrase: cfg.okx.passphrase,
    ...(cfg.okx.baseUrl ? { baseUrl: cfg.okx.baseUrl } : {}),
    syncSettle: true,
  });

  const resourceServer = new srv.x402ResourceServer(facilitatorClient).register(
    NETWORK,
    new evm.ExactEvmScheme(),
  );

  // Same terms on every gated route. We gate GET and POST because OKX's x402-check
  // and buyer agents probe GET, while our own callers POST.
  const accepts = {
    scheme: "exact",
    network: NETWORK,
    payTo: cfg.payTo,
    price: cfg.price,
    maxTimeoutSeconds: cfg.maxTimeoutSeconds,
    // USDT0 isn't in OKX's token list, so advertise its EIP-712 domain + decimals.
    extra: { name: USDT0_EIP712_NAME, version: USDT0_EIP712_VERSION, decimals: USDT0_DECIMALS },
  };
  const routes = Object.fromEntries(routeKeys.map((k) => [k, { accepts }]));
  const httpServer = new srv.x402HTTPResourceServer(resourceServer, routes);

  // 4th arg false disables the SDK's fire-and-forget facilitator sync (uncatchable
  // rejection). We call initialize() ourselves, guarded, after listen().
  return {
    middleware: srv.paymentMiddlewareFromHTTPServer(httpServer, undefined, undefined, false),
    initialize: () => resourceServer.initialize(),
  };
}
