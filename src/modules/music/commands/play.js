// play.js — Slash-команда /play [запрос]
// Ищет трек на YouTube (или других платформах) и воспроизводит / добавляет в очередь.

const { SlashCommandBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Воспроизвести трек из YouTube/Spotify/SoundCloud')
    .addStringOption((opt) =>
      opt.setName('запрос')
        .setDescription('Ссылка или поисковый запрос')
        .setRequired(true),
    ),

  async execute(interaction) {
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({ content: '❌ Войдите в голосовой канал!', ephemeral: true });
    }

    const query = interaction.options.getString('запрос');
    await interaction.deferReply();

    const player = useMainPlayer();

    try {
      // Инициализируем воспроизведение (discord-player сам разберется: зайти, если не зашел, найти, если нужно и т.д.)
      const searchResult = await player.search(query, {
        requestedBy: interaction.user,
      });

      if (!searchResult.hasTracks()) {
        return interaction.editReply('❌ Ничего не найдено по запросу.');
      }

      await player.play(voiceChannel, searchResult, {
        nodeOptions: {
          // Эти данные будут доступны в queue.metadata
          metadata: {
            channel: interaction.channel,
            client: interaction.client,
            requestedBy: interaction.user
          },
          leaveOnIdle: true,
          leaveOnIdleCooldown: 300000, // 5 минут
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 300000,
        }
      });

      // Мы больше не отправляем "▶️ Воспроизведение", потому что это сделает обработчик `playerStart` в index.js
      // Однако, если это добавление в очередь (уже что-то играет), мы можем уведомить
      if (searchResult.playlist) {
        return interaction.editReply(`📥 Плейлист добавлен в очередь: **${searchResult.playlist.title}** (${searchResult.tracks.length} треков)`);
      } else {
        return interaction.editReply(`📥 Трек добавлен в очередь: **${searchResult.tracks[0].title}**`);
      }
    } catch (error) {
      console.error('❌ Ошибка /play:', error.message);
      await interaction.editReply('❌ Произошла ошибка при попытке воспроизведения. Попробуйте еще раз или другой трек.').catch(() => {});
    }
  },
};

