// ready.js — Событие: бот успешно подключился к Discord.

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log('═══════════════════════════════════');
    console.log(`  ✅  Бот онлайн: ${client.user.tag}`);
    console.log(`  📡  Серверов: ${client.guilds.cache.size}`);
    console.log('═══════════════════════════════════\n');

    client.user.setActivity('за сервером 👀', { type: 3 }); // WATCHING
  },
};
