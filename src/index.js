// index.js — Точка входа. Создаёт Discord-клиент, загружает модули и запускает бота.

const { Client, GatewayIntentBits, Partials } = require('discord.js');
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
