// games/doanbom.js - Game Đoán Bom
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

// Map theo guildId (không phải channelId) → chỉ 1 ván per server
const activeDoanbomGames = new Map(); // guildId -> gameData

async function startDoanBom(client, message, store) {
  const guildId = message.guild.id;
  const userId = message.author.id;

  // Kiểm tra đã có ván đang chạy trong server chưa
  if (activeDoanbomGames.has(guildId)) {
    return message.reply('⚠️ Đang có ván Đoán Bom chạy trong server này! Chờ ván hiện tại kết thúc.');
  }

  const gameData = {
    guildId,
    channelId: message.channelId,
    hostId: userId,
    hostName: message.author.username,
    players: new Map(), // userId -> { name, alive: true }
    pot: 0,
    betPerRound: 10000, // Mỗi vòng mất 10k nếu chọn trúng bom
    bonusPool: 0,       // Tích lũy tiền thưởng
    round: 0,
    phase: 'joining',   // joining -> playing -> ended
    gameMsg: null,
    channel: message.channel,
    ended: false
  };

  activeDoanbomGames.set(guildId, gameData);

  // Embed chờ tham gia
  const joinEmbed = buildJoinEmbed(gameData);
  const joinRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bom_join_${guildId}`)
      .setLabel('🙋 Tham Gia')
      .setStyle(ButtonStyle.Success)
  );

  const gameMsg = await message.reply({ embeds: [joinEmbed], components: [joinRow] });
  gameData.gameMsg = gameMsg;

  // Collector cho button tham gia (30 giây)
  const joinCollector = gameMsg.createMessageComponentCollector({ time: 30000 });

  joinCollector.on('collect', async (interaction) => {
    if (interaction.customId !== `bom_join_${guildId}`) return;

    const joinUserId = interaction.user.id;

    if (gameData.players.has(joinUserId)) {
      return interaction.reply({ content: '⚠️ Bạn đã tham gia rồi!', ephemeral: true });
    }

    gameData.players.set(joinUserId, {
      name: interaction.user.username,
      alive: true
    });

    await interaction.update({
      embeds: [buildJoinEmbed(gameData)],
      components: [joinRow]
    });
  });

  joinCollector.on('end', async () => {
    if (gameData.ended) return;

    // Kiểm tra tối thiểu 2 người
    if (gameData.players.size < 2) {
      activeDoanbomGames.delete(guildId);
      gameData.ended = true;
      return gameMsg.edit({
        content: '❌ **Game hủy:** Không đủ người chơi (tối thiểu 2 người)!',
        embeds: [],
        components: []
      });
    }

    gameData.phase = 'playing';
    await gameMsg.edit({ embeds: [], components: [], content: '✅ Game đang bắt đầu...' });
    await runGame(client, store, gameData);
  });
}

function buildJoinEmbed(gameData) {
  const playerList = gameData.players.size > 0
    ? Array.from(gameData.players.values()).map((p, i) => `${i + 1}. ${p.name}`).join('\n')
    : '*Chưa có ai*';

  return new EmbedBuilder()
    .setColor('#FF6B35')
    .setTitle('💣 GAME ĐOÁN BOM - TÌM NGƯỜI CHƠI')
    .setDescription(
      `👤 **Người tạo:** ${gameData.hostName}\n\n` +
      `📋 **Luật chơi:**\n` +
      `• Mỗi vòng có **1 ô chứa bom** trong các ô\n` +
      `• Chọn trúng bom → **bị loại** và mất tiền vào pot\n` +
      `• Không ai trúng bom → tất cả nhận thưởng\n` +
      `• Người **cuối cùng còn sống** thắng toàn bộ pot!\n\n` +
      `👥 **Người đã tham gia (${gameData.players.size}):**\n${playerList}\n\n` +
      `⏳ Game bắt đầu sau **30 giây**`
    )
    .setFooter({ text: '💣 Đoán Bom • Tối thiểu 2 người' })
    .setTimestamp();
}

async function runGame(client, store, gameData) {
  const guildId = gameData.guildId;

  while (true) {
    // Đếm người còn sống
    const alivePlayers = Array.from(gameData.players.entries())
      .filter(([, p]) => p.alive);

    if (alivePlayers.length <= 1) break;

    gameData.round++;

    // Số ô = số người còn sống + 2 (để có ô an toàn)
    const numCells = alivePlayers.length + 2;
    const bombCell = Math.floor(Math.random() * numCells) + 1;

    // Tích lũy pot: mỗi người còn sống bỏ vào 10k/vòng
    const roundBet = 10000 * alivePlayers.length;
    for (const [uid] of alivePlayers) {
      const bal = store.getBalance(guildId, uid);
      const deduct = Math.min(10000, bal);
      store.setBalance(guildId, uid, bal - deduct);
      gameData.bonusPool += deduct;
    }

    const aliveNames = alivePlayers.map(([, p]) => p.name).join(', ');

    // Tạo embed vòng chơi
    const roundEmbed = new EmbedBuilder()
      .setColor('#FF4444')
      .setTitle(`💣 GAME ĐOÁN BOM - VÒNG ${gameData.round} 💣`)
      .setDescription(
        `👥 **Người còn sống:** ${alivePlayers.length}\n` +
        `💰 **Tiền thưởng hiện tại:** ${gameData.bonusPool.toLocaleString()} Mcoin\n\n` +
        `Chọn 1 trong ${numCells} ô bên dưới trong vòng **15 giây**!\n` +
        `Một ô có bom, chọn trúng sẽ bị loại.`
      )
      .setFooter({ text: `💣 Đoán Bom • Vòng ${gameData.round}` })
      .setTimestamp();

    // Tạo các nút số
    const rows = [];
    let currentRow = new ActionRowBuilder();
    let count = 0;

    for (let i = 1; i <= numCells; i++) {
      if (count === 5) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
        count = 0;
      }
      currentRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`bom_cell_${guildId}_${gameData.round}_${i}`)
          .setLabel(`${i}`)
          .setStyle(ButtonStyle.Secondary)
      );
      count++;
    }
    if (count > 0) rows.push(currentRow);

    const roundMsg = await gameData.channel.send({
      embeds: [roundEmbed],
      components: rows
    });

    // Thu thập lựa chọn của người chơi (15 giây)
    const choices = new Map(); // userId -> cellNumber
    const collector = roundMsg.createMessageComponentCollector({ time: 15000 });

    await new Promise((resolve) => {
      collector.on('collect', async (interaction) => {
        const uid = interaction.user.id;

        // Chỉ người đang còn sống mới được chọn
        if (!gameData.players.get(uid)?.alive) {
          return interaction.reply({ content: '❌ Bạn đã bị loại rồi!', ephemeral: true });
        }

        if (choices.has(uid)) {
          return interaction.reply({ content: '⚠️ Bạn đã chọn rồi!', ephemeral: true });
        }

        const parts = interaction.customId.split('_');
        const cellNum = parseInt(parts[parts.length - 1]);
        choices.set(uid, cellNum);

        await interaction.reply({
          content: `✅ Bạn đã chọn ô **${cellNum}**!`,
          ephemeral: true
        });

        // Nếu tất cả người còn sống đã chọn → kết thúc sớm
        if (choices.size >= alivePlayers.length) {
          collector.stop('all_chosen');
        }
      });

      collector.on('end', () => resolve());
    });

    // Disable các nút sau khi hết giờ
    const disabledRows = rows.map(row => {
      const newRow = new ActionRowBuilder();
      row.components.forEach(btn => {
        newRow.addComponents(
          ButtonBuilder.from(btn).setDisabled(true)
        );
      });
      return newRow;
    });
    await roundMsg.edit({ components: disabledRows }).catch(() => {});

    // Xử lý kết quả vòng
    const eliminated = [];
    const safe = [];

    for (const [uid, p] of alivePlayers) {
      const choice = choices.get(uid);
      if (!choice) {
        // Không chọn → bị loại (tự động)
        p.alive = false;
        eliminated.push({ name: p.name, choice: '(không chọn)', reason: 'timeout' });
      } else if (choice === bombCell) {
        p.alive = false;
        eliminated.push({ name: p.name, choice, reason: 'bomb' });
      } else {
        safe.push({ name: p.name, choice });
      }
    }

    // Thưởng cho người không trúng bom vòng này
    const roundBonus = 20000;
    if (eliminated.length === 0) {
      // Không ai trúng bom → thưởng thêm
      for (const [uid] of alivePlayers) {
        store.addTungXu(guildId, uid, roundBonus);
      }
    }

    // Embed kết quả vòng
    const eliminatedText = eliminated.length > 0
      ? eliminated.map(p => `• ${p.name}${p.reason === 'bomb' ? ` (chọn ô ${p.choice} 💥)` : ' (hết giờ)'}`).join('\n')
      : '*Không ai bị loại*';

    const aliveAfter = Array.from(gameData.players.values()).filter(p => p.alive);
    const aliveText = aliveAfter.map(p => p.name).join(', ') || 'Không còn ai';

    const resultEmbed = new EmbedBuilder()
      .setColor(eliminated.length > 0 ? '#FF0000' : '#00FF00')
      .setTitle(`💥 KẾT QUẢ VÒNG ${gameData.round}`)
      .setDescription(
        `🎯 **Ô có bom:** Ô số **${bombCell}**\n\n` +
        `☠️ **Người bị loại (${eliminated.length} người):**\n${eliminatedText}\n` +
        (eliminated.length === 0 ? `\n✅ Không ai chọn trúng ô bom! Tiền thưởng +${roundBonus.toLocaleString()} Mcoin\n` : '') +
        `\n👥 **Người còn sống (${aliveAfter.length}):** ${aliveText}\n` +
        `💰 **Tiền thưởng hiện tại:** ${gameData.bonusPool.toLocaleString()} Mcoin`
      )
      .setTimestamp();

    await gameData.channel.send({ embeds: [resultEmbed] });

    // Chờ 3 giây trước vòng tiếp theo
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // ================= KẾT THÚC GAME =================
  const finalAlive = Array.from(gameData.players.entries()).filter(([, p]) => p.alive);

  if (finalAlive.length === 1) {
    const [winnerId, winnerData] = finalAlive[0];
    const totalPrize = gameData.bonusPool + 10000; // +10k thưởng người cuối

    store.addTungXu(guildId, winnerId, totalPrize);

    // Cộng game count
    for (const [uid] of gameData.players) {
      const dData = store.getDailyData(guildId, uid);
      if (dData && !dData.claimedGame) dData.games++;
    }

    const winEmbed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🏆 NGƯỜI CHIẾN THẮNG! 🏆')
      .setDescription(
        `🎉 **Người thắng**\n**${winnerData.name}**\n\n` +
        `💰 **Tiền thưởng (gồm +10k người cuối)**\n**${totalPrize.toLocaleString()} Mcoin**`
      )
      .setTimestamp();

    await gameData.channel.send({ embeds: [winEmbed] });
  } else {
    // Hòa - chia đều pot
    const splitPrize = finalAlive.length > 0
      ? Math.floor(gameData.bonusPool / finalAlive.length)
      : 0;

    for (const [uid] of finalAlive) {
      store.addTungXu(guildId, uid, splitPrize);
    }

    const drawEmbed = new EmbedBuilder()
      .setColor('#00FFCC')
      .setTitle('🤝 HÒA!')
      .setDescription(
        `Tất cả người chơi còn lại chia đều pot!\n` +
        `💰 Mỗi người nhận: **${splitPrize.toLocaleString()} Mcoin**`
      )
      .setTimestamp();

    await gameData.channel.send({ embeds: [drawEmbed] });
  }

  // Xóa game
  activeDoanbomGames.delete(guildId);
  gameData.ended = true;
}

module.exports = { startDoanBom };
