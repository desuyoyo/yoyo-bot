const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const regDB = require('../regDB');

const ALLOWED_ROLES = ['1492503408643674193', '1492547385895948468'];
const REGISTRATION_LOG_CHANNEL_ID = '1492419554473676820';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('post')
    .setDescription('Создать пост с регистрацией')
    .addSubcommand((sub) =>
      sub
        .setName('event')
        .setDescription('Создать пост для мероприятия')
        .addStringOption((opt) =>
          opt.setName('title')
            .setDescription('Заголовок мероприятия')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName('fields')
            .setDescription('Поля для регистрации через запятую (макс. 5, напр: Никнейм, Возраст, О себе)')
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt.setName('channel')
            .setDescription('Канал для отправки поста (по умолчанию текущий)')
            .addChannelTypes(ChannelType.GuildText),
        )
        .addStringOption((opt) =>
          opt.setName('image_url')
            .setDescription('URL изображения для эмбеда')
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt.setName('mention')
            .setDescription('Тэг (например, @everyone или ID роли)')
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('migrate')
        .setDescription('[ADMIN] Мигрировать старые эвенты и заявки в новую базу')
    )
    .addSubcommand((sub) =>
      sub
        .setName('reschedule')
        .setDescription('Перенести мероприятие')
        .addStringOption((opt) =>
          opt.setName('message_id')
            .setDescription('ID сообщения с эвентом')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('new_date')
            .setDescription('Новая дата/время переноса (напр. Завтра в 18:00)')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('reason')
            .setDescription('Причина переноса')
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt.setName('channel')
            .setDescription('Канал, где находится сообщение (по умолчанию текущий)')
            .addChannelTypes(ChannelType.GuildText)
        )
    ),

  /**
   * Обработка кнопки "Зарегистрироваться" и "Редактировать заявку"
   */
  async handleButton(interaction) {
    const eventId = interaction.message.id;
    const eventData = regDB.getEvent(eventId);

    if (!eventData) {
      return interaction.reply({ content: '❌ Мероприятие не найдено в базе данных.', ephemeral: true });
    }

    const userId = interaction.user.id;
    const existingRegistration = regDB.getRegistration(eventId, userId);

    if (interaction.customId === 'event_reg') {
      if (existingRegistration) {
        return interaction.reply({ content: '❌ Вы уже зарегистрированы. Используйте кнопку "Редактировать заявку".', ephemeral: true });
      }
    } else if (interaction.customId === 'event_edit') {
      if (!existingRegistration) {
        return interaction.reply({ content: '❌ Вы еще не зарегистрировались на это мероприятие.', ephemeral: true });
      }
    }

    const modal = new ModalBuilder()
      .setCustomId(`event_submit:${eventId}`)
      .setTitle('Заявка на мероприятие');

    const rows = eventData.fields.map((fieldName, index) => {
      const input = new TextInputBuilder()
        .setCustomId(`field_${index}`)
        .setLabel(fieldName.trim().substring(0, 45))
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder(`Введите ${fieldName.trim().toLowerCase()}...`);

      if (fieldName.toLowerCase().includes('себе') || fieldName.toLowerCase().includes('описание')) {
        input.setStyle(TextInputStyle.Paragraph);
      }

      if (existingRegistration && existingRegistration.answers[fieldName.trim()]) {
        input.setValue(existingRegistration.answers[fieldName.trim()]);
      }

      return new ActionRowBuilder().addComponents(input);
    });

    modal.addComponents(...rows);
    await interaction.showModal(modal);
  },

  /**
   * Обработка отправки формы регистрации
   */
  async handleModalSubmit(interaction) {
    const eventId = interaction.customId.replace('event_submit:', '');
    const eventData = regDB.getEvent(eventId);

    if (!eventData) {
      return interaction.reply({ content: '❌ Мероприятие не найдено.', ephemeral: true });
    }

    const answers = {};
    const results = eventData.fields.map((fieldName, index) => {
      const value = interaction.fields.getTextInputValue(`field_${index}`);
      answers[fieldName.trim()] = value.trim();
      return { name: fieldName.trim(), value: value.trim() };
    });

    const logChannel = interaction.guild.channels.cache.get(REGISTRATION_LOG_CHANNEL_ID);
    if (!logChannel) {
      return interaction.reply({
        content: '✅ Ваша заявка принята, но произошла ошибка при уведомлении администрации.',
        ephemeral: true
      });
    }

    const userId = interaction.user.id;
    const existingRegistration = regDB.getRegistration(eventId, userId);

    const logEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📝 Заявка на регистрацию')
      .setAuthor({
        name: interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true })
      })
      .setDescription(`Отправлено из: **${eventData.title}**\nПользователь: <@${userId}>\nID: \`${userId}\``)
      .addFields(results.map(f => ({ name: f.name, value: f.value, inline: false })))
      .setTimestamp()
      .setFooter({ text: 'Система регистрации yoyo-bot' });

    try {
      if (existingRegistration) {
        const oldMessageId = existingRegistration.logMessageId;
        const oldMessage = await logChannel.messages.fetch(oldMessageId).catch(() => null);
        if (oldMessage) {
          await oldMessage.edit({ embeds: [logEmbed] });
        } else {
          const newMsg = await logChannel.send({ embeds: [logEmbed] });
          existingRegistration.logMessageId = newMsg.id;
        }
        regDB.addRegistration(eventId, userId, existingRegistration.logMessageId, answers);
        await interaction.reply({ content: '✅ Ваша заявка успешно обновлена!', ephemeral: true });
      } else {
        const sentMsg = await logChannel.send({ embeds: [logEmbed] });
        regDB.addRegistration(eventId, userId, sentMsg.id, answers);
        await interaction.reply({ content: '✅ Ваша заявка успешно отправлена!', ephemeral: true });
      }
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: '❌ Ошибка при отправке заявки.', ephemeral: true });
    }
  },

  async execute(interaction) {
    const member = interaction.member;
    const hasRole = member.roles.cache.some((role) => ALLOWED_ROLES.includes(role.id));

    if (!hasRole && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ У вас недостаточно прав для использования этой команды.',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'event') {
      const title = interaction.options.getString('title');
      const fieldsRaw = interaction.options.getString('fields');
      const imageUrl = interaction.options.getString('image_url');
      const mention = interaction.options.getString('mention');
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      if (!title || !fieldsRaw) {
        return interaction.reply({ content: '❌ Ошибка: заголовок и поля обязательны.', ephemeral: true });
      }

      const fieldsList = fieldsRaw.split(',').map(f => f.trim()).filter(Boolean);
      if (fieldsList.length > 5) {
        return interaction.reply({ content: '❌ Максимум 5 полей для регистрации.', ephemeral: true });
      }

      const serializedFields = fieldsList.join('|');
      if (serializedFields.length > 80) {
        return interaction.reply({
          content: '❌ Слишком длинные названия полей (макс. 80 символов суммарно).',
          ephemeral: true
        });
      }

      await interaction.reply({
        content: '📝 **Отправьте описание мероприятия следующим сообщением.**\nУ вас есть 5 минут. Пост будет создан автоматически в канале ' + targetChannel.toString(),
        ephemeral: true
      });

      const filter = (m) => m.author.id === interaction.user.id;
      const collector = interaction.channel.createMessageCollector({ filter, time: 300000, max: 1 });

      collector.on('collect', async (m) => {
        const description = m.content;

        try {
          if (m.deletable) await m.delete();
        } catch { }

        const embed = new EmbedBuilder()
          .setColor(0xFFFFFF)
          .setTitle(title)
          .setDescription(description)
          .setTimestamp()
          .setFooter({ text: 'Нажмите на кнопку ниже, чтобы подать заявку' });

        if (imageUrl) {
          embed.setImage(imageUrl);
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('event_reg')
            .setLabel('Зарегистрироваться')
            .setStyle(ButtonStyle.Success)
            .setEmoji('📝'),
          new ButtonBuilder()
            .setCustomId('event_edit')
            .setLabel('Редактировать заявку')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✏️')
        );

        try {
          const sentMessage = await targetChannel.send({
            content: mention ? mention : null,
            embeds: [embed],
            components: [row]
          });

          regDB.createEvent(sentMessage.id, title, fieldsList);

          await interaction.followUp({ content: '✅ Пост успешно создан и добавлен в базу!', ephemeral: true });
        } catch (error) {
          console.error('❌ Ошибка отправки финального поста:', error);
          await interaction.followUp({ content: '❌ Не удалось отправить пост. Проверьте права бота.', ephemeral: true });
        }
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          interaction.followUp({ content: '⌛ Время вышло. Создание поста отменено.', ephemeral: true }).catch(() => { });
        }
      });
    } else if (subcommand === 'migrate') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const eventsChannel = await interaction.client.channels.fetch('1492006814462771210');
        const logsChannel = await interaction.client.channels.fetch(REGISTRATION_LOG_CHANNEL_ID);

        let eventsMigrated = 0;
        let logsMigrated = 0;

        const eventMessages = await eventsChannel.messages.fetch({ limit: 100 });
        for (const [id, msg] of eventMessages) {
          if (msg.author.id !== interaction.client.user.id) continue;
          if (!msg.components || msg.components.length === 0) continue;

          const button = msg.components[0].components[0];
          if (button && button.customId && button.customId.startsWith('event_reg:')) {
            const rawFields = button.customId.replace('event_reg:', '');
            const fields = rawFields.split('|').filter(Boolean);
            const title = msg.embeds[0]?.title || 'Неизвестное мероприятие';

            regDB.createEvent(msg.id, title, fields);

            const newRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('event_reg')
                .setLabel('Зарегистрироваться')
                .setStyle(ButtonStyle.Success)
                .setEmoji('📝'),
              new ButtonBuilder()
                .setCustomId('event_edit')
                .setLabel('Редактировать заявку')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('✏️')
            );
            await msg.edit({ components: [newRow] });
            eventsMigrated++;
          }
        }

        const logMessages = await logsChannel.messages.fetch({ limit: 100 });
        const sortedLogs = Array.from(logMessages.values()).reverse();

        for (const msg of sortedLogs) {
          if (msg.author.id !== interaction.client.user.id) continue;
          if (!msg.embeds || msg.embeds.length === 0) continue;

          const embed = msg.embeds[0];
          const desc = embed.description || '';

          const titleMatch = desc.match(/Отправлено из: \*\*(.+?)\*\*/);
          const eventTitle = titleMatch ? titleMatch[1] : null;

          const idMatch = desc.match(/ID: `(.+?)`/);
          const userId = idMatch ? idMatch[1] : null;

          if (eventTitle && userId) {
            const eventData = regDB.findEventByTitle(eventTitle);
            if (eventData) {
              const answers = {};
              embed.fields.forEach(f => {
                answers[f.name] = f.value;
              });
              regDB.addRegistration(eventData.messageId, userId, msg.id, answers);
              logsMigrated++;
            }
          }
        }

        await interaction.editReply(`✅ **Миграция завершена!**\nОбновлено эвентов: ${eventsMigrated}\nИмпортировано заявок: ${logsMigrated}`);

      } catch (err) {
        console.error('Ошибка миграции:', err);
        await interaction.editReply('❌ Ошибка во время миграции: ' + err.message);
      }
    } else if (subcommand === 'reschedule') {
      await interaction.deferReply({ ephemeral: true });
      const messageId = interaction.options.getString('message_id');
      const newDate = interaction.options.getString('new_date');
      const reason = interaction.options.getString('reason');
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      try {
        const message = await targetChannel.messages.fetch(messageId);
        if (!message) {
          return interaction.editReply('❌ Сообщение не найдено.');
        }

        const eventData = regDB.getEvent(messageId);
        if (!eventData) {
          return interaction.editReply('❌ Это сообщение не является эвентом в базе данных.');
        }

        const originalEmbed = message.embeds[0];
        if (!originalEmbed) {
          return interaction.editReply('❌ Эмбед в сообщении не найден.');
        }

        const updatedEmbed = EmbedBuilder.from(originalEmbed)
          .setColor(0xFFA500)
          .addFields(
            { name: '⚠️ ВНИМАНИЕ: МЕРОПРИЯТИЕ ПЕРЕНЕСЕНО', value: `**Новая дата:** ${newDate}\n**Причина:** ${reason}`, inline: false }
          );

        // Обновляем сообщение эвента
        await message.edit({ embeds: [updatedEmbed] });

        const announcementEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle(`⚠️ Перенос: ${eventData.title}`)
          .setDescription(`Мероприятие было перенесено!\n\n**Новая дата:** ${newDate}\n**Причина:** ${reason}\n\n[Перейти к посту с эвентом](${message.url})`)
          .setTimestamp();

        await targetChannel.send({ embeds: [announcementEmbed] });

        await interaction.editReply('✅ Мероприятие успешно перенесено! Сообщение обновлено и отправлено уведомление.');

      } catch (error) {
        console.error('Ошибка при переносе эвента:', error);
        await interaction.editReply('❌ Ошибка при попытке перенести эвент. Проверьте правильность ID сообщения и выбранного канала.');
      }
    }
  },
};
