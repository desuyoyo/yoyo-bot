// pause.js — Slash-команда /pause
// Ставит воспроизведение на паузу или возобновляет его.

const { SlashCommandBuilder } = require('discord.js');
const { useTimeline } = require('discord-player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Поставить воспроизведение на паузу или возобновить'),

  async execute(interaction) {
    // Получаем текущий таймлайн очереди на сервере
    const timeline = useTimeline(interaction.guildId);

    if (!timeline) {
      return interaction.reply({
        content: '❌ В данный момент музыка не воспроизводится.',
        ephemeral: true,
      });
    }

    // Проверяем текущее состояние и меняем его
    const wasPaused = timeline.paused;
    wasPaused ? timeline.resume() : timeline.pause();

    // Отправляем ответ с новым статусом
    return interaction.reply(
      `Плеер теперь **${wasPaused ? 'возобновлен ▶️' : 'приостановлен ⏸️'}**.`
    );
  },
};
