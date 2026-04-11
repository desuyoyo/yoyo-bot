// deployCommands.js — Регистрирует slash-команды в Discord API.
// Запускается ОДИН РАЗ (или при добавлении новых команд):
//   node src/deployCommands.js

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

async function deploy() {
  const commands = [];
  const modulesPath = path.join(__dirname, 'modules');

  if (!fs.existsSync(modulesPath)) {
    console.error('❌ Папка modules не найдена');
    return;
  }

  const moduleDirs = fs.readdirSync(modulesPath, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const dir of moduleDirs) {
    const commandsPath = path.join(modulesPath, dir.name, 'commands');
    if (!fs.existsSync(commandsPath)) continue;

    const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

    for (const file of commandFiles) {
      const command = require(path.join(commandsPath, file));
      if (command.data) {
        commands.push(command.data.toJSON());
        console.log(`  ✔ Подготовлена: /${command.data.name}`);
      }
    }
  }

  if (commands.length === 0) {
    console.log('⚠ Нет команд для регистрации.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    console.log(`\n🔄 Регистрация ${commands.length} команд...`);

    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands },
    );

    console.log('✅ Все команды успешно зарегистрированы!');
  } catch (error) {
    console.error('❌ Ошибка регистрации:', error);
  }
}

deploy();
