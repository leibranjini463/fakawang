import { NextResponse } from "next/server";
import { CHAINS, type UsdtChain } from "@/payments/money";
import {
  diagnoseRpc,
  fetchEvmIncoming,
  fetchEvmRecentTransfers,
} from "@/payments/watchers/evm-scan";

/**
 * 临时探针：验证 EVM 链免 key 公共 RPC 查账是否通（上线验证后删除）。
 * GET /api/debug-evm?address=0x...（不传 address 只跑探针）
 * 只读公共链上数据，不读库、不写库、不含任何密钥。
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  if (params.get("diag") === "1") {
    return NextResponse.json({
      ok: true,
      diag: {
        POLYGON: await diagnoseRpc(137, CHAINS.POLYGON.usdtContract!),
        ARBITRUM: await diagnoseRpc(42161, CHAINS.ARBITRUM.usdtContract!),
      },
    });
  }
  const address = params.get("address") || undefined;
  const out: Record<string, unknown> = {};
  for (const chain of ["POLYGON", "ARBITRUM"] as UsdtChain[]) {
    const meta = CHAINS[chain];
    try {
      const probe = await fetchEvmRecentTransfers(meta.evmChainId!, meta.usdtContract!, 10);
      const row: Record<string, unknown> = {
        latest: probe.latest,
        rpcUrl: probe.rpcUrl,
        probeCount10blocks: probe.count,
        probeSample: probe.sample.map((t) => ({
          txHash: t.txHash,
          valueRaw: t.valueRaw.toString(),
          confirmations: t.confirmations,
        })),
      };
      if (address) {
        const incoming = await fetchEvmIncoming(meta.evmChainId!, meta.usdtContract!, address);
        row.incoming30min = incoming.length;
        row.incomingSample = incoming.slice(0, 3).map((t) => ({
          txHash: t.txHash,
          valueRaw: t.valueRaw.toString(),
          confirmations: t.confirmations,
        }));
      }
      out[chain] = row;
    } catch (e) {
      out[chain] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return NextResponse.json({ ok: true, keyless: true, chains: out });
}
