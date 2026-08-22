const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = [
  'A', '2', '3', '4', '5', '6', '7',
  '8', '9', '10', 'J', 'Q', 'K'
];

function getCardValue(rank) {
  if (rank === 'A') return 1;
  if (rank >= '2' && rank <= '9') return parseInt(rank);
  return 0;
}

function generateDeck() {
  const deck = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        suit,
        rank
      });
    }
  }

  return deck.sort(() => Math.random() - 0.5);
}

async function startCaoNut(client, message, store, betAmount) {
  if (betAmount <= 0) {
    return message.reply(
      '❌ Tiền cược phải lớn hơn 0!'
    );
  }

  const caonutEmbed = new EmbedBuilder()
    .setColor('#FF6B9D')
    .setTitle('🃏 CÀO NÚT 3 LÁ')
    .setDescription(
      `💰 **Tiền cược:** ${betAmount.toLocaleString()} Mcoin\n\n` +
      `👥 **Người tham gia:** **0 người**\n` +
      `> Chưa có ai tham gia\n\n` +
      `🙋 Bấm nút bên dưới để tham gia ván!`
    )
    .setFooter({
      text: '⏳ Chờ tối đa 25 giây • Tối thiểu 2 người'
    });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('caonut_join')
        .setLabel('🙋 Tham gia')
        .setStyle(ButtonStyle.Success)
    );

  const gameMsg = await message.reply({
    embeds: [caonutEmbed],
    components: [row]
  });

  const gameData = {
    betAmount,

    // userId -> {
    //   username,
    //   hand
    // }
    players: new Map(),

    deck: generateDeck(),

    gameMsg,
    channel: message.channel
  };

  store.activeCaoNutGames.set(
    gameMsg.id,
    gameData
  );

  const collector =
    gameMsg.createMessageComponentCollector({
      time: 25000
    });

  collector.on('end', async () => {
    await handleGameStart(
      client,
      store,
      gameMsg.id,
      gameData
    );
  });
}

async function handleGameStart(
  client,
  store,
  gameMsgId,
  gameData
) {
  if (gameData.players.size < 2) {
    try {
      await gameData.gameMsg.edit({
        content:
          '❌ Không đủ người chơi (tối thiểu 2). Ván hủy!',
        embeds: [],
        components: []
      });
    } catch (err) {
      console.error(
        'Lỗi hủy ván:',
        err
      );
    }

    store.activeCaoNutGames.delete(
      gameMsgId
    );

    return;
  }

  // ==========================================
  // PHÁT 3 LÁ CHO MỖI NGƯỜI
  // ==========================================

  const playerIds =
    Array.from(
      gameData.players.keys()
    );

  let deckIndex = 0;

  const handData = new Map();

  for (const userId of playerIds) {
    const hand = [
      gameData.deck[deckIndex++],
      gameData.deck[deckIndex++],
      gameData.deck[deckIndex++]
    ];

    handData.set(
      userId,
      hand
    );
  }

  // ==========================================
  // GỬI DM RIÊNG CHO TỪNG NGƯỜI
  // ==========================================

  const dmData = new Map();

  for (const userId of playerIds) {
    try {
      const user =
        await client.users.fetch(userId);

      const hand =
        handData.get(userId);

      const dmEmbed =
        new EmbedBuilder()
          .setColor('#FF6B9D')
          .setTitle('🃏 THẺ CÀO NÚT CỦA BẠN')
          .setDescription(
            `💳 **Lá 1:** ${hand[0].rank}${hand[0].suit}\n` +
            `💳 **Lá 2:** ${hand[1].rank}${hand[1].suit}\n` +
            `❓ **Lá 3:** Chưa mở\n\n` +
            `🔐 Bấm nút bên dưới để mở lá thứ 3.`
          )
          .setFooter({
            text: 'Bạn có 10 giây để tự mở lá thứ 3'
          });

      const dmRow =
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `caonut_reveal_${gameMsgId}_${userId}`
              )
              .setLabel('🔓 Mở Lá Thứ 3')
              .setStyle(ButtonStyle.Primary)
          );

      const dmMsg =
        await user.send({
          embeds: [dmEmbed],
          components: [dmRow]
        });

      dmData.set(
        userId,
        {
          revealed: false,
          dmMsg
        }
      );

    } catch (err) {
      console.error(
        `Không gửi DM cho ${userId}:`,
        err
      );

      // Vẫn lưu dữ liệu để game không bị crash
      dmData.set(
        userId,
        {
          revealed: true,
          dmMsg: null
        }
      );
    }
  }

  // ==========================================
  // LƯU DỮ LIỆU VÁN
  // ==========================================

  const tempGameData = {
    players: gameData.players,
    handData,
    dmData,
    betAmount: gameData.betAmount,
    gameMsg: gameData.gameMsg,
    channel: gameData.channel
  };

  store.activeCaoNutGames.set(
    gameMsgId,
    tempGameData
  );

  // ==========================================
  // CHỜ 10 GIÂY
  // ==========================================

  await new Promise(resolve =>
    setTimeout(resolve, 10000)
  );

  // ==========================================
  // TỰ ĐỘNG MỞ LÁ 3
  // ==========================================

  for (const userId of playerIds) {
    const userDmData =
      dmData.get(userId);

    if (
      !userDmData ||
      userDmData.revealed ||
      !userDmData.dmMsg
    ) {
      continue;
    }

    const hand =
      handData.get(userId);

    const dmEmbed =
      new EmbedBuilder()
        .setColor('#FF6B9D')
        .setTitle('🃏 THẺ CÀO NÚT CỦA BẠN')
        .setDescription(
          `💳 **Lá 1:** ${hand[0].rank}${hand[0].suit}\n` +
          `💳 **Lá 2:** ${hand[1].rank}${hand[1].suit}\n` +
          `💳 **Lá 3:** ${hand[2].rank}${hand[2].suit} ⚡\n\n` +
          `⏰ Hết thời gian mở thủ công. Lá 3 đã tự động được mở.`
        )
        .setFooter({
          text: 'Đã mở lá thứ 3'
        });

    try {
      userDmData.revealed = true;

      await userDmData.dmMsg.edit({
        embeds: [dmEmbed],
        components: []
      });

    } catch (err) {
      console.error(
        `Không cập nhật DM cho ${userId}:`,
        err
      );
    }
  }

  // ==========================================
  // TÍNH KẾT QUẢ
  // ==========================================

  await calculateResults(
    store,
    client,
    gameMsgId,
    tempGameData,
    handData
  );
}

async function calculateResults(
  store,
  client,
  gameMsgId,
  gameData,
  handData
) {
  const results = [];

  let maxValue = -1;

  const winners = [];

  // ==========================================
  // TÍNH NÚT
  // ==========================================

  for (const [userId, hand] of handData) {
    const v1 =
      getCardValue(hand[0].rank);

    const v2 =
      getCardValue(hand[1].rank);

    const v3 =
      getCardValue(hand[2].rank);

    const total =
      (v1 + v2 + v3) % 10;

    results.push({
      userId,

      username:
        gameData.players.get(
          userId
        ).username,

      hand,

      total
    });

    if (total > maxValue) {
      maxValue = total;

      winners.length = 0;

      winners.push(userId);

    } else if (total === maxValue) {
      winners.push(userId);
    }
  }

  // Xếp từ cao xuống thấp
  results.sort(
    (a, b) =>
      b.total - a.total
  );

  // ==========================================
  // TÍNH TIỀN
  // ==========================================

  const totalPot =
    gameData.betAmount *
    gameData.players.size;

  const prizePerWinner =
    Math.floor(
      totalPot / winners.length
    );

  // ==========================================
  // DAILY DATA
  // ==========================================

  for (const result of results) {
    const dailyData =
      store.getDailyData(
        result.userId
      );

    dailyData.games++;

    if (
      winners.includes(
        result.userId
      )
    ) {
      store.addTungXu(
        result.userId,
        prizePerWinner
      );
    }
  }

  // ==========================================
  // HIỂN THỊ KẾT QUẢ
  // ==========================================

  const summary = [];

  for (const result of results) {
    const cards =
      `${result.hand[0].rank}${result.hand[0].suit} ` +
      `${result.hand[1].rank}${result.hand[1].suit} ` +
      `${result.hand[2].rank}${result.hand[2].suit}`;

    const isWinner =
      winners.includes(
        result.userId
      );

    if (isWinner) {
      summary.push(
        `🏆 **${result.username}** - Nút: **${result.total}** | ${cards}\n` +
        `   ➕ +${prizePerWinner.toLocaleString()} Mcoin`
      );

    } else {
      summary.push(
        `❌ **${result.username}** - Nút: **${result.total}** | ${cards}\n` +
        `   ➖ -${gameData.betAmount.toLocaleString()} Mcoin`
      );
    }
  }

  // ==========================================
  // DM KẾT QUẢ
  // ==========================================

  for (const result of results) {
    try {
      const user =
        await client.users.fetch(
          result.userId
        );

      const isWinner =
        winners.includes(
          result.userId
        );

      const dmEmbed =
        new EmbedBuilder()
          .setColor(
            isWinner
              ? '#00FF00'
              : '#FF0000'
          )
          .setTitle(
            isWinner
              ? '🎉 BẠN THẮNG!'
              : '😢 BẠN THUA'
          )
          .setDescription(
            `💳 **Lá 1:** ${result.hand[0].rank}${result.hand[0].suit}\n` +
            `💳 **Lá 2:** ${result.hand[1].rank}${result.hand[1].suit}\n` +
            `💳 **Lá 3:** ${result.hand[2].rank}${result.hand[2].suit}\n\n` +
            `🎯 **Nút:** ${result.total}\n\n` +
            (
              isWinner
                ? `💰 **+${prizePerWinner.toLocaleString()} Mcoin**`
                : `💸 **-${gameData.betAmount.toLocaleString()} Mcoin**`
            )
          )
          .setFooter({
            text: 'Cào Nút 3 Lá'
          });

      await user.send({
        embeds: [dmEmbed]
      });

    } catch (err) {
      console.error(
        `Lỗi gửi DM kết quả cho ${result.userId}:`,
        err
      );
    }
  }

  // ==========================================
  // CÔNG BỐ CHANNEL
  // ==========================================

  const resEmbed =
    new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🏆 KẾT QUẢ CÀO NÚT 3 LÁ')
      .setDescription(
        summary.join('\n\n') ||
        '❌ Không có người chơi'
      )
      .addFields(
        {
          name: '💰 Pot Tổng',
          value:
            `${totalPot.toLocaleString()} Mcoin`,
          inline: true
        },
        {
          name: '👑 Người Thắng',
          value:
            `${winners.length} người`,
          inline: true
        },
        {
          name: '💵 Giải Thưởng/Người',
          value:
            `${prizePerWinner.toLocaleString()} Mcoin`,
          inline: true
        }
      )
      .setFooter({
        text: 'Ván Cào Nút đã kết thúc'
      })
      .setTimestamp();

  try {
    await gameData.channel.send({
      embeds: [resEmbed]
    });

  } catch (err) {
    console.error(
      'Lỗi gửi kết quả ở channel:',
      err
    );
  }

  // ==========================================
  // XÓA BUTTON TIN NHẮN GỐC
  // ==========================================

  try {
    await gameData.gameMsg.edit({
      content:
        '✅ Ván Cào Nút kết thúc! Kết quả đã được công bố.',
      embeds: [],
      components: []
    });

  } catch (err) {
    console.error(
      'Lỗi cập nhật message gốc:',
      err
    );
  }

  // ==========================================
  // XÓA GAME DATA
  // ==========================================

  store.activeCaoNutGames.delete(
    gameMsgId
  );
}

module.exports = {
  startCaoNut
};
