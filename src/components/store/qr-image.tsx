"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function QrImage({ content, size = 180 }: { content: string; size?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(content, { width: size, margin: 1 })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [content, size]);

  if (!src) {
    return (
      <div
        style={{ width: size, height: size }}
        className="animate-pulse rounded-lg bg-[var(--bg-soft)]"
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt="支付二维码" className="rounded-lg bg-white p-1" />;
}
