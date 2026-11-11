import type { IncomingTx } from "./tron-grid";

/**
 * 查询某 EVM 链收款地址的近期 USDT 入账，走免 key 公共 RPC 的 eth_getLogs。
 *
 * 不再依赖 Etherscan API Key（此前 Etherscan 登录的人机验证在云浏览器上反复失败，
 * 密钥一直无法取回）。改为直接读链上 ERC20 Transfer 事件：
 * 按 USDT 合约 + Transfer topic + to=收款地址过滤，只扫最近 30 分钟的区块
 * （订单默认 10 分钟过期，30 分钟留足余量），分段查询以避开公共节点的
 * 单次区间限制；任一 RPC 不通就自动换下一个。
 *
 * chainId / usdtContract 由 CHAINS 注册表提供（137=Polygon、42161=Arbitrum…）。
 * 各链 USDT 小数位不同，value 一律用 BigInt 解析。
 */

/** ERC20 Transfer 事件签名 keccak("Transfer(address,address,uint256)") */
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** 免 key 公共 RPC（每链按顺序尝试，任一可用即返回）。 */
const PUBLIC_RPCS: Record<number, string[]> = {
  137: [
    "https://polygon-rpc.com",
    "https://polygon-bor-rpc.publicnode.com",
    "https://polygon.llamarpc.com",
    "https://rpc.ankr.com/polygon",
  ],
  42161: [
    "https://arb1.arbitrum.io/rpc",
    "https://arbitrum-one.publicnode.com",
    "https://arbitrum.llamarpc.com",
    "https://rpc.ankr.com/arbitrum",
  ],
};

/** 每分钟大约出块数（用于换算回扫区块数，取上限留余量）。 */
const BLOCKS_PER_MINUTE: Record<number, number> = { 137: 30, 42161: 250 };

/** 单次 eth_getLogs 的区块跨度（公共节点多有限制，分段查）。 */
const CHUNK_BLOCKS = 1000;

/** 往回扫的时间：订单默认 10 分钟过期，30 分钟留足余量。 */
const LOOKBACK_MINUTES = 30;

interface RpcLog {
  blockNumber: string;
  transactionHash: string;
  transactionIndex?: string;
  logIndex?: string;
  topics: string[];
  data: string;
}

/** 对某链依次尝试公共 RPC，任一成功即返回结果；全部失败则抛错。 */
async function callRpc(chainId: number, method: string, params: unknown[]): Promise<unknown> {
  const urls = PUBLIC_RPCS[chainId] ?? [];
  let lastErr: unknown = new Error("no public RPC configured for chain " + chainId);
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        // 单个节点挂住不拖垮整轮轮询（Workers 下 AbortSignal.timeout 可用）
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        result?: unknown;
        error?: { message?: string };
      };
      if (data.error) throw new Error(data.error.message || "RPC error");
      return data.result;
    } catch (e) {
      lastErr = e;
      console.log("[evm-scan:rpc-fail]", chainId, url, e instanceof Error ? e.message : e);
    }
  }
  throw lastErr;
}

async function getLatestBlock(chainId: number): Promise<number> {
  const hex = (await callRpc(chainId, "eth_blockNumber", [])) as string;
  const n = parseInt(hex, 16);
  if (!n) throw new Error("invalid latest block");
  return n;
}

/** 把一条 Transfer 日志解析为 IncomingTx；格式不对返回 null。 */
function parseTransferLog(log: RpcLog, latest: number): IncomingTx | null {
  try {
    if (!log.topics || log.topics.length < 3 || !log.data || !log.transactionHash) return null;
    const blockNumber = parseInt(log.blockNumber, 16);
    if (Number.isNaN(blockNumber)) return null;
    return {
      txHash: log.transactionHash,
      valueRaw: BigInt(log.data),
      to: `0x${log.topics[2].slice(26)}`,
      from: `0x${log.topics[1].slice(26)}`,
      confirmations: Math.max(0, latest - blockNumber),
    };
  } catch {
    return null;
  }
}

/**
 * 查某 EVM 链收款地址最近 30 分钟的 USDT 入账。
 * apiKey 参数保留仅为兼容旧调用，免 key 路线不再使用。
 */
export async function fetchEvmIncoming(
  chainId: number,
  usdtContract: string,
  address: string,
  _apiKey?: string,
): Promise<IncomingTx[]> {
  try {
    const latest = await getLatestBlock(chainId);
    const span = LOOKBACK_MINUTES * (BLOCKS_PER_MINUTE[chainId] ?? 30);
    const fromBlock = Math.max(0, latest - span);
    const paddedTo = `0x000000000000000000000000${address.toLowerCase().slice(2)}`;

    const ranges: Array<[number, number]> = [];
    for (let start = fromBlock; start <= latest; start += CHUNK_BLOCKS) {
      ranges.push([start, Math.min(latest, start + CHUNK_BLOCKS - 1)]);
    }
    // 分段并行查；个别段失败只丢该段（allSettled），不丢整轮结果
    const settled = await Promise.allSettled(
      ranges.map(([from, to]) =>
        callRpc(chainId, "eth_getLogs", [
          {
            fromBlock: `0x${from.toString(16)}`,
            toBlock: `0x${to.toString(16)}`,
            address: usdtContract,
            topics: [TRANSFER_TOPIC, null, paddedTo],
          },
        ]),
      ),
    );
    const chunks: RpcLog[][] = [];
    let failed = 0;
    for (const s of settled) {
      if (s.status === "fulfilled") chunks.push((s.value ?? []) as RpcLog[]);
      else failed++;
    }
    if (failed) console.log("[evm-scan:chunk-fail]", chainId, `${failed}/${ranges.length} ranges failed`);

    const seen = new Set<string>();
    const out: IncomingTx[] = [];
    for (const chunk of chunks) {
      const logs = (chunk ?? []) as RpcLog[];
      for (const log of logs) {
        const tx = parseTransferLog(log, latest);
        if (!tx) continue;
        const key = `${tx.txHash}:${log.logIndex ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(tx);
      }
    }
    return out;
  } catch (e) {
    console.log("[evm-scan:fetch-fail]", chainId, e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * 探针：查某 EVM 链 USDT 合约最近 N 个区块的全部 Transfer（不过滤收款地址），
 * 用于验证公共 RPC 通路与日志解析是否正常。返回最新块高与解析后的转账。
 */
export async function fetchEvmRecentTransfers(
  chainId: number,
  usdtContract: string,
  blocks = 10,
): Promise<{ latest: number; count: number; sample: IncomingTx[] }> {
  const latest = await getLatestBlock(chainId);
  const from = Math.max(0, latest - blocks + 1);
  const logs = (await callRpc(chainId, "eth_getLogs", [
    {
      fromBlock: `0x${from.toString(16)}`,
      toBlock: `0x${latest.toString(16)}`,
      address: usdtContract,
      topics: [TRANSFER_TOPIC],
    },
  ])) as RpcLog[];
  const txs = (logs ?? [])
    .map((log) => parseTransferLog(log, latest))
    .filter((t): t is IncomingTx => t !== null);
  return { latest, count: txs.length, sample: txs.slice(0, 3) };
}
