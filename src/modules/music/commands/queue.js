// queue.js — Slash-команда /queue
// Показывает текущую очередь воспроизведения.

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Показать очередь воспроизведения'),

  async execute(interaction) {
    const queue = useQueue(interaction.guildId);

    if (!queue) {
      return interaction.reply({ content: '❌ Нет активной сессии воспроизведения.', ephemeral: true });
    }

    const currentTrack = queue.currentTrack || queue.current;

    if (!currentTrack) {
      return interaction.reply({ content: '📭 Очередь пуста.', ephemeral: true });
    }

    const tracks = queue.tracks.toArray();
    const upNext = tracks.slice(0, 10); // Максимум 10 треков из очереди (за исключением текущего)

    let description = `**🎵 Сейчас играет:**\n[${currentTrack.title}](${currentTrack.url}) — \`${currentTrack.duration}\`\n`;

    if (upNext.length > 0) {
      description += '\n**📋 Далее в очереди:**\n';
      upNext.forEach((song, index) => {
        description += `\`${index + 1}.\` [${song.title}](${song.url}) — \`${song.duration}\`\n`;
      });
    }

    if (tracks.length > 10) {
      description += `\n...и ещё ${tracks.length - 10} треков`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📜 Очередь воспроизведения')
      .setDescription(description)
      .setFooter({ text: `Всего треков: ${tracks.length + 1}` }); // +1 за текущий

    await interaction.reply({ embeds: [embed] });
  },
};
