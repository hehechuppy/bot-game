// commands/noitu.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

async function startNoituGame(message, args) {
  const host = message.author;
  let players = [host];

  const buildLobbyEmbed = () => {
    const playerListStr = players.map((p, i) => `**${i + 1}.** ${p.username}`).join('\n');
    return new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('🔤 GAME NỐI TỪ MULTIPLAYER')
      .setDescription('Bấm nút bên dưới để tham gia phòng đấu!\n*(Cần tối thiểu **2 người** để bắt đầu)*')
      .addFields({
        name: `👥 Đã tham gia (${players.length} người):`,
        value: playerListStr || 'Chưa có ai'
      })
      .setFooter({ text: `Người tạo phòng: ${host.username}` })
      .setTimestamp();
  };

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('nt_join').setLabel('Tham Gia / Rời').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
    new ButtonBuilder().setCustomId('nt_start').setLabel('Bắt Đầu').setStyle(ButtonStyle.Primary).setEmoji('▶️'),
    new ButtonBuilder().setCustomId('nt_cancel').setLabel('Hủy Phòng').setStyle(ButtonStyle.Danger).setEmoji('❌')
  );

  const lobbyMsg = await message.channel.send({
    embeds: [buildLobbyEmbed()],
    components: [row]
  });

  const lobbyCollector = lobbyMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000
  });

  let gameStarted = false;

  lobbyCollector.on('collect', async (interaction) => {
    const user = interaction.user;

    if (interaction.customId === 'nt_join') {
      const index = players.findIndex(p => p.id === user.id);
      if (index !== -1) {
        if (user.id === host.id && players.length === 1) {
          return interaction.reply({ content: '❌ Bạn là chủ phòng, cần ít nhất 1 người nữa hoặc hãy bấm Hủy phòng!', ephemeral: true });
        }
        players.splice(index, 1);
        await interaction.reply({ content: '❌ Bạn đã rời khỏi phòng.', ephemeral: true });
      } else {
        players.push(user);
        await interaction.reply({ content: '✅ Bạn đã tham gia phòng game!', ephemeral: true });
      }
      await lobbyMsg.edit({ embeds: [buildLobbyEmbed()] }).catch(() => {});
    } 
    else if (interaction.customId === 'nt_start') {
      if (user.id !== host.id) {
        return interaction.reply({ content: '❌ Chỉ chủ phòng mới có thể bắt đầu game!', ephemeral: true });
      }
      if (players.length < 2) {
        return interaction.reply({ content: '❌ Cần ít nhất **2 người chơi** để bắt đầu!', ephemeral: true });
      }
      gameStarted = true;
      await interaction.reply({ content: '🚀 Game đang bắt đầu...', ephemeral: true });
      lobbyCollector.stop('started');
    } 
    else if (interaction.customId === 'nt_cancel') {
      if (user.id !== host.id) {
        return interaction.reply({ content: '❌ Chỉ chủ phòng mới có quyền hủy!', ephemeral: true });
      }
      await interaction.reply({ content: '🛑 Phòng game đã bị hủy.', ephemeral: true });
      lobbyCollector.stop('cancelled');
    }
  });

  lobbyCollector.on('end', async (_, reason) => {
    if (reason === 'cancelled') {
      return lobbyMsg.edit({ content: '🛑 Phòng game đã bị hủy.', embeds: [], components: [] }).catch(() => {});
    }
    if (reason === 'time' && !gameStarted) {
      return lobbyMsg.edit({ content: '⏰ Hết thời gian chờ, phòng game đã tự hủy.', embeds: [], components: [] }).catch(() => {});
    }
    if (reason === 'started') {
      await lobbyMsg.edit({ components: [] }).catch(() => {});
      runGameLoop(message.channel, players);
    }
  });
}

async function runGameLoop(channel, players) {
  let activePlayers = [...players];
  let turnIndex = 0;
  let lastWord = '';
  let usedWords = new Set();

  await channel.send(`🎮 **GAME NỐI TỪ BẮT ĐẦU!**\nDanh sách: ${activePlayers.map(p => p.toString()).join(', ')}\nMỗi lượt có **20 giây** để nhập từ hợp lệ (đúng **2 từ** tiếng Việt).`);

  while (activePlayers.length > 1) {
    const currentPlayer = activePlayers[turnIndex];
    let requiredStart = '';

    if (lastWord) {
      const parts = lastWord.trim().split(/\s+/);
      requiredStart = parts[parts.length - 1].toLowerCase();
    }

    const promptText = requiredStart
      ? `👉 Lượt của ${currentPlayer}! Nhập từ 2 tiếng bắt đầu bằng **"${requiredStart.toUpperCase()}"** (Từ trước: *${lastWord}*)`
      : `👉 Lượt của ${currentPlayer}! Mở màn bằng 1 từ 2 tiếng bất kỳ!`;

    await channel.send(promptText);

    try {
      const collected = await channel.awaitMessages({
        filter: m => m.author.id === currentPlayer.id,
        max: 1,
        time: 20000,
        errors: ['time']
      });

      const msg = collected.first();
      const content = msg.content.trim();
      const words = content.split(/\s+/);

      if (words.length !== 2) {
        await msg.reply(`❌ Sai cú pháp! Phải nhập đúng **2 từ** (VD: "mèo con"). ${currentPlayer} đã bị loại!`);
        activePlayers.splice(turnIndex, 1);
        if (activePlayers.length > 0) turnIndex %= activePlayers.length;
        continue;
      }

      const firstWord = words[0].toLowerCase();

      if (requiredStart && firstWord !== requiredStart) {
        await msg.reply(`❌ Sai từ nối! Từ của bạn phải bắt đầu bằng **"${requiredStart.toUpperCase()}"**. ${currentPlayer} bị loại!`);
        activePlayers.splice(turnIndex, 1);
        if (activePlayers.length > 0) turnIndex %= activePlayers.length;
        continue;
      }

      if (usedWords.has(content.toLowerCase())) {
        await msg.reply(`❌ Từ **"${content}"** đã được dùng trước đó! ${currentPlayer} bị loại!`);
        activePlayers.splice(turnIndex, 1);
        if (activePlayers.length > 0) turnIndex %= activePlayers.length;
        continue;
      }

      usedWords.add(content.toLowerCase());
      lastWord = content;
      await msg.react('✅');

      turnIndex = (turnIndex + 1) % activePlayers.length;

    } catch (err) {
      await channel.send(`⏱️ Hết 20 giây! ${currentPlayer} không trả lời kịp và bị loại!`);
      activePlayers.splice(turnIndex, 1);
      if (activePlayers.length > 0) turnIndex %= activePlayers.length;
    }
  }

  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    const winEmbed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🏆 VÔ ĐỊCH NỐI TỪ')
      .setDescription(`Chúc mừng **${winner.username}** (${winner}) đã chiến thắng sòng Nối Từ! 🎉`)
      .setTimestamp();

    await channel.send({ embeds: [winEmbed] });
  }
}

module.exports = {
  name: 'noitu',
  description: 'Game Nối Từ multiplayer',
  execute: startNoituGame,
  startNoituGame: startNoituGame
};
