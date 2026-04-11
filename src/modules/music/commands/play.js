// play.js — Slash-команда /play [запрос]
// Ищет трек на YouTube и воспроизводит / добавляет в очередь.

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const playDl = require('play-dl');
const config = require('../../../config');

// Очередь для каждого сервера: Map<guildId, QueueObject>
const queues = new Map();

// Получить или создать очередь для сервера.
function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      songs: [],       // [{ title, url, duration, thumbnail, requestedBy }]
      player: null,
      connection: null,
      textChannel: null,
      idleTimer: null,
    });
  }
  return queues.get(guildId);
}

// Воспроизвести следующий трек из очереди.
async function playNext(guildId) {
  const queue = queues.get(guildId);
  if (!queue) return;

  if (queue.songs.length === 0) {
    // Очередь пуста — ставим таймер на выход
    queue.idleTimer = setTimeout(() => {
      if (queue.connection) {
        queue.connection.destroy();
        queue.textChannel?.send('👋 Очередь пуста. Покидаю канал.').catch(() => {});
      }
      queues.delete(guildId);
    }, config.musicIdleTimeout);
    return;
  }

  const song = queue.songs[0];

  try {
    const stream = await playDl.stream(song.url);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
    });

    queue.player.play(resource);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎵 Сейчас играет')
      .setDescription(`**[${song.title}](${song.url})**`)
      .addFields(
        { name: '⏱ Длительность', value: song.duration || 'N/A', inline: true },
        { name: '👤 Запросил', value: song.requestedBy, inline: true },
      )
      .setThumbnail(song.thumbnail || null);

    queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
  } catch (error) {
    console.error('❌ Ошибка воспроизведения:', error.message);
    
    // Специфичная обработка блокировки от YouTube
    // На старых версиях play-dl или при новых блоках YouTube может выдавать "Invalid URL" или "Sign in to confirm you're not a bot"
    if (error.message.includes('Sign in to confirm') || error.message.includes('bot') || error.message.includes('Invalid URL') || error.message.includes('status code 410')) {
      queue.textChannel?.send(`🛑 **Ограничение YouTube:** YouTube временно заблокировал скачивание с этого IP (сработала антибот-защита). \n💡 Обойти это временно можно, используя ссылки из **SoundCloud**!`).catch(() => {});
    } else {
      queue.textChannel?.send(`❌ Не удалось загрузить трек: **${song.title}**`).catch(() => {});
    }
    
    queue.songs.shift();
    playNext(guildId);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Воспроизвести трек из YouTube')
    .addStringOption((opt) =>
      opt.setName('запрос')
        .setDescription('Ссылка или поисковый запрос')
        .setRequired(true),
    ),

  // Экспортируем очереди и playNext для /skip, /stop, /queue
  queues,
  playNext,

  async execute(interaction) {
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({ content: '❌ Войдите в голосовой канал!', ephemeral: true });
    }

    const query = interaction.options.getString('запрос');
    await interaction.deferReply();

    try {
      // Поиск / валидация
      let songInfo;
      const ytType = playDl.yt_validate(query);

      // Если это чистый видео-URL или плейлист, но внутри есть конкретное видео (?v=...)
      if (ytType === 'video' || (ytType === 'playlist' && query.includes('v='))) {
        const info = await playDl.video_basic_info(query);
        songInfo = {
          title: info.video_details.title,
          url: info.video_details.url,
          duration: info.video_details.durationRaw,
          thumbnail: info.video_details.thumbnails?.[0]?.url,
          requestedBy: member.displayName,
        };
      } else {
        const searched = await playDl.search(query, { limit: 1 });
        if (!searched.length) {
          return interaction.editReply('❌ Ничего не найдено по запросу.');
        }
        const video = searched[0];
        songInfo = {
          title: video.title,
          url: video.url,
          duration: video.durationRaw,
          thumbnail: video.thumbnails?.[0]?.url,
          requestedBy: member.displayName,
        };
      }

      const queue = getQueue(interaction.guildId);
      queue.songs.push(songInfo);
      queue.textChannel = interaction.channel;

      // Если бот ещё не подключён — подключаемся
      if (!queue.connection || queue.connection.state.status === VoiceConnectionStatus.Destroyed) {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: interaction.guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        connection.subscribe(player);

        queue.connection = connection;
        queue.player = player;

        // Обработка завершения трека
        player.on(AudioPlayerStatus.Idle, () => {
          queue.songs.shift();
          playNext(interaction.guildId);
        });

        player.on('error', (error) => {
          console.error('❌ Ошибка плеера:', error);
          queue.songs.shift();
          playNext(interaction.guildId);
        });

        // Обработка отключения
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
          try {
            await Promise.race([
              entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
              entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]);
          } catch {
            connection.destroy();
            queues.delete(interaction.guildId);
          }
        });
      }

      // Если это первый трек — запускаем
      if (queue.songs.length === 1) {
        // Сбрасываем таймер выхода, если он был
        if (queue.idleTimer) {
          clearTimeout(queue.idleTimer);
          queue.idleTimer = null;
        }
        await playNext(interaction.guildId);
        await interaction.editReply(`▶️ Воспроизведение: **${songInfo.title}**`);
      } else {
        if (queue.idleTimer) {
          clearTimeout(queue.idleTimer);
          queue.idleTimer = null;
        }
        await interaction.editReply(`📥 Добавлено в очередь [${queue.songs.length - 1}]: **${songInfo.title}**`);
      }
    } catch (error) {
      console.error('❌ Ошибка /play:', error.message);
      if (error.message.includes('Sign in to confirm') || error.message.includes('bot') || error.message.includes('Invalid URL') || error.message.includes('status code 410')) {
        await interaction.editReply('🛑 **Ограничение YouTube:** Сервис заблокировал поиск/скачивание с этого IP (бот-защита). Попробуйте позже или используйте ссылку на SoundCloud!').catch(() => {});
      } else {
        await interaction.editReply('❌ Не удалось обработать запрос (возможно трек недоступен или скрыт).').catch(() => {});
      }
    }
  },
};
