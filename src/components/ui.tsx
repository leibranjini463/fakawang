import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "brand" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  brand: "btn-brand",
  outline: "border bg-transparent hover:bg-[var(--bg-soft)]",
  ghost: "bg-transparent hover:bg-[var(--bg-soft)]",
  danger: "bg-red-500 text-white hover:brightness-105",
};
const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button({
  className,
  variant = "brand",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("input-base w-full px-3 py-2 text-sm", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn("input-base w-full px-3 py-2 text-sm", className)} {...props} />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("block text-sm font-medium mb-1.5", className)} {...props} />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card p-5", className)} {...props} />;
}

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "brand" | "green" | "gray" | "red" }) {
  const tones: Record<string, string> = {
    default: "bg-[var(--bg-soft)] text-[var(--fg-muted)]",
    brand: "bg-brand-100 text-brand-700",
    green: "bg-emerald-100 text-emerald-700",
    gray: "bg-gray-100 text-gray-600",
    red: "bg-red-100 text-red-600",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-[var(--fg-muted)]">{hint}</p>}
    </div>
  );
}
