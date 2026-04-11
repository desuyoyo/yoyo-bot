// rolepanel.js — Slash-команда /rolepanel
// Создаёт эмбед с кнопками или выпадающим списком для выдачи ролей.
// Использование: /rolepanel title:<заголовок> roles:<@role1 @role2 @role3> mode:<buttons|select>

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolepanel')
    .setDescription('Создать панель выдачи ролей')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption((opt) =>
      opt.setName('title')
        .setDescription('Заголовок панели')
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('roles')
        .setDescription('Упомяните роли через пробел: @Role1 @Role2 @Role3')
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('mode')
        .setDescription('Режим: кнопки или выпадающий список')
        .setRequired(false)
        .addChoices(
          { name: 'Кнопки', value: 'buttons' },
          { name: 'Выпадающий список', value: 'select' },
        ),
    ),

  // Обработка кнопки выдачи роли.
  async handleButton(interaction) {
    const roleId = interaction.customId.replace('role_give_', '');
    const member = interaction.member;
    const role = interaction.guild.roles.cache.get(roleId);

    if (!role) {
      return interaction.reply({ content: '❌ Роль не найдена.', ephemeral: true });
    }

    try {
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(role);
        await interaction.reply({
          content: `❎ Роль **${role.name}** снята.`,
          ephemeral: true,
        });
      } else {
        await member.roles.add(role);
        await interaction.reply({
          content: `✅ Роль **${role.name}** выдана!`,
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error('❌ Ошибка выдачи роли:', error);
      await interaction.reply({
        content: '❌ Не удалось изменить роль. Проверьте иерархию ролей бота.',
        ephemeral: true,
      });
    }
  },

  // Обработка выпадающего списка ролей.
  async handleSelectMenu(interaction) {
    const selectedRoleIds = interaction.values;
    const member = interaction.member;
    const results = [];

    for (const roleId of selectedRoleIds) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) continue;

      try {
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(role);
          results.push(`❎ **${role.name}** — снята`);
        } else {
          await member.roles.add(role);
          results.push(`✅ **${role.name}** — выдана`);
        }
      } catch {
        results.push(`❌ **${role.name}** — ошибка`);
      }
    }

    await interaction.reply({
      content: results.join('\n') || 'Ничего не изменено.',
      ephemeral: true,
    });
  },

  async execute(interaction) {
    const title = interaction.options.getString('title');
    const rolesRaw = interaction.options.getString('roles');
    const mode = interaction.options.getString('mode') || 'buttons';

    // Извлекаем ID ролей из упоминаний: <@&123456789>
    const roleIds = [...rolesRaw.matchAll(/<@&(\d+)>/g)].map((m) => m[1]);

    if (roleIds.length === 0) {
      return interaction.reply({
        content: '❌ Не найдены упоминания ролей. Используйте формат: `@Role1 @Role2`',
        ephemeral: true,
      });
    }

    if (roleIds.length > 25) {
      return interaction.reply({
        content: '❌ Максимум 25 ролей на одну панель.',
        ephemeral: true,
      });
    }

    // Создаём описание
    const guild = interaction.guild;
    const roleNames = roleIds.map((id) => {
      const role = guild.roles.cache.get(id);
      return role ? `<@&${id}>` : `Неизвестная роль (${id})`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(`🎭 ${title}`)
      .setDescription(
        'Нажмите на кнопку или выберите из списка, чтобы получить/снять роль.\n\n' +
        '**Доступные роли:**\n' +
        roleNames.join('\n'),
      )
      .setFooter({ text: 'Повторное нажатие снимает роль' });

    const components = [];

    if (mode === 'buttons') {
      // Кнопки (до 5 кнопок на ряд, до 5 рядов)
      for (let i = 0; i < roleIds.length; i += 5) {
        const row = new ActionRowBuilder();
        const chunk = roleIds.slice(i, i + 5);

        for (const roleId of chunk) {
          const role = guild.roles.cache.get(roleId);
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`role_give_${roleId}`)
              .setLabel(role?.name || 'Роль')
              .setStyle(ButtonStyle.Primary),
          );
        }
        components.push(row);
      }
    } else {
      // Select Menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('role_select_menu')
        .setPlaceholder('Выберите роли...')
        .setMinValues(1)
        .setMaxValues(roleIds.length);

      for (const roleId of roleIds) {
        const role = guild.roles.cache.get(roleId);
        selectMenu.addOptions({
          label: role?.name || 'Роль',
          value: roleId,
          description: `Получить или снять роль ${role?.name || ''}`,
        });
      }

      components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    // Отправляем панель в канал (не как ответ, а как обычное сообщение)
    await interaction.channel.send({ embeds: [embed], components });
    await interaction.reply({ content: '✅ Панель ролей создана!', ephemeral: true });
  },
};
