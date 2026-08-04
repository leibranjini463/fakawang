import type { Order } from "@/db/schema";
import { deliveryEmailHtml, stockAlertHtml } from "./templates";

/** 通过 Resend HTTP API 发信。未配置 API Key 时跳过（仅日志），不阻塞主流程。 */
export async function sendMail(
  env: CloudflareEnv,
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.log(`[mail:skipped] to=${to} subject=${subject}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.MAIL_FROM || "Faka <onboarding@resend.dev>",
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) console.log(`[mail:failed] ${res.status} ${await res.text()}`);
    return res.ok;
  } catch (e) {
    console.log(`[mail:error]`, e);
    return false;
  }
}

export async function sendDeliveryEmail(
  env: CloudflareEnv,
  order: Order,
  cardContents: string[],
  siteName: string,
): Promise<void> {
  const html = deliveryEmailHtml(order, cardContents, siteName);
  await sendMail(env, order.contactEmail, `【${siteName}】订单 ${order.orderNo} 发货通知`, html);
}

export async function sendStockAlert(
  env: CloudflareEnv,
  to: string,
  items: { name: string; stock: number }[],
  siteName: string,
): Promise<void> {
  if (items.length === 0) return;
  const html = stockAlertHtml(items, siteName);
  await sendMail(env, to, `【${siteName}】库存告警（${items.length} 项）`, html);
}
