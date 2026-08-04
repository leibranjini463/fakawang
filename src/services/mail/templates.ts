import type { Order } from "@/db/schema";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const wrap = (inner: string) => `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a2e">
  ${inner}
  <p style="color:#9aa0b0;font-size:12px;margin-top:24px">本邮件由系统自动发送，请勿直接回复。</p>
</div>`;

export function deliveryEmailHtml(order: Order, cardContents: string[], siteName: string): string {
  const items = cardContents
    .map(
      (c) =>
        `<li style="background:#f6f6fb;border:1px solid #ececf2;border-radius:8px;padding:10px 12px;margin:6px 0;font-family:ui-monospace,Menlo,monospace;word-break:break-all">${escapeHtml(c)}</li>`,
    )
    .join("");
  return wrap(`
    <h2 style="margin:0 0 8px">✅ 支付成功，卡密如下</h2>
    <p style="color:#6b7280;margin:0 0 16px">${escapeHtml(siteName)} · 订单号 <b>${escapeHtml(order.orderNo)}</b></p>
    <p>商品：<b>${escapeHtml(order.productName)}${order.variantName ? ` · ${escapeHtml(order.variantName)}` : ""}</b> × ${order.quantity}</p>
    <ol style="list-style:none;padding:0">${items}</ol>
    <p style="color:#6b7280;font-size:13px">请妥善保存。可凭「订单号 + 邮箱」在站内订单查询页随时找回。</p>
  `);
}

export function stockAlertHtml(items: { name: string; stock: number }[], siteName: string): string {
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #ececf2">${escapeHtml(i.name)}</td><td style="padding:6px 10px;border-bottom:1px solid #ececf2;color:#ed2168;font-weight:600">${i.stock}</td></tr>`,
    )
    .join("");
  return wrap(`
    <h2 style="margin:0 0 8px">⚠️ 库存告警</h2>
    <p style="color:#6b7280">${escapeHtml(siteName)} 以下商品库存偏低，请及时补货：</p>
    <table style="width:100%;border-collapse:collapse"><thead>
      <tr><th style="text-align:left;padding:6px 10px;color:#9aa0b0">商品</th><th style="text-align:left;padding:6px 10px;color:#9aa0b0">剩余</th></tr>
    </thead><tbody>${rows}</tbody></table>
  `);
}
