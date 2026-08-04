/** 校验 Cloudflare Turnstile token。本地用官方测试密钥时恒真。 */
export async function verifyTurnstile(
  token: string | null | undefined,
  secret: string,
  ip?: string,
): Promise<boolean> {
  // 官方测试密钥：本地开发直接放行（即使无 token）
  if (secret === "1x0000000000000000000000000000000AA") return true;
  if (!token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
