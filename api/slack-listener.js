import axios from "axios";

// === 可修改區 ===
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const TARGET_CHANNEL_NAME = "KHH - Tao Long";
const KEYWORDS = ["錯誤", "警告", "urgent", "🔥"];
// ===============

// 用 cache 避免每次都呼叫 Slack API
let cachedChannelId = null;

async function getChannelIdByName(channelName) {
  if (cachedChannelId) return cachedChannelId;

  const res = await axios.get("https://slack.com/api/conversations.list", {
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
  });

  if (!res.data.ok) throw new Error("Failed to get channel list from Slack");

  const channel = res.data.channels.find(c => c.name === channelName);
  if (!channel) throw new Error(`Channel "${channelName}" not found.`);

  cachedChannelId = channel.id;
  console.log(`✅ Found channel ID: ${channel.id}`);
  return channel.id;
}

async function sendToTelegram(message) {
  await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
  });
}

export default async function handler(req, res) {
  // Slack 驗證階段
  if (req.body?.type === "url_verification") {
    return res.status(200).send(req.body.challenge);
  }

  try {
    const event = req.body.event;
    if (!event || event.type !== "message" || event.bot_id) {
      return res.status(200).send("ignored");
    }

    const channelId = await getChannelIdByName(TARGET_CHANNEL_NAME);
    if (event.channel !== channelId) {
      return res.status(200).send("different channel, ignored");
    }

    const text = event.text || "";
    if (KEYWORDS.some(k => text.includes(k))) {
      const message = `📢 [${TARGET_CHANNEL_NAME}] 偵測到關鍵字訊息：\n${text}`;
      await sendToTelegram(message);
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).send("error");
  }
}
