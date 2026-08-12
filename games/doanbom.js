// games/doanbom.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const JOIN_TIME = 20000;
const MIN_PLAYERS = 2;
const ROUND_TIME = 10000; // đã giảm từ 15s xuống 10s
const CELL_COUNT = 9;
const BETWEEN_ROUND_DELAY = 5000;

async function startDoanBom(client, message, store) {
  const joinEmbed = new EmbedBuilder()
    .setColor('#FF4444')
    .setTitle('🎮 GAME ĐOÁN BOM 💣')
    .setDescription('Bấm nút bên dưới để tham gia!\n\n👥 Đã tham gia: **0** người\nChưa có ai tham gia');

  const joinRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bom_join').setLabel('🙋 Tham gia').setStyle(ButtonStyle.Success)
  );

  const gameMsg = await message.reply({ embeds: [joinEmbed], components: [joinRow] });

  store.activeDoanBomGames.set(gameMsg.id, {
    phase: 'joining',
    participants: new Map(),
    alive: new Set(),
    pot: 0,
    round: 0,
    picks: new Map(),
    bombIndex: null
  });

  const joinCollector = gameMsg.createMessageComponentCollector({ time: JOIN_TIME });
  joinCollector.on('end', async () => {
    const gameData = store.activeDoanBomGames.get(gameMsg.id);
    if (!gameData) return;

    if (gameData.participants.size < MIN_PLAYERS) {
      store.activeDoanBomGames.delete(gameMsg.id);
      return gameMsg.edit({
        content: `❌ Không đủ người chơi (cần tối thiểu ${MIN_PLAYERS} người), đã hủy game.`,
        embeds: [],
        components: []
      });
    }

    gameData.phase = 'playing';
    gameData.alive = new Set(gameData.participants.keys());
    await runRound(gameMsg, store);
  });
}

async function runRound(gameMsg, store) {
  const gameData = store.activeDoanBomGames.get(gameMsg.id);
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

  await gameMsg.edit({ embeds: [roundEmbed], components: rows });

  const collector = gameMsg.createMessageComponentCollector({ time: ROUND_TIME });
  collector.on('end', async () => {
    await resolveRound(gameMsg, store);
  });
}

async function resolveRound(gameMsg, store) {
  const gameData = store.activeDoanBomGames.get(gameMsg.id);
  if (!gameData) return;

  const bombIndex = gameData.bombIndex;
  const eliminated = [];

  gameData.picks.forEach((cellIndex, userId) => {
    if (cellIndex === bombIndex && gameData.alive.has(userId)) {
      eliminated.push(userId);
    }
  });

  eliminated.forEach(userId => gameData.alive.delete(userId));

  let resultDesc = `💣 Ô có bom: **Ô số ${bombIndex + 1}**\n\n`;

  if (eliminated.length > 0) {
    resultDesc += `☠️ Người bị loại:\n${eliminated.map(id => `• ${gameData.participants.get(id)}`).join('\n')}\n\n`;
  } else {
    const bonus = 1000 * gameData.alive.size;
    gameData.pot += bonus;
    resultDesc += `✅ Không ai chọn trúng ô bom! Tiền thưởng **+${bonus.toLocaleString()} Mcoin**\n\n`;
  }

  const aliveNames = Array.from(gameData.alive).map(id => gameData.participants.get(id));
  resultDesc += `👥 Người còn sống (${gameData.alive.size}): ${aliveNames.join(', ') || 'Không còn ai'}\n`;
  resultDesc += `💰 Tiền thưởng hiện tại: **${gameData.pot.toLocaleString()} Mcoin**`;

  const resultEmbed = new EmbedBuilder()
    .setColor(eliminated.length > 0 ? '#FF0000' : '#00FF00')
    .setTitle(`💥 KẾT QUẢ VÒNG ${gameData.round}`)
    .setDescription(resultDesc);

  await gameMsg.edit({ embeds: [resultEmbed], components: [] });

  if (gameData.alive.size <= 1) {
    store.activeDoanBomGames.delete(gameMsg.id);

    if (gameData.alive.size === 1) {
      const winnerId = Array.from(gameData.alive)[0];
      const winnerName = gameData.participants.get(winnerId);
      store.addTungXu(winnerId, gameData.pot);

      const winEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 NGƯỜI CHIẾN THẮNG! 🏆')
        .setDescription(`🎉 **${winnerName}** đã sống sót đến cuối cùng và nhận toàn bộ **${gameData.pot.toLocaleString()} Mcoin**!`);
      await gameMsg.channel.send({ embeds: [winEmbed] });
    } else {
      await gameMsg.channel.send('💥 Không còn ai sống sót! Ván game kết thúc mà không có người thắng cuộc.');
    }
    return;
  }

  setTimeout(() => {
    runRound(gameMsg, store);
  }, BETWEEN_ROUND_DELAY);
}

module.exports = { startDoanBom };
