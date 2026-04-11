// config.js — Централизованная конфигурация бота.
// Считывает переменные из .env и экспортирует готовые к использованию значения.

require('dotenv').config();

module.exports = {
  // ── Основные ──
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,

  // ── Временные комнаты ──
  // Парсим строку "ID:LIMIT,ID:LIMIT,..." → Map<channelId, userLimit>
  voiceGenerators: (() => {
    const map = new Map();
    const raw = process.env.VOICE_GENERATORS || '';
    if (raw.trim()) {
      raw.split(',').forEach((entry) => {
        const [id, limit] = entry.trim().split(':');
        if (id) map.set(id, parseInt(limit, 10) || 0);
      });
    }
    return map;
  })(),

  // ── Модерация ──
  modLogChannelId: process.env.MOD_LOG_CHANNEL_ID || '',
  linkWhitelist: (process.env.LINK_WHITELIST || '').split(',').map((d) => d.trim()).filter(Boolean),
  spamMessageLimit: parseInt(process.env.SPAM_MESSAGE_LIMIT, 10) || 5,
  spamTimeWindow: parseInt(process.env.SPAM_TIME_WINDOW, 10) || 5000,
  spamTimeoutDuration: parseInt(process.env.SPAM_TIMEOUT_DURATION, 10) || 60000,

  // ── Музыка ──
  musicIdleTimeout: parseInt(process.env.MUSIC_IDLE_TIMEOUT, 10) || 120000,

  // ── Интеграция Telegram ──
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  discordNewsChannelId: process.env.DISCORD_NEWS_CHANNEL_ID || '',
  telegramSourceChannelId: process.env.TELEGRAM_CHANNEL_ID || '',
};
