/**
 * [INPUT]: Telegram Bot API 配置与消息内容
 * [OUTPUT]: 发送 Bot 文本消息的最小 HTTP 客户端
 * [POS]: Telegram 传输层；命令处理器只依赖此抽象，不直接拼接 HTTP 请求
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8000),
  });
  return response.ok;
}
