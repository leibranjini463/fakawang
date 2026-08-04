export const metadata = { title: "隐私政策" };

export default function PrivacyPage() {
  return (
    <article className="prose-faka card mx-auto max-w-2xl">
      <h1>隐私政策</h1>
      <p>我们仅收集完成交易所必需的最少信息：</p>
      <ul>
        <li>下单邮箱：用于发送卡密与订单查询；</li>
        <li>订单与支付信息：用于交易结算与售后；</li>
        <li>访问日志（IP/UA）：用于风控与防刷。</li>
      </ul>
      <p>卡密内容在数据库中以 AES-256-GCM 加密存储，我们不会将您的个人信息出售或分享给无关第三方。</p>
      <p>支付过程由对应支付渠道处理，我们不接触您的支付账户密码等敏感凭证。</p>
    </article>
  );
}
