/**
 * @file service.js
 * @description Основная логика получения постов из Telegram и их пересылка через Discord Webhook.
 */

const { Telegraf } = require('telegraf');
const { AttachmentBuilder, WebhookClient, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const { processPostText } = require('./utils/formatter');

// Буфер для группировки медиа (media_group_id -> { messages: [], timer })
const mediaGroups = new Map();

/**
 * Инициализирует модуль Telegram при старте Discord бота
 * @param {import('discord.js').Client} client Клиент Discord
 */
async function initTelegramBot(client) {
  if (!config.telegramToken || !config.discordNewsChannelId) {
    console.warn('  ⚠ Telegram: Не заданы TELEGRAM_BOT_TOKEN или DISCORD_NEWS_CHANNEL_ID в .env. Модуль кросспостинга отключен.');
    return;
  }

  const tgBot = new Telegraf(config.telegramToken);

  tgBot.on('channel_post', async (ctx) => {
    try {
      const post = ctx.channelPost;

      // Фильтрация по нужному каналу (если задан)
      if (config.telegramSourceChannelId) {
        let expectedId = config.telegramSourceChannelId;
        if (expectedId.startsWith('@')) {
           if (`@${post.chat.username}` !== expectedId) return;
        } else {
           if (post.chat.id.toString() !== expectedId) return;
        }
      }

      // Игнорируем пересланные посты (forwarded messages)
      if (post.forward_origin || post.forward_from_chat || post.forward_date) {
        return;
      }

      // Группировка медиа: Telegram присылает несколько постов с одинаковым media_group_id
      if (post.media_group_id) {
        if (!mediaGroups.has(post.media_group_id)) {
          mediaGroups.set(post.media_group_id, {
            messages: [],
            timer: setTimeout(() => processMediaGroup(post.media_group_id, client, tgBot), 3000)
          });
        }
        mediaGroups.get(post.media_group_id).messages.push(post);
      } else {
        // Это одиночный пост
        await sendDiscordPost(post, [post], client, tgBot);
      }
    } catch (err) {
      console.error('❌ Ошибка обработки Telegram поста:', err);
    }
  });

  tgBot.launch().then(() => {
    console.log('  ✔ Telegram бот успешно запущен и слушает новые посты.');
  }).catch((err) => {
    console.error('❌ Ошибка запуска Telegram бота:', err);
  });

  // Останавливаем Telegram-бота при закрытии процесса для корректного выхода
  process.once('SIGINT', () => { try { tgBot.stop('SIGINT'); } catch (e) {} });
  process.once('SIGTERM', () => { try { tgBot.stop('SIGTERM'); } catch (e) {} });
}

/**
 * Получает или автоматически создает вебхук для целевого канала Discord.
 */
async function getWebhook(client) {
  try {
    const channel = await client.channels.fetch(config.discordNewsChannelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error('Канал не найден или не является текстовым.');
    }

    const webhooks = await channel.fetchWebhooks();
    // Ищем вебхук, созданный нашим ботом
    let webhook = webhooks.find(wh => wh.owner.id === client.user.id);

    if (!webhook) {
      webhook = await channel.createWebhook({
        name: 'Telegram News',
        avatar: client.user.displayAvatarURL(),
      });
    }

    return new WebhookClient({ id: webhook.id, token: webhook.token });
  } catch (error) {
    console.error('❌ Ошибка получения webhook для Telegram-кросспостинга:', error);
    return null;
  }
}

/**
 * Скачивает файл с серверов Telegram и возвращает AttachmentBuilder.
 */
async function createAttachment(fileArrayOrObject, tgBot) {
  let fileId;
  let ext = 'jpg';

  // Фото приходит массивом (с разными вариантами размера), берем самое большое (последнее)
  if (Array.isArray(fileArrayOrObject)) {
    fileId = fileArrayOrObject[fileArrayOrObject.length - 1].file_id;
  } 
  // Видео, гифки или документы приходят как один объект
  else if (fileArrayOrObject && fileArrayOrObject.file_id) {
    fileId = fileArrayOrObject.file_id;
    if (fileArrayOrObject.mime_type === 'video/mp4') ext = 'mp4';
  } else {
    return null;
  }

  try {
    const fileUrl = await tgBot.telegram.getFileLink(fileId);
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new AttachmentBuilder(buffer, { name: `telegram_media_${fileId}.${ext}` });
  } catch (error) {
    console.error('❌ Ошибка скачивания файла из Telegram:', error.message);
    return null;
  }
}

/**
 * Генерирует ссылку на оригинальный пост в Telegram
 */
function getPostUrl(post) {
  if (post.chat.username) {
    return `https://t.me/${post.chat.username}/${post.message_id}`;
  }
  // Для приватных каналов формируем внутреннюю ссылку
  const rawId = post.chat.id.toString().replace('-100', '');
  return `https://t.me/c/${rawId}/${post.message_id}`;
}

/**
 * Основная функция форматирования и отправки поста (одиночного или группы)
 */
async function sendDiscordPost(mainPost, messagesArray, client, tgBot) {
  const webhookClient = await getWebhook(client);
  if (!webhookClient) return;

  let text = '';
  let entities = [];
  let chatTitle = 'Telegram News';

  // Ищем текст в любом из сообщений (обычно он только в первом)
  for (const msg of messagesArray) {
    const msgText = msg.text || msg.caption;
    if (msgText) {
      text = msgText;
      entities = msg.entities || msg.caption_entities || [];
    }
    chatTitle = msg.chat.title || chatTitle;
  }

  // Обрабатываем текст и извлекаем кнопки
  const { text: formattedText, buttons } = processPostText(text, entities);
  const postUrl = getPostUrl(mainPost);

  // Скачиваем все вложения
  const attachments = [];
  for (const msg of messagesArray) {
    if (msg.photo) {
      const attach = await createAttachment(msg.photo, tgBot);
      if (attach) attachments.push(attach);
    } else if (msg.video) {
      const attach = await createAttachment(msg.video, tgBot);
      if (attach) attachments.push(attach);
    }
  }

  if (!formattedText && attachments.length === 0) return;

  const embeds = [];
  
  // Создаем основной Embed-карточку
  const mainEmbed = new EmbedBuilder()
    .setColor('#2b2d31') // Темная тема, стильная карточка
    .setTimestamp(new Date(mainPost.date * 1000))
    .setURL(postUrl);

  const photos = attachments.filter(a => a.name.match(/\.(jpg|jpeg|png)$/i));
  const otherFiles = attachments.filter(a => !a.name.match(/\.(jpg|jpeg|png)$/i));

  const hasText = !!formattedText.trim();
  if (hasText) {
    mainEmbed.setDescription(formattedText);
  } else if (photos.length === 0 && otherFiles.length === 0) {
    return; // Пустой пост
  }

  embeds.push(mainEmbed);

  // Прячем картинки из сырых вложений: запихиваем их в Embed (Discord прячет их тогда из списка внизу)
  if (photos.length > 0) {
    // Первую картинку кидаем в главный эмбед
    mainEmbed.setImage(`attachment://${photos[0].name}`);
    
    // Если картинок больше, создаем для них дополнительные эмбеды
    // Т.к. у них всех одинаковый URL, Discord объединит их в одну красивую сетку/коллаж
    for (let i = 1; i < photos.length; i++) {
      embeds.push(new EmbedBuilder()
        .setURL(postUrl)
        .setImage(`attachment://${photos[i].name}`)
      );
    }
  }

  // Настройка кнопок
  const components = [];
  let currentRow = new ActionRowBuilder();
  components.push(currentRow);

  // Кнопка на оригинал поста
  currentRow.addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel('🔗 Оригинал поста')
      .setURL(postUrl)
  );

  // Добавляем извлеченные кнопки-ссылки
  const addedUrls = new Set([postUrl]);

  for (const btn of buttons) {
    if (addedUrls.has(btn.url)) continue; // Убираем дубликаты
    addedUrls.add(btn.url);

    // Discord имеет лимит 5 кнопок в ряду
    if (currentRow.components.length >= 5) {
      if (components.length >= 5) break; // Максимум 5 рядов кнопок (25 штук)
      currentRow = new ActionRowBuilder();
      components.push(currentRow);
    }
    
    try {
      new URL(btn.url); // Проверка валидности URL
      currentRow.addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel(btn.label)
          .setURL(btn.url)
      );
    } catch (e) {
      // Игнорируем невалидные ссылки
    }
  }

  // Ограничиваем количество эмбедов и файлов (Discord limit)
  const finalEmbeds = embeds.slice(0, 10);
  const finalFiles = attachments.slice(0, 10);

  // Отправляем
  await webhookClient.send({
    username: chatTitle,
    embeds: finalEmbeds,
    files: finalFiles,
    components: components
  }).catch(console.error);
}

/**
 * Обрабатывает сгруппированные посты (сразу несколько медиа).
 */
async function processMediaGroup(groupId, client, tgBot) {
  const groupData = mediaGroups.get(groupId);
  if (!groupData) return;
  mediaGroups.delete(groupId); // Очищаем кэш

  // Первый пост в группе считаем основным для дат и ссылок
  const mainPost = groupData.messages[0];
  await sendDiscordPost(mainPost, groupData.messages, client, tgBot);
}

module.exports = { initTelegramBot };
