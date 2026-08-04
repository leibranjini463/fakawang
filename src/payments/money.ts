export type UsdtChain = "TRC20" | "POLYGON" | "ARBITRUM";

export interface ChainMeta {
  /** 链类型：tron 走 TronGrid，evm 走 Etherscan V2 多链 API */
  kind: "tron" | "evm";
  /** 链上 USDT 小数位 */
  decimals: number;
  /** 前台展示名 */
  label: string;
  /** EVM 链 id（Etherscan V2 chainid），仅 evm 链 */
  evmChainId?: number;
  /** EVM 链上的 USDT 合约地址，仅 evm 链 */
  usdtContract?: string;
  /** EVM 入账所需最小确认数（防重组），仅 evm 链 */
  minConfirmations?: number;
}

/**
 * 支持的 USDT 收款链注册表（加新链只改这里）。
 * Polygon / Arbitrum 上 USDT 均为 6 位小数，与 TRC20 一致。
 */
export const CHAINS: Record<UsdtChain, ChainMeta> = {
  TRC20: { kind: "tron", decimals: 6, label: "TRON (TRC20)" },
  POLYGON: {
    kind: "evm",
    decimals: 6,
    label: "Polygon (PoS)",
    evmChainId: 137,
    usdtContract: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    minConfirmations: 30,
  },
  ARBITRUM: {
    kind: "evm",
    decimals: 6,
    label: "Arbitrum One",
    evmChainId: 42161,
    usdtContract: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    minConfirmations: 20,
  },
};

/** 各链 USDT 小数位（从 CHAINS 派生，兼容旧调用）。 */
export const CHAIN_DECIMALS: Record<UsdtChain, number> = {
  TRC20: CHAINS.TRC20.decimals,
  POLYGON: CHAINS.POLYGON.decimals,
  ARBITRUM: CHAINS.ARBITRUM.decimals,
};

/** 面值(micro,1e-6) → 链上原始最小单位（BigInt，避免 18 位小数精度溢出）。 */
export function microToRaw(amountMicro: number, chain: UsdtChain): bigint {
  const shift = CHAIN_DECIMALS[chain] - 6;
  return BigInt(amountMicro) * 10n ** BigInt(shift);
}

/** 链上原始最小单位 → 面值 micro（向下取整到 1e-6）。 */
export function rawToMicro(raw: bigint, chain: UsdtChain): number {
  const shift = CHAIN_DECIMALS[chain] - 6;
  return Number(raw / 10n ** BigInt(shift));
}

/** micro 面值 → 展示字符串，如 12345678 → "12.345678"（去尾零）。 */
export function microToDisplay(amountMicro: number): string {
  const neg = amountMicro < 0;
  const s = Math.abs(amountMicro).toString().padStart(7, "0");
  const int = s.slice(0, -6);
  const frac = s.slice(-6).replace(/0+$/, "");
  const body = frac ? `${int}.${frac}` : int;
  return neg ? `-${body}` : body;
}

/** CNY 分 + 汇率(1U=?CNY) → 基础 USDT micro（向上取整，宁多勿少）。 */
export function cnyCentsToUsdtMicro(payableCents: number, rate: number): number {
  const usdt = payableCents / 100 / rate;
  return Math.ceil(usdt * 1e6);
}
