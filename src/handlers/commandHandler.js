// commandHandler.js — Динамически загружает slash-команды из папок модулей.
// Каждый файл команды экспортирует: { data: SlashCommandBuilder, execute: async (interaction) => {} }

const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');


function loadCommands(client) {
  client.commands = new Collection();

  const modulesPath = path.join(__dirname, '..', 'modules');
  if (!fs.existsSync(modulesPath)) return;

  const moduleDirs = fs.readdirSync(modulesPath, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const dir of moduleDirs) {
    const commandsPath = path.join(modulesPath, dir.name, 'commands');
    if (!fs.existsSync(commandsPath)) continue;

    const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

    for (const file of commandFiles) {
      const command = require(path.join(commandsPath, file));
      if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
        console.log(`  ✔ Команда загружена: /${command.data.name}`);
      } else {
        console.warn(`  ⚠ Пропущен файл ${file} — нет data/execute`);
      }
    }
  }

  console.log(`📋 Загружено команд: ${client.commands.size}\n`);
}

module.exports = { loadCommands };
