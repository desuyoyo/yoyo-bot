// stop.js — Slash-команда /stop
// Останавливает воспроизведение, очищает очередь и отключает бота.

const { SlashCommandBuilder } = require('discord.js');
const { queues } = require('./play');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Остановить музыку и очистить очередь'),

  async execute(interaction) {
    const queue = queues.get(interaction.guildId);

    if (!queue) {
      return interaction.reply({ content: '❌ Бот не проигрывает музыку.', ephemeral: true });
    }

    // Очистить всё
    queue.songs = [];
    if (queue.idleTimer) {
      clearTimeout(queue.idleTimer);
    }
    if (queue.player) {
      queue.player.stop(true);
    }
    if (queue.connection) {
      queue.connection.destroy();
    }
    queues.delete(interaction.guildId);

    await interaction.reply('⏹ Воспроизведение остановлено. Очередь очищена.');
  },
};
