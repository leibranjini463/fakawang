import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: true });

/**
 * 渲染 Markdown → HTML 字符串。
 * 注意：数据源为管理员后台输入（可信）。若未来开放用户提交内容，
 * 需在此接入 sanitize（如 rehype-sanitize / DOMPurify）。
 */
export function renderMarkdown(md: string | null | undefined): string {
  if (!md) return "";
  return marked.parse(md, { async: false }) as string;
}
