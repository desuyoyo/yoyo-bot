// messageCreate.js — Модуль «Анти-спам и Модерация».
// Проверяет каждое сообщение на:
// 1. Запрещённые ссылки (не из белого списка).
// 2. Спам (слишком частые / одинаковые сообщения).

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../../config');

// Кэш сообщений для антиспама: Map<userId, Array<{ content, timestamp }>>
const messageCache = new Map();

// Регулярка для поиска URL
const URL_REGEX = /https?:\/\/[^\s]+/gi;

module.exports = {
  name: 'messageCreate',
  once: false,

  async execute(message, client) {
    // Игнорируем ботов и DM
    if (message.author.bot || !message.guild) return;

    // Игнорируем админов / модераторов
    if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

    // ── 1. Проверка ссылок ──
    const links = message.content.match(URL_REGEX);
    if (links) {
      const hasIllegalLink = links.some((link) => {
        const hostname = extractHostname(link);
        return !config.linkWhitelist.some((allowed) =>
          hostname === allowed || hostname.endsWith('.' + allowed),
        );
      });

      if (hasIllegalLink) {
        try {
          await message.delete();
          const warn = await message.channel.send(
            `⚠️ ${message.author}, ссылки на этот ресурс запрещены.`,
          );
          setTimeout(() => warn.delete().catch(() => {}), 5000);
          await sendModLog(client, message, 'Запрещённая ссылка', message.content);
        } catch (error) {
          console.error('❌ Ошибка удаления сообщения со ссылкой:', error);
        }
        return;
      }
    }

    // ── 2. Анти-спам ──
    const userId = message.author.id;
    const now = Date.now();

    if (!messageCache.has(userId)) {
      messageCache.set(userId, []);
    }

    const userMessages = messageCache.get(userId);
    userMessages.push({ content: message.content, timestamp: now });

    // Оставляем только сообщения в пределах окна
    const filtered = userMessages.filter(
      (m) => now - m.timestamp < config.spamTimeWindow,
    );
    messageCache.set(userId, filtered);

    // Проверяем: слишком много сообщений за короткое время
    if (filtered.length >= config.spamMessageLimit) {
      try {
        // Удаляем спам-сообщения из канала
        const messagesToDelete = await message.channel.messages.fetch({ limit: 20 });
        const spamMessages = messagesToDelete.filter(
          (m) => m.author.id === userId && now - m.createdTimestamp < config.spamTimeWindow,
        );
        await message.channel.bulkDelete(spamMessages).catch(() => {});

        // Таймаут пользователю
        await message.member.timeout(
          config.spamTimeoutDuration,
          'Автоматический таймаут за спам',
        );

        const warn = await message.channel.send(
          `🔇 ${message.author} получил таймаут за спам.`,
        );
        setTimeout(() => warn.delete().catch(() => {}), 10000);

        await sendModLog(client, message, 'Спам (Rate Limit)', `${filtered.length} сообщений за ${config.spamTimeWindow / 1000}с`);

        // Очищаем кэш пользователя
        messageCache.delete(userId);
      } catch (error) {
        console.error('❌ Ошибка обработки спама:', error);
      }
      return;
    }

    // Проверяем: одинаковые сообщения
    const duplicates = filtered.filter((m) => m.content === message.content);
    if (duplicates.length >= Math.ceil(config.spamMessageLimit / 2)) {
      try {
        const messagesToDelete = await message.channel.messages.fetch({ limit: 20 });
        const spamMessages = messagesToDelete.filter(
          (m) => m.author.id === userId && m.content === message.content,
        );
        await message.channel.bulkDelete(spamMessages).catch(() => {});

        await message.member.timeout(
          config.spamTimeoutDuration,
          'Автоматический таймаут за повторяющийся спам',
        );

        const warn = await message.channel.send(
          `🔇 ${message.author} получил таймаут за повторяющиеся сообщения.`,
        );
        setTimeout(() => warn.delete().catch(() => {}), 10000);

        await sendModLog(client, message, 'Повторяющийся спам', `"${message.content.substring(0, 100)}" × ${duplicates.length}`);

        messageCache.delete(userId);
      } catch (error) {
        console.error('❌ Ошибка обработки дублей:', error);
      }
    }
  },
};

// Извлечь хостнейм из URL.
function extractHostname(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Отправить лог в мод-канал.
async function sendModLog(client, message, reason, details) {
  if (!config.modLogChannelId) return;

  try {
    const logChannel = await client.channels.fetch(config.modLogChannelId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🛡️ Модерация')
      .addFields(
        { name: '👤 Пользователь', value: `${message.author.tag} (${message.author.id})`, inline: true },
        { name: '📌 Канал', value: `${message.channel}`, inline: true },
        { name: '⚠️ Причина', value: reason, inline: false },
        { name: '📄 Детали', value: details.substring(0, 1024) || '—', inline: false },
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('❌ Не удалось отправить лог модерации:', error);
  }
}
