import type { IncomingTx } from "./tron-grid";

/**
 * 查询某 EVM 链收款地址的近期 USDT 入账，走 Etherscan V2 多链 API。
 * chainId / usdtContract 由 CHAINS 注册表提供（137=Polygon、42161=Arbitrum…）。
 * 各链 USDT 小数位不同，value 一律用 BigInt 解析。
 */
export async function fetchEvmIncoming(
  chainId: number,
  usdtContract: string,
  address: string,
  apiKey: string,
): Promise<IncomingTx[]> {
  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", String(chainId));
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "tokentx");
  url.searchParams.set("contractaddress", usdtContract);
  url.searchParams.set("address", address);
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", "100");
  url.searchParams.set("sort", "desc");
  if (apiKey) url.searchParams.set("apikey", apiKey);

  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    status: string;
    result?: Array<{
      hash: string;
      value: string;
      to: string;
      from: string;
      confirmations: string;
    }>;
  };
  if (!Array.isArray(data.result)) return [];
  const lower = address.toLowerCase();
  return data.result
    .filter((t) => t.to?.toLowerCase() === lower)
    .map((t) => ({
      txHash: t.hash,
      valueRaw: BigInt(t.value),
      to: t.to,
      from: t.from,
      confirmations: parseInt(t.confirmations || "0", 10),
    }));
}
