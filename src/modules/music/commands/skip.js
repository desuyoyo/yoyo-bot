// skip.js — Slash-команда /skip
// Пропускает текущий трек.

const { SlashCommandBuilder } = require('discord.js');
const { queues, playNext } = require('./play');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Пропустить текущий трек'),

  async execute(interaction) {
    const queue = queues.get(interaction.guildId);

    if (!queue || queue.songs.length === 0) {
      return interaction.reply({ content: '❌ Очередь пуста.', ephemeral: true });
    }

    const skipped = queue.songs[0];
    // Остановка плеера вызовет событие Idle → playNext
    queue.player.stop();

    await interaction.reply(`⏭ Пропущено: **${skipped.title}**`);
  },
};
