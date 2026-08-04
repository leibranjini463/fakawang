"use client";
import { useActionState, useState } from "react";
import { importCards } from "@/app/admin/actions";

type State = { added?: number; dup?: number; error?: string };

export interface ImportProduct {
  id: number;
  name: string;
  hasVariants: boolean;
  variants: { id: number; name: string }[];
}

export function CardImport({ products }: { products: ImportProduct[] }) {
  const [state, action, pending] = useActionState<State, FormData>(importCards, {});
  const [productId, setProductId] = useState(products[0]?.id ?? 0);
  const current = products.find((p) => p.id === productId);

  return (
    <form action={action} className="card space-y-3">
      <div className="font-semibold">批量导入卡密</div>
      <select
        name="productId"
        value={productId}
        onChange={(e) => setProductId(Number(e.target.value))}
        className="input-base w-full px-3 py-2 text-sm"
      >
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.hasVariants ? "（多规格）" : ""}
          </option>
        ))}
      </select>

      {current?.hasVariants && (
        <select name="variantId" required className="input-base w-full px-3 py-2 text-sm">
          <option value="">— 请选择规格 —</option>
          {current.variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      )}

      <textarea
        name="content"
        rows={6}
        placeholder="每行一个卡密，重复的会自动去重跳过"
        className="input-base w-full px-3 py-2 font-mono text-sm"
      />
      <button disabled={pending} className="btn-brand h-10 rounded-xl px-6 text-sm font-semibold">
        {pending ? "导入中…" : "导入"}
      </button>
      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
      {state.added != null && (
        <p className="text-sm text-emerald-600">
          ✅ 成功导入 {state.added} 条，去重跳过 {state.dup} 条
        </p>
      )}
    </form>
  );
}
