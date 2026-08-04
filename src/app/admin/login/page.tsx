"use client";
import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export default function AdminLoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <form action={action} className="card w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-3xl">🔐</div>
          <h1 className="mt-2 text-lg font-bold">后台登录</h1>
          <p className="text-xs text-[var(--fg-muted)]">首次登录将自动创建管理员账号</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">账号</label>
          <input name="username" className="input-base w-full px-3 py-2 text-sm" autoComplete="username" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">密码</label>
          <input
            name="password"
            type="password"
            className="input-base w-full px-3 py-2 text-sm"
            autoComplete="current-password"
          />
        </div>
        {state.error && <p className="text-sm text-red-500">{state.error}</p>}
        <button disabled={pending} className="btn-brand h-11 w-full rounded-xl font-semibold">
          {pending ? "登录中…" : "登录"}
        </button>
      </form>
    </div>
  );
}
