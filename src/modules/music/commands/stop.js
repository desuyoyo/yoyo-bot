// stop.js — Slash-команда /stop
// Останавливает воспроизведение, очищает очередь и отключает бота.

const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Остановить музыку и очистить очередь'),

  async execute(interaction) {
    const queue = useQueue(interaction.guildId);

    if (!queue) {
      return interaction.reply({ content: '❌ Бот не проигрывает музыку.', ephemeral: true });
    }

    // Очистить всё и отключиться
    queue.delete();

    await interaction.reply('⏹ Воспроизведение остановлено. Очередь очищена.');
  },
};
