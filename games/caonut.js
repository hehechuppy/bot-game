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

  if (
    rank === '2' ||
    rank === '3' ||
    rank === '4' ||
    rank === '5' ||
    rank === '6' ||
    rank === '7' ||
    rank === '8' ||
    rank === '9'
  ) {
    return parseInt(rank);
  }

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

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [deck[i], deck[j]] = [
      deck[j],
      deck[i]
    ];
  }

  return deck;
}

function buildGameEmbed(gameData) {
  const players = Array.from(
    gameData.players.values()
  );

  const playerText =
    players.length > 0
      ? players
          .map(
            (player, index) =>
              `> **${index + 1}.** ${player.username}`
          )
          .join('\n')
      : '> Chưa có ai tham gia';

  return new EmbedBuilder()
    .setColor('#FF4F9A')
    .setTitle('🃏 CÀO NÚT 3 LÁ')
    .setDescription(
      `💰 **Tiền cược:** \`${gameData.betAmount.toLocaleString()} Mcoin\`\n\n` +
      `👥 **Người tham gia:** **${players.length} người**\n` +
      `${playerText}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🙋 **Bấm nút bên dưới để tham gia ván!**\n\n` +
      `⏳ Thời gian chờ: **25 giây**\n` +
      `👤 Tối thiểu: **2 người**`
    )
    .setFooter({
      text: '🃏 Cào Nút • Ai cao nút hơn sẽ thắng'
    })
    .setTimestamp();
}

function buildJoinRow() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('caonut_join')
        .setLabel('🙋 Tham gia')
        .setStyle(ButtonStyle.Success)
    );
}

async function startCaoNut(
  client,
  message,
  store,
  betAmount
) {
  if (
    !Number.isInteger(betAmount) ||
    betAmount <= 0
  ) {
    return message.reply(
      '❌ Tiền cược phải là số nguyên lớn hơn 0!'
    );
  }

  const caonutGameData = {
    betAmount,

    // userId -> {
    //   username,
    //   hand
    // }
    players: new Map(),

    deck: generateDeck(),

    gameMsg: null,
    channel: message.channel,

    started: false,
    ended: false
  };

  const gameMsg = await message.reply({
    embeds: [
      buildGameEmbed(
        caonutGameData
      )
    ],
    components: [
      buildJoinRow()
    ]
  });

  caonutGameData.gameMsg = gameMsg;

  store.activeCaoNutGames.set(
    gameMsg.id,
    caonutGameData
  );

  const collector =
    gameMsg.createMessageComponentCollector({
      time: 25000
    });

  collector.on(
    'end',
    async () => {
      if (
        caonutGameData.ended
      ) {
        return;
      }

      caonutGameData.started = true;

      await handleGameStart(
        client,
        store,
        gameMsg.id,
        caonutGameData
      );
    }
  );
}

async function handleGameStart(
  client,
  store,
  gameMsgId,
  gameData
) {
  if (
    gameData.players.size < 2
  ) {
    try {
      await gameData.gameMsg.edit({
        content:
          '❌ **VÁN CÀO NÚT ĐÃ HỦY**\nKhông đủ người chơi (tối thiểu 2 người).',
        embeds: [],
        components: []
      });
    } catch (err) {
      console.error(
        'Lỗi hủy ván Cào Nút:',
        err
      );
    }

    // Trường hợp này không nên còn tiền chưa hoàn trả,
    // vì tiền đã được trừ khi người chơi bấm tham gia.
    // Hoàn tiền cho những người đã tham gia.
    for (
      const [
        userId
      ] of gameData.players
    ) {
      const currentBalance =
        store.economyMap.get(
          userId
        ) || 0;

      store.economyMap.set(
        userId,
        currentBalance +
          gameData.betAmount
      );
    }

    store.activeCaoNutGames.delete(
      gameMsgId
    );

    gameData.ended = true;

    return;
  }

  const playerIds =
    Array.from(
      gameData.players.keys()
    );

  let deckIndex = 0;

  const handData = new Map();

  // ==========================================
  // PHÁT 3 LÁ
  // ==========================================

  for (
    const userId of playerIds
  ) {
    const hand = [
      gameData.deck[
        deckIndex++
      ],
      gameData.deck[
        deckIndex++
      ],
      gameData.deck[
        deckIndex++
      ]
    ];

    handData.set(
      userId,
      hand
    );

    const player =
      gameData.players.get(
        userId
      );

    player.hand = hand;
  }

  // ==========================================
  // GỬI DM
  // ==========================================

  const dmData = new Map();

  for (
    const userId of playerIds
  ) {
    try {
      const user =
        await client.users.fetch(
          userId
        );

      const hand =
        handData.get(userId);

      const dmEmbed =
        new EmbedBuilder()
          .setColor('#FF4F9A')
          .setTitle(
            '🃏 THẺ CÀO NÚT CỦA BẠN'
          )
          .setDescription(
            `💳 **Lá 1:** ${hand[0].rank}${hand[0].suit}\n` +
            `💳 **Lá 2:** ${hand[1].rank}${hand[1].suit}\n` +
            `❓ **Lá 3:** Chưa mở\n\n` +
            `🔐 Bạn có thể bấm nút bên dưới để mở lá thứ 3.`
          )
          .setFooter({
            text:
              '⏳ Sau 10 giây lá thứ 3 sẽ tự động mở'
          });

      const dmRow =
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `caonut_reveal_${gameMsgId}_${userId}`
              )
              .setLabel(
                '🔓 Mở Lá Thứ 3'
              )
              .setStyle(
                ButtonStyle.Primary
              )
          );

      const dmMsg =
        await user.send({
          embeds: [
            dmEmbed
          ],
          components: [
            dmRow
          ]
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
  // LƯU DATA
  // ==========================================

  const tempGameData = {
    players:
      gameData.players,

    handData,

    dmData,

    betAmount:
      gameData.betAmount,

    gameMsg:
      gameData.gameMsg,

    channel:
      gameData.channel,

    ended: false
  };

  store.activeCaoNutGames.set(
    gameMsgId,
    tempGameData
  );

  // ==========================================
  // CHỜ 10 GIÂY
  // ==========================================

  await new Promise(
    resolve =>
      setTimeout(
        resolve,
        10000
      )
  );

  // ==========================================
  // TỰ ĐỘNG MỞ LÁ 3
  // ==========================================

  for (
    const userId of playerIds
  ) {
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
        .setColor('#FF4F9A')
        .setTitle(
          '🃏 THẺ CÀO NÚT CỦA BẠN'
        )
        .setDescription(
          `💳 **Lá 1:** ${hand[0].rank}${hand[0].suit}\n` +
          `💳 **Lá 2:** ${hand[1].rank}${hand[1].suit}\n` +
          `💳 **Lá 3:** ${hand[2].rank}${hand[2].suit} ⚡\n\n` +
          `⏰ Hết thời gian. Lá thứ 3 đã được tự động mở.`
        )
        .setFooter({
          text:
            '🃏 Đã mở đủ 3 lá'
        });

    try {
      userDmData.revealed =
        true;

      await userDmData.dmMsg.edit({
        embeds: [
          dmEmbed
        ],
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

  for (
    const [
      userId,
      hand
    ] of handData
  ) {
    const v1 =
      getCardValue(
        hand[0].rank
      );

    const v2 =
      getCardValue(
        hand[1].rank
      );

    const v3 =
      getCardValue(
        hand[2].rank
      );

    const total =
      (
        v1 +
        v2 +
        v3
      ) % 10;

    const player =
      gameData.players.get(
        userId
      );

    results.push({
      userId,

      username:
        player
          ? player.username
          : 'Người chơi',

      hand,

      total
    });

    if (
      total > maxValue
    ) {
      maxValue =
        total;

      winners.length = 0;

      winners.push(
        userId
      );
    } else if (
      total === maxValue
    ) {
      winners.push(
        userId
      );
    }
  }

  results.sort(
    (a, b) =>
      b.total -
      a.total
  );

  // ==========================================
  // TÍNH POT
  // ==========================================

  const totalPot =
    gameData.betAmount *
    gameData.players.size;

  const prizePerWinner =
    Math.floor(
      totalPot /
      winners.length
    );

  // ==========================================
  // DAILY
  // ==========================================

  for (
    const result of results
  ) {
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
  // SUMMARY
  // ==========================================

  const summary = [];

  for (
    const result of results
  ) {
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
        `🏆 **${result.username}**\n` +
        `> 🎯 Nút: **${result.total}**\n` +
        `> 🃏 ${cards}\n` +
        `> 💰 **+${prizePerWinner.toLocaleString()} Mcoin**`
      );
    } else {
      summary.push(
        `❌ **${result.username}**\n` +
        `> 🎯 Nút: **${result.total}**\n` +
        `> 🃏 ${cards}\n` +
        `> 💸 **-${gameData.betAmount.toLocaleString()} Mcoin**`
      );
    }
  }

  // ==========================================
  // DM KẾT QUẢ
  // ==========================================

  for (
    const result of results
  ) {
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
              ? '#00FF88'
              : '#FF4444'
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
            text:
              '🃏 Cào Nút 3 Lá'
          })
          .setTimestamp();

      await user.send({
        embeds: [
          dmEmbed
        ]
      });
    } catch (err) {
      console.error(
        `Lỗi gửi DM kết quả cho ${result.userId}:`,
        err
      );
    }
  }

  // ==========================================
  // CÔNG BỐ KẾT QUẢ
  // ==========================================

  const resEmbed =
    new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(
        '🏆 KẾT QUẢ CÀO NÚT 3 LÁ'
      )
      .setDescription(
        summary.join(
          '\n\n'
        ) ||
        '❌ Không có người chơi'
      )
      .addFields(
        {
          name:
            '💰 Pot Tổng',
          value:
            `${totalPot.toLocaleString()} Mcoin`,
          inline: true
        },
        {
          name:
            '👑 Người Thắng',
          value:
            `${winners.length} người`,
          inline: true
        },
        {
          name:
            '💵 Giải Thưởng/Người',
          value:
            `${prizePerWinner.toLocaleString()} Mcoin`,
          inline: true
        }
      )
      .setFooter({
        text:
          '🃏 Ván Cào Nút đã kết thúc'
      })
      .setTimestamp();

  try {
    await gameData.channel.send({
      embeds: [
        resEmbed
      ]
    });
  } catch (err) {
    console.error(
      'Lỗi gửi kết quả:',
      err
    );
  }

  try {
    await gameData.gameMsg.edit({
      content:
        '✅ **Ván Cào Nút kết thúc!** Kết quả đã được công bố.',
      embeds: [],
      components: []
    });
  } catch (err) {
    console.error(
      'Lỗi cập nhật message:',
      err
    );
  }

  gameData.ended =
    true;

  store.activeCaoNutGames.delete(
    gameMsgId
  );
}

module.exports = {
  startCaoNut
};
