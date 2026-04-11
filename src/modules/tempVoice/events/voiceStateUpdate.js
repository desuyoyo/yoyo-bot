// voiceStateUpdate.js — Модуль «Временные комнаты» (Join to Create).
// При заходе в канал-генератор создаёт временный голосовой канал.
// При выходе всех — удаляет его.

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const config = require('../../../config');

// Кэш созданных временных комнат: Set<channelId>
const tempChannels = new Set();

module.exports = {
  name: 'voiceStateUpdate',
  once: false,

  async execute(oldState, newState) {
    const joinedChannelId = newState.channelId;
    const leftChannelId = oldState.channelId;

    // ── 1. Создание комнаты при заходе в генератор ──
    if (joinedChannelId && config.voiceGenerators.has(joinedChannelId)) {
      const userLimit = config.voiceGenerators.get(joinedChannelId);
      const member = newState.member;
      const guild = newState.guild;
      const generatorChannel = newState.channel;

      try {
        // Создаём канал в той же категории
        const newChannel = await guild.channels.create({
          name: `🔊 Комната ${member.displayName}`,
          type: ChannelType.GuildVoice,
          parent: generatorChannel.parentId,
          userLimit: userLimit || undefined,
          permissionOverwrites: [
            // Владелец комнаты может управлять каналом
            {
              id: member.id,
              allow: [
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers,
              ],
            },
          ],
        });

        // Запоминаем канал как временный
        tempChannels.add(newChannel.id);

        // Перемещаем пользователя
        await member.voice.setChannel(newChannel);
        console.log(`🔊 Создана комната: "${newChannel.name}" для ${member.user.tag}`);
      } catch (error) {
        console.error('❌ Ошибка создания временной комнаты:', error);
      }
    }

    // ── 2. Удаление пустых временных комнат ──
    if (leftChannelId && tempChannels.has(leftChannelId)) {
      try {
        const channel = oldState.guild.channels.cache.get(leftChannelId);
        if (channel && channel.members.size === 0) {
          await channel.delete();
          tempChannels.delete(leftChannelId);
          console.log(`🗑️  Удалена пустая комната: ${leftChannelId}`);
        }
      } catch (error) {
        // Канал мог быть уже удалён
        tempChannels.delete(leftChannelId);
      }
    }
  },
};
