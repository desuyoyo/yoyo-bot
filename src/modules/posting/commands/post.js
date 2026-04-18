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

// Настройки, они постоянные, поэтому в .env особо смысла нет
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
        ),
    ),

  /**
   * Обработка кнопки "Зарегистрироваться"
   */
  async handleButton(interaction) {
    const rawFields = interaction.customId.replace('event_reg:', '');
    const fields = rawFields.split('|').filter(Boolean);

    if (fields.length === 0) {
      return interaction.reply({ content: '❌ Ошибка: список полей пуст.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`event_submit:${rawFields}`)
      .setTitle('Регистрация на мероприятие');

    const rows = fields.map((fieldName, index) => {
      const input = new TextInputBuilder()
        .setCustomId(`field_${index}`)
        .setLabel(fieldName.trim().substring(0, 45))
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder(`Введите ${fieldName.trim().toLowerCase()}...`);

      if (fieldName.toLowerCase().includes('себе') || fieldName.toLowerCase().includes('описание')) {
        input.setStyle(TextInputStyle.Paragraph);
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
    const rawFields = interaction.customId.replace('event_submit:', '');
    const fieldNames = rawFields.split('|');

    const results = fieldNames.map((name, index) => {
      const value = interaction.fields.getTextInputValue(`field_${index}`);
      return { name: name.trim(), value: value.trim() };
    });

    const logChannel = interaction.guild.channels.cache.get(REGISTRATION_LOG_CHANNEL_ID);

    if (!logChannel) {
      return interaction.reply({
        content: '✅ Ваша заявка принята, но произошла ошибка при уведомлении администрации.',
        ephemeral: true
      });
    }

    const eventTitle = interaction.message?.embeds[0]?.title || 'Неизвестное мероприятие';

    const logEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📝 Новая заявка на регистрацию')
      .setAuthor({
        name: interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true })
      })
      .setDescription(`Отправлено из: **${eventTitle}**\nПользователь: <@${interaction.user.id}>\nID: \`${interaction.user.id}\``)
      .addFields(results.map(f => ({ name: f.name, value: f.value, inline: false })))
      .setTimestamp()
      .setFooter({ text: 'Система регистрации yoyo-bot' });

    try {
      await logChannel.send({ embeds: [logEmbed] });
      await interaction.reply({
        content: '✅ Ваша заявка успешно отправлена!',
        ephemeral: true
      });
    } catch (error) {
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

      // Просим прислать описание
      await interaction.reply({
        content: '📝 **Отправьте описание мероприятия следующим сообщением.**\nУ вас есть 5 минут. Пост будет создан автоматически в канале ' + targetChannel.toString(),
        ephemeral: true
      });

      const filter = (m) => m.author.id === interaction.user.id;
      const collector = interaction.channel.createMessageCollector({ filter, time: 300000, max: 1 });

      collector.on('collect', async (m) => {
        const description = m.content;

        // Попытка удалить сообщение пользователя (нужны права ManageMessages)
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
            .setCustomId(`event_reg:${serializedFields}`)
            .setLabel('Зарегистрироваться')
            .setStyle(ButtonStyle.Success)
            .setEmoji('📝'),
        );

        try {
          await targetChannel.send({ embeds: [embed], components: [row] });

          await interaction.followUp({ content: '✅ Пост успешно создан!', ephemeral: true });
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
    }
  },
};
