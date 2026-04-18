// interactionCreate.js — Глобальный маршрутизатор для всех взаимодействий.
// Обрабатывает slash-команды и кнопки.

module.exports = {
  name: 'interactionCreate',
  once: false,

  async execute(interaction, client) {
    // ── Slash-команды ──
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`❌ Ошибка в команде /${interaction.commandName}:`, error);
        const reply = { content: '❌ Произошла ошибка при выполнении команды.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => { });
        } else {
          await interaction.reply(reply).catch(() => { });
        }
      }
      return;
    }
    // Кнопки
    if (interaction.isButton()) {
      // Кнопки ролей
      if (interaction.customId.startsWith('role_give_')) {
        const roleModule = client.commands.get('rolepanel');
        if (roleModule && roleModule.handleButton) {
          try {
            await roleModule.handleButton(interaction);
          } catch (error) {
            console.error('❌ Ошибка обработки кнопки роли:', error);
            await interaction.reply({ content: '❌ Ошибка при обработке.', ephemeral: true }).catch(() => { });
          }
        }
      }
      // Кнопки регистрации и редактирования
      if (interaction.customId.startsWith('event_reg') || interaction.customId === 'event_edit') {
        const postModule = client.commands.get('post');
        if (postModule && postModule.handleButton) {
          try {
            await postModule.handleButton(interaction);
          } catch (error) {
            console.error('❌ Ошибка обработки кнопки регистрации:', error);
            await interaction.reply({ content: '❌ Ошибка при обработке.', ephemeral: true }).catch(() => { });
          }
        }
      }
      return;
    }

    // ── Select Menu (для модуля ролей) ──
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'role_select_menu') {
        const roleModule = client.commands.get('rolepanel');
        if (roleModule && roleModule.handleSelectMenu) {
          try {
            await roleModule.handleSelectMenu(interaction);
          } catch (error) {
            console.error('❌ Ошибка обработки меню ролей:', error);
            await interaction.reply({ content: '❌ Ошибка при обработке.', ephemeral: true }).catch(() => { });
          }
        }
      }
    }

    // Modal Submissions
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('event_submit:')) {
        const postModule = client.commands.get('post');
        if (postModule && postModule.handleModalSubmit) {
          try {
            await postModule.handleModalSubmit(interaction);
          } catch (error) {
            console.error('❌ Ошибка обработки модалки регистрации:', error);
            await interaction.reply({ content: '❌ Ошибка при обработке.', ephemeral: true }).catch(() => { });
          }
        }
      }
    }
  },
};
