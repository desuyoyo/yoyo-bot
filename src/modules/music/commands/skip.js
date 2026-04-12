// skip.js — Slash-команда /skip
// Пропускает текущий трек.

const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Пропустить текущий трек'),

  async execute(interaction) {
    const queue = useQueue(interaction.guildId);

    if (!queue || !queue.currentTrack) {
      return interaction.reply({ content: '❌ Очередь пуста или ничего не играет.', ephemeral: true });
    }

    const skipped = queue.currentTrack;
    queue.node.skip();

    await interaction.reply(`⏭ Пропущено: **${skipped.title}**`);
  },
};
