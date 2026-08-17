// games/doanbom.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const JOIN_TIME = 20000;
const MIN_PLAYERS = 2;
const ROUND_TIME = 10000;
const CELL_COUNT = 9;
const BETWEEN_ROUND_DELAY = 5000;

// Hàm an toàn để tránh lỗi 10062
async function safeRespond(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err?.code === 10062 || err?.code === 40060) {
      console.warn(`⚠️ Bỏ qua lỗi interaction ${err.code}`);
      return null;
    }
    throw err;
  }
}

async function startDoanBom(client, message, store) {
  const joinEmbed = new EmbedBuilder()
    .setColor('#FF4444')
    .setTitle('🎮 GAME ĐOÁN BOM 💣')
    .setDescription('Bấm nút bên dưới để tham gia!\n\n👥 Đã tham gia: **0** người\nChưa có ai tham gia');

  const joinRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bom_join').setLabel('🙋 Tham gia').setStyle(ButtonStyle.Success)
  );

  const gameMsg = await message.reply({ embeds: [joinEmbed], components: [joinRow] });

  const gameId = `bom_${gameMsg.id}`;
  store.activeDoanBomGames.set(gameId, {
    phase: 'joining',
    participants: new Map(),
    alive: new Set(),
    pot: 0,
    round: 0,
    picks: new Map(),
    bombIndex: null,
    channel: message.channel
  });

  const joinCollector = gameMsg.createMessageComponentCollector({ time: JOIN_TIME });
  joinCollector.on('end', async () => {
    const gameData = store.activeDoanBomGames.get(gameId);
    if (!gameData) return;

    if (gameData.participants.size < MIN_PLAYERS) {
      store.activeDoanBomGames.delete(gameId);
      return gameMsg.reply({
        content: `❌ Không đủ người chơi (cần tối thiểu ${MIN_PLAYERS} người), đã hủy game.`
      }).catch(() => {});
    }

    gameData.phase = 'playing';
    gameData.alive = new Set(gameData.participants.keys());
    await runRound(gameId, store);
  });
}

async function runRound(gameId, store) {
  const gameData = store.activeDoanBomGames.get(gameId);
  if (!gameData) return;

  gameData.round++;
  gameData.picks = new Map();
  gameData.bombIndex = Math.floor(Math.random() * CELL_COUNT);

  const roundEmbed = new EmbedBuilder()
    .setColor('#FF4444')
    .setTitle(`💣 GAME ĐOÁN BOM - VÒNG ${gameData.round} 💣`)
    .setDescription(
      `👥 Người còn sống: **${gameData.alive.size}**\n` +
      `💰 Tiền thưởng hiện tại: **${gameData.pot.toLocaleString()} Mcoin**\n\n` +
      `Chọn 1 trong 9 ô bên dưới trong vòng **10 giây**! Một ô có bom, chọn trúng sẽ bị loại.`
    );

  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      row.addComponents(
        new ButtonBuilder().setCustomId(`bom_cell_${idx}`).setLabel(`${idx + 1}`).setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(row);
  }

  // ✅ GỬI TIN NHẮN MỚI thay vì edit
  const roundMsg = await gameData.channel.send({ embeds: [roundEmbed], components: rows }).catch(() => null);
  if (!roundMsg) return;

  const collector = roundMsg.createMessageComponentCollector({ time: ROUND_TIME });
  collector.on('collect', async (interaction) => {
    // ✅ Reply ngay lập tức để tránh timeout
    await interaction.deferReply({ ephemeral: true });
    
    const userId = interaction.user.id;
    if (!gameData.alive.has(userId)) {
      return await safeRespond(() => interaction.editReply({ content: '❌ Bạn không còn trong trò chơi!' }));
    }
    if (gameData.picks.has(userId)) {
      return await safeRespond(() => interaction.editReply({ content: '❌ Bạn đã chọn ô rồi!' }));
    }
    
    const cellIndex = parseInt(interaction.customId.split('_')[2]);
    gameData.picks.set(userId, cellIndex);
    await safeRespond(() => interaction.editReply({ content: `✅ Bạn chọn ô số ${cellIndex + 1}!` }));
  });

  collector.on('end', async () => {
    await resolveRound(gameId, store);
  });
}

async function resolveRound(gameId, store) {
  const gameData = store.activeDoanBomGames.get(gameId);
  if (!gameData) return;

  const bombIndex = gameData.bombIndex;
  const eliminated = [];

  // ✅ CÁCH 1: Loại những ai chọn trúng bom
  gameData.picks.forEach((cellIndex, userId) => {
    if (cellIndex === bombIndex && gameData.alive.has(userId)) {
      eliminated.push(userId);
    }
  });

  // ✅ CÁCH 2: Loại những ai KHÔNG chọn số (AFK)
  gameData.alive.forEach((userId) => {
    if (!gameData.picks.has(userId)) {
      eliminated.push(userId);
    }
  });

  // ✅ Xóa trùng lặp (nếu có)
  const uniqueEliminated = [...new Set(eliminated)];

  // ✅ Loại những ai bị loại khỏi alive set
  uniqueEliminated.forEach(userId => gameData.alive.delete(userId));

  let resultDesc = `💣 Ô có bom: **Ô số ${bombIndex + 1}**\n\n`;

  if (uniqueEliminated.length > 0) {
    const bonus = uniqueEliminated.length * 20000;
    gameData.pot += bonus;
    resultDesc += `☠️ Người bị loại (${uniqueEliminated.length} người):\n${uniqueEliminated.map(id => `• ${gameData.participants.get(id)}`).join('\n')}\n`;
    resultDesc += `💰 Tiền thưởng cộng: **+${bonus.toLocaleString()} Mcoin**\n\n`;
  } else {
    const bonus = 30000;
    gameData.pot += bonus;
    resultDesc += `✅ Không ai chọn trúng ô bom! Tiền thưởng **+${bonus.toLocaleString()} Mcoin**\n\n`;
  }

  const aliveNames = Array.from(gameData.alive).map(id => gameData.participants.get(id));
  resultDesc += `👥 Người còn sống (${gameData.alive.size}): ${aliveNames.join(', ') || 'Không còn ai'}\n`;
  resultDesc += `💰 Tiền thưởng hiện tại: **${gameData.pot.toLocaleString()} Mcoin**`;

  const resultEmbed = new EmbedBuilder()
    .setColor(uniqueEliminated.length > 0 ? '#FF0000' : '#00FF00')
    .setTitle(`💥 KẾT QUẢ VÒNG ${gameData.round}`)
    .setDescription(resultDesc);

  // ✅ GỬI TIN NHẮN MỚI cho kết quả
  await gameData.channel.send({ embeds: [resultEmbed] }).catch(() => {});

  if (gameData.alive.size <= 1) {
    store.activeDoanBomGames.delete(gameId);

    if (gameData.alive.size === 1) {
      gameData.pot += 10000;
      const winnerId = Array.from(gameData.alive)[0];
      const winnerName = gameData.participants.get(winnerId);
      store.addTungXu(winnerId, gameData.pot);

      const winEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 NGƯỜI CHIẾN THẮNG! 🏆')
        .addFields(
          { name: '🎉 Người thắng', value: `**${winnerName}**`, inline: false },
          { name: '💰 Tiền thưởng (gồm +10k người cuối)', value: `**${gameData.pot.toLocaleString()} Mcoin**`, inline: false }
        );
      await gameData.channel.send({ embeds: [winEmbed] }).catch(() => {});
    } else {
      await gameData.channel.send('💥 Không còn ai sống sót! Ván game kết thúc mà không có người thắng cuộc.').catch(() => {});
    }
    return;
  }

  setTimeout(() => {
    runRound(gameId, store);
  }, BETWEEN_ROUND_DELAY);
}

module.exports = { startDoanBom };
