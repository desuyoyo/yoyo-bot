/**
 * @file ready.js
 * @description Запускает Telegram модуль после успешного запуска Discord бота
 */

const { initTelegramBot } = require('../service');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    initTelegramBot(client).catch(err => {
        console.error('❌ Ошибка инициализации Telegram модуля:', err);
    });
  },
};
