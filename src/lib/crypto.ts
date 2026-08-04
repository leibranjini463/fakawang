import { customAlphabet } from "nanoid";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const enc = (s: string) => encoder.encode(s);

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64decode(str: string): Uint8Array {
  const s = atob(str);
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}
function toHex(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}

/** 由任意长度密钥字符串派生 32B AES-GCM key（SHA-256）。 */
async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest("SHA-256", enc(secret));
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** AES-256-GCM 加密 → "v1:base64(iv‖ct‖tag)" */
export async function encryptSecret(plain: string, key: string): Promise<string> {
  const aesKey = await deriveAesKey(key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ctBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, enc(plain));
  const ct = new Uint8Array(ctBuf);
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return "v1:" + b64encode(out);
}

export async function decryptSecret(payload: string, key: string): Promise<string> {
  // 兼容：非 "v1:" 前缀视为明文（仅用于本地 seed 演示数据；生产数据均为 v1 加密）
  if (!payload.startsWith("v1:")) return payload;
  const raw = b64decode(payload.slice(3));
  const iv = raw.slice(0, 12);
  const ct = raw.slice(12);
  const aesKey = await deriveAesKey(key);
  const ptBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ct);
  return decoder.decode(ptBuf);
}

export async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc(input));
  return toHex(new Uint8Array(d));
}

// 免费档 Workers 每请求 CPU 约 10ms，PBKDF2 迭代数须压低才不超时；付费档应上调至 310_000
const PBKDF2_ITERS = 20_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const km = await crypto.subtle.importKey("raw", enc(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERS, hash: "SHA-256" },
    km,
    256,
  );
  return `pbkdf2$sha256$${PBKDF2_ITERS}$${b64encode(salt)}$${b64encode(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[2], 10);
  const salt = b64decode(parts[3]);
  const km = await crypto.subtle.importKey("raw", enc(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    km,
    256,
  );
  return safeEqual(b64encode(new Uint8Array(bits)), parts[4]);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** 随机十六进制 token（默认 32B → 64 hex），用于 session id 等。 */
export function randomToken(bytes = 32): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

// 对外订单号：日期前缀 + 14 位无歧义随机（防遍历）
const nano = customAlphabet("0123456789ABCDEFGHJKMNPQRSTVWXYZ", 14);
export function genOrderNo(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const prefix = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
  return prefix + nano();
}
