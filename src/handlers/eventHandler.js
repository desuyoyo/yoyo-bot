// eventHandler.js — Динамически загружает обработчики событий из папок модулей.
// Каждый файл события экспортирует: { name: 'eventName', once?: boolean, execute: async (...args) => {} }

const fs = require('fs');
const path = require('path');

function loadEvents(client) {
  const modulesPath = path.join(__dirname, '..', 'modules');
  if (!fs.existsSync(modulesPath)) return;

  const moduleDirs = fs.readdirSync(modulesPath, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  let count = 0;

  for (const dir of moduleDirs) {
    const eventsPath = path.join(modulesPath, dir.name, 'events');
    if (!fs.existsSync(eventsPath)) continue;

    const eventFiles = fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'));

    for (const file of eventFiles) {
      const event = require(path.join(eventsPath, file));

      if (!event.name || !event.execute) {
        console.warn(`  ⚠ Пропущен файл ${file} — нет name/execute`);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }

      console.log(`  ✔ Событие загружено: ${event.name} (${dir.name})`);
      count++;
    }
  }

  console.log(`📡 Загружено событий: ${count}\n`);
}

module.exports = { loadEvents };
