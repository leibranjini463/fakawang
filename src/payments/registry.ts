import { alipayF2FProvider } from "./providers/alipay-f2f";
import { alipayPersonalProvider } from "./providers/alipay-personal";
import { binancePayProvider } from "./providers/binance-pay";
import { epayProvider } from "./providers/epay";
import { mockProvider } from "./providers/mock";
import { usdtProvider } from "./providers/usdt";
import type { PaymentProvider } from "./types";

const registry: Record<string, PaymentProvider> = {
  mock: mockProvider,
  epay: epayProvider,
  alipay_f2f: alipayF2FProvider,
  alipay_personal: alipayPersonalProvider,
  usdt: usdtProvider,
  binance_pay: binancePayProvider,
};

export function getProvider(code: string): PaymentProvider | null {
  return registry[code] ?? null;
}

export function allProviders(): PaymentProvider[] {
  return Object.values(registry);
}
