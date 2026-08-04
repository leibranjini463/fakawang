import { and, eq } from "drizzle-orm";
import { usdtAmountLocks, type Order } from "@/db/schema";
import { CHAINS, CHAIN_DECIMALS, microToDisplay, microToRaw, type UsdtChain } from "../money";
import type { PaymentProvider, VerifiedNotification } from "../types";
import { fetchTronIncoming, type IncomingTx } from "../watchers/tron-grid";
import { fetchEvmIncoming } from "../watchers/evm-scan";

type ChainConfig = { chain: UsdtChain; address: string; enabled?: boolean };

function chainOf(order: Order): UsdtChain | null {
  switch (order.payCurrency) {
    case "USDT-TRC20":
      return "TRC20";
    case "USDT-POLYGON":
      return "POLYGON";
    case "USDT-ARBITRUM":
      return "ARBITRUM";
    default:
      return null;
  }
}

/**
 * USDT 多链（TRC20 + Polygon + Arbitrum）唯一金额法收款。
 * config: { chains: [{ chain, address, enabled }] }
 * secrets: env.TRONGRID_API_KEY（TRON）/ env.ETHERSCAN_API_KEY（EVM，Etherscan V2 多链）
 */
export const usdtProvider: PaymentProvider = {
  code: "usdt",

  async createPayment(ctx, order, config) {
    const chain = chainOf(order);
    if (!chain) throw new Error("订单缺少 USDT 链信息");
    const chains = (config.chains as ChainConfig[] | undefined) ?? [];
    const cc = chains.find((c) => c.chain === chain);
    if (!cc?.address) throw new Error(`${chain} 未配置收款地址`);
    const amountMicro = Number(order.payAmount || "0");
    return {
      kind: "crypto",
      chain,
      address: cc.address,
      amountMicro,
      decimals: CHAIN_DECIMALS[chain],
      display: microToDisplay(amountMicro),
      expiresAt: order.expiresAt,
    };
  },

  async poll(ctx, pendingOrders, config) {
    const chains = (config.chains as ChainConfig[] | undefined) ?? [];
    const out: VerifiedNotification[] = [];

    const byChain: Partial<Record<UsdtChain, Order[]>> = {};
    for (const o of pendingOrders) {
      const c = chainOf(o);
      if (c) (byChain[c] ??= []).push(o);
    }

    for (const chain of Object.keys(byChain) as UsdtChain[]) {
      const cc = chains.find((c) => c.chain === chain);
      if (!cc?.address) continue;
      const meta = CHAINS[chain];

      let txs: IncomingTx[] = [];
      try {
        if (meta.kind === "tron") {
          txs = await fetchTronIncoming(
            cc.address,
            ctx.env.TRONGRID_API_KEY || "",
            Date.now() - 60 * 60 * 1000,
          );
        } else {
          txs = await fetchEvmIncoming(
            meta.evmChainId!,
            meta.usdtContract!,
            cc.address,
            ctx.env.ETHERSCAN_API_KEY || "",
          );
        }
      } catch {
        continue;
      }

      // 活跃金额锁：raw(BigInt) → 订单
      const locks = await ctx.db
        .select()
        .from(usdtAmountLocks)
        .where(and(eq(usdtAmountLocks.chain, chain), eq(usdtAmountLocks.released, false)));
      const rawMap = new Map<string, { orderId: number; amountMicro: number }>();
      for (const l of locks) {
        rawMap.set(microToRaw(l.amountMicro, chain).toString(), {
          orderId: l.orderId,
          amountMicro: l.amountMicro,
        });
      }

      const group = byChain[chain] ?? [];
      for (const tx of txs) {
        // EVM 链等待足够确认数防重组；TRON 由 only_confirmed 已保证终局
        if (
          meta.kind === "evm" &&
          meta.minConfirmations &&
          tx.confirmations < meta.minConfirmations
        ) {
          continue;
        }
        const hit = rawMap.get(tx.valueRaw.toString());
        if (!hit) continue;
        const order = group.find((o) => o.id === hit.orderId);
        if (!order) continue;
        out.push({
          orderNo: order.orderNo,
          providerTradeNo: tx.txHash,
          eventId: `usdt:${chain}:${tx.txHash}`,
          paidCurrency: `USDT-${chain}`,
          paidValue: hit.amountMicro,
          raw: JSON.stringify({ chain, txHash: tx.txHash, value: tx.valueRaw.toString() }),
        });
      }
    }
    return out;
  },
};
