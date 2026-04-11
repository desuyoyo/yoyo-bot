// queue.js — Slash-команда /queue
// Показывает текущую очередь воспроизведения.

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { queues } = require('./play');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Показать очередь воспроизведения'),

  async execute(interaction) {
    const queue = queues.get(interaction.guildId);

    if (!queue || queue.songs.length === 0) {
      return interaction.reply({ content: '📭 Очередь пуста.', ephemeral: true });
    }

    const currentSong = queue.songs[0];
    const upNext = queue.songs.slice(1, 11); // Максимум 10 треков

    let description = `**🎵 Сейчас играет:**\n[${currentSong.title}](${currentSong.url}) — \`${currentSong.duration || '?'}\`\n`;

    if (upNext.length > 0) {
      description += '\n**📋 Далее в очереди:**\n';
      upNext.forEach((song, index) => {
        description += `\`${index + 1}.\` [${song.title}](${song.url}) — \`${song.duration || '?'}\`\n`;
      });
    }

    if (queue.songs.length > 11) {
      description += `\n...и ещё ${queue.songs.length - 11} треков`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📜 Очередь воспроизведения')
      .setDescription(description)
      .setFooter({ text: `Всего треков: ${queue.songs.length}` });

    await interaction.reply({ embeds: [embed] });
  },
};
