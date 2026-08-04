export interface IncomingTx {
  txHash: string;
  valueRaw: bigint;
  to: string;
  from: string;
  confirmations: number;
}

const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

/** 查询 TRC20 收款地址的近期 USDT 入账（only_confirmed=true 即已固化）。 */
export async function fetchTronIncoming(
  address: string,
  apiKey: string,
  sinceMs: number,
): Promise<IncomingTx[]> {
  const url = new URL(`https://api.trongrid.io/v1/accounts/${address}/transactions/trc20`);
  url.searchParams.set("only_to", "true");
  url.searchParams.set("only_confirmed", "true");
  url.searchParams.set("contract_address", USDT_TRC20_CONTRACT);
  url.searchParams.set("limit", "100");
  if (sinceMs > 0) url.searchParams.set("min_timestamp", String(sinceMs));

  const res = await fetch(url, {
    headers: apiKey ? { "TRON-PRO-API-KEY": apiKey } : {},
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: Array<{ transaction_id: string; value: string; to: string; from: string }>;
  };
  return (data.data ?? []).map((t) => ({
    txHash: t.transaction_id,
    valueRaw: BigInt(t.value),
    to: t.to,
    from: t.from,
    confirmations: 20, // only_confirmed 已保证终局
  }));
}
