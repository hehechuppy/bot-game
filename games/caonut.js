// games/caonut.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function getCardValue(rank) {
  if (rank === 'A') return 1;
  if (rank >= '2' && rank <= '9') return parseInt(rank);
  return 0; // 10, J, Q, K
}

function generateDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

async function startCaoNut(client, message, store, betAmount) {
  if (betAmount <= 0) {
    return message.reply('❌ Tiền cược phải lớn hơn 0!');
  }

  const caonutEmbed = new EmbedBuilder()
    .setColor('#FF6B9D')
    .setTitle('🃏 CÀO NÚT 3 LÁ - ĐỀ CAO NÚT')
    .setDescription(`**Tiền cược bàn:** ${betAmount.toLocaleString()} Mcoin\n\nBấm nút để tham gia!`)
    .setFooter({ text: 'Chờ tối đa 25 giây để đủ người chơi' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('caonut_join')
      .setLabel('Tham Gia Ván')
      .setStyle(ButtonStyle.Success)
  );

  const gameMsg = await message.reply({ embeds: [caonutEmbed], components: [row] });

  const gameData = {
    betAmount,
    players: new Map(), // userId -> { username, hand: [] }
    deck: generateDeck(),
    gameMsg,
    channel: message.channel
  };

  store.activeCaoNutGames.set(gameMsg.id, gameData);

  const collector = gameMsg.createMessageComponentCollector({ time: 25000 });
  
  collector.on('end', async () => {
    await handleGameStart(client, store, gameMsg.id, gameData);
  });
}

async function handleGameStart(client, store, gameMsgId, gameData) {
  store.activeCaoNutGames.delete(gameMsgId);

  if (gameData.players.size < 2) {
    return gameData.gameMsg.edit({
      content: '❌ Không đủ người chơi (tối thiểu 2). Ván hủy!',
      embeds: [],
      components: []
    });
  }

  // Phát 3 lá cho mỗi người
  const playerIds = Array.from(gameData.players.keys());
  let deckIndex = 0;

  const handData = new Map();

  for (const userId of playerIds) {
    const hand = [
      gameData.deck[deckIndex++],
      gameData.deck[deckIndex++],
      gameData.deck[deckIndex++]
    ];
    handData.set(userId, hand);
  }

  // Gửi DM cho mỗi người chơi
  const dmData = new Map();

  for (const userId of playerIds) {
    const user = await client.users.fetch(userId);
    const hand = handData.get(userId);
    const playerData = gameData.players.get(userId);

    const dmEmbed = new EmbedBuilder()
      .setColor('#FF6B9D')
      .setTitle('🃏 Thẻ của bạn')
      .setDescription(
        `Lá 1: **${hand[0].rank}${hand[0].suit}**\n` +
        `Lá 2: **${hand[1].rank}${hand[1].suit}**\n` +
        `Lá 3: **❓**`
      );

    const dmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`caonut_reveal_${gameMsgId}_${userId}`)
        .setLabel('🔓 Mở Lá Thứ 3')
        .setStyle(ButtonStyle.Primary)
    );

    try {
      const dmMsg = await user.send({ embeds: [dmEmbed], components: [dmRow] });
      dmData.set(userId, { revealed: false, dmMsg });
    } catch (err) {
      console.error(`Không gửi DM cho ${userId}:`, err);
    }
  }

  // Lưu hand data và dm data tạm thời
  const tempGameData = {
    players: gameData.players,
    handData,
    dmData,
    betAmount: gameData.betAmount,
    gameMsg: gameData.gameMsg,
    channel: gameData.channel
  };

  store.activeCaoNutGames.set(gameMsgId, tempGameData);

  // Chờ 10 giây để người chơi mở lá 3
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Tự động mở lá lá 3 cho ai chưa mở
  for (const userId of playerIds) {
    const userDmData = dmData.get(userId);
    if (!userDmData.revealed) {
      const hand = handData.get(userId);
      const dmEmbed = new EmbedBuilder()
        .setColor('#FF6B9D')
        .setTitle('🃏 Thẻ của bạn')
        .setDescription(
          `Lá 1: **${hand[0].rank}${hand[0].suit}**\n` +
          `Lá 2: **${hand[1].rank}${hand[1].suit}**\n` +
          `Lá 3: **${hand[2].rank}${hand[2].suit}** ⚡`
        );

      try {
        await userDmData.dmMsg.edit({ embeds: [dmEmbed], components: [] });
      } catch (err) {
        console.error(`Không cập nhật DM cho ${userId}`);
      }
    }
  }

  // Tính kết quả
  await calculateResults(store, gameMsgId, tempGameData, handData);
}

async function calculateResults(store, gameMsgId, gameData, handData) {
  const results = [];
  let maxValue = -1;
  const winners = [];

  for (const [userId, hand] of handData) {
    const v1 = getCardValue(hand[0].rank);
    const v2 = getCardValue(hand[1].rank);
    const v3 = getCardValue(hand[2].rank);
    const total = (v1 + v2 + v3) % 10;

    results.push({
      userId,
      username: gameData.players.get(userId).username,
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

  results.sort((a, b) => b.total - a.total);

  // Tính tiền thưởng
  const totalPot = gameData.betAmount * gameData.players.size;
  const prizePerWinner = Math.floor(totalPot / winners.length);

  const summary = [];
  for (const result of results) {
    const cards = `${result.hand[0].rank}${result.hand[0].suit} ${result.hand[1].rank}${result.hand[1].suit} ${result.hand[2].rank}${result.hand[2].suit}`;
    const isWinner = winners.includes(result.userId);
    const dailyData = store.getDailyData(result.userId);
    dailyData.games++;

    if (isWinner) {
      store.addTungXu(result.userId, prizePerWinner);
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

  const resEmbed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🏆 KẾT QUẢ CÀO NÚT')
    .setDescription(summary.join('\n') || '❌ Không có người chơi')
    .addField('Pot', `${totalPot.toLocaleString()} Mcoin`, true)
    .addField('Người Thắng', `${winners.length} người`, true);

  try {
    await gameData.gameMsg.edit({ embeds: [resEmbed], components: [] });
  } catch (err) {
    console.error('Lỗi cập nhật kết quả cào nút:', err);
  }
  
  store.activeCaoNutGames.delete(gameMsgId);
}

module.exports = { startCaoNut };
