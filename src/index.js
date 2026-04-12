// index.js — Точка входа. Создаёт Discord-клиент, загружает модули и запускает бота.

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const { YoutubeiExtractor } = require('discord-player-youtubei');
const config = require('./config');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
  ],
});

console.log('═══════════════════════════════════');
console.log('  🤖  Запуск Discord бота...');
console.log('═══════════════════════════════════\n');

// Загрузка команд и событий
loadCommands(client);
loadEvents(client);

// Инициализация музыкального плеера
const player = new Player(client);
client.player = player;

// Загрузка стандартных экстракторов
player.extractors.register(YoutubeiExtractor, {}).then(() => {
  console.log('📺 Экстрактор YouTube загружен!');
});
player.extractors.loadMulti(DefaultExtractors).then(() => {
  console.log('🎵 Экстракторы музыки загружены (Spotify, SoundCloud, etc.)');
});

// Обработка событий плеера
player.events.on('playerStart', (queue, track) => {
  if (queue.metadata && queue.metadata.channel) {
    queue.metadata.channel.send(`▶️ Воспроизведение: **${track.title}**`).catch(() => {});
  }
});
player.events.on('error', (queue, error) => {
  console.log(`[Player Error] ${error.message}`);
});
player.events.on('playerError', (queue, error) => {
  console.log(`[Player Error] ${error.message}`);
});

// Глобальная обработка ошибок
process.on('unhandledRejection', (error) => {
  console.error('❌ Необработанная ошибка:', error);
});

// Подключение
client.login(config.token).catch((err) => {
  console.error('❌ Не удалось войти. Проверьте DISCORD_TOKEN в .env');
  console.error(err.message);
  process.exit(1);
});
