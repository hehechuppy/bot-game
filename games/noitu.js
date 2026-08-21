// games/noitu.js - Game Nối Tiếng (Word Chaining) - Đúng Luật
const { EmbedBuilder } = require('discord.js');

// Danh sách cụm từ/từ ghép Tiếng Việt (tiếng)
const WORD_LIST = [
  'mùa xuân', 'xuân thì', 'thì thầm', 'thầm lặng', 'lặng yên', 'yên tĩnh', 'tĩnh mơ', 'mơ mộng',
  'ngày hôm', 'hôm nay', 'nay mai', 'mai kia', 'kia quá', 'quá khứ', 'khứ vang', 'vang bóng',
  'sáng sớm', 'sớm mai', 'mai sau', 'sau này', 'này đó', 'đó thôi', 'thôi được', 'được rồi',
  'tối nay', 'nay mai', 'mai rồi', 'rồi thôi', 'thôi thôi', 'thôi được', 'được không', 'không được',
  'chuyên cần', 'cần mẫn', 'mẫn tiệp', 'tiệp tục', 'tục lệ', 'lệ độ', 'độ khó', 'khó khăn',
  'dáng dấp', 'dấp dểu', 'dểu dàng', 'dàng hoàng', 'hoàng hôn', 'hôn thân', 'thân yêu', 'yêu quý',
  'chùm chỉ', 'chỉ tay', 'tay chân', 'chân chạy', 'chạy nhanh', 'nhanh chóng', 'chóng mặt', 'mặt mũi',
  'bình tĩnh', 'tĩnh lặng', 'lặng im', 'im lặng', 'lặng thầm', 'thầm thì', 'thì thầm', 'thầm kín',
  'cơm cháy', 'cháy nóng', 'nóng lạnh', 'lạnh buốt', 'buốt giá', 'giá rét', 'rét mướn', 'mướn tẽn',
  'nước mắt', 'mắt nhìn', 'nhìn thấy', 'thấy được', 'được biết', 'biết rõ', 'rõ ràng', 'ràng buộc',
  'sữa ngựa', 'ngựa chạy', 'chạy tẩu', 'tẩu thoát', 'thoát thân', 'thân xác', 'xác nhận', 'nhận biết',
  'đỏ mặt', 'mặt cười', 'cười vui', 'vui lây', 'lây lan', 'lan tỏa', 'tỏa sáng', 'sáng tỏ',
  'bạc hà', 'hà tiện', 'tiện lợi', 'lợi thế', 'thế nào', 'nào nào', 'nào cũng', 'cũng được',
  'tường tận', 'tận tụy', 'tụy hoại', 'hoại rã', 'rã rời', 'rời xa', 'xa lánh', 'lánh mặt',
  'đương nhiên', 'nhiên cháy', 'cháy bỏng', 'bỏng nóng', 'nóng cháy', 'cháy rụi', 'rụi nát',
];

const activeGames = new Map(); // channelId -> gameData

function getRandomPhrase() {
  return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
}

// Lấy tiếng cuối cùng của cụm từ
function getLastSyllable(phrase) {
  const words = phrase.trim().split(/\s+/);
  if (words.length === 0) return '';
  const lastWord = words[words.length - 1];
  // Tách tiếng từ từ cuối cùng
  const syllables = lastWord.split(/[-,]/);
  return syllables[syllables.length - 1].toLowerCase();
}

// Lấy tiếng đầu tiên của cụm từ
function getFirstSyllable(phrase) {
  const words = phrase.trim().split(/\s+/);
  if (words.length === 0) return '';
  const firstWord = words[0];
  // Tách tiếng từ từ đầu tiên
  const syllables = firstWord.split(/[-,]/);
  return syllables[0].toLowerCase();
}

async function startNoituGame(client, message, store) {
  const channelId = message.channelId;

  // Kiểm tra xem đã có game đang chạy không
  if (activeGames.has(channelId)) {
    return message.reply('⚠️ Đã có game nối tiếng đang chạy trong kênh này! Chờ đến khi kết thúc.');
  }

  const firstPhrase = getRandomPhrase();
  const gameData = {
    currentPhrase: firstPhrase,
    usedPhrases: new Set([firstPhrase.toLowerCase()]),
    players: new Map(), // userId -> { name, points }
    isActive: true,
    startTime: Date.now(),
    lastWordTime: Date.now(),
    playerOrder: [],
    currentPlayerIndex: 0
  };

  activeGames.set(channelId, gameData);

  const startSyllable = getLastSyllable(firstPhrase);
  const startEmbed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('🎮 GAME NỐI TIẾNG - BẮT ĐẦU')
    .setDescription(`**Cụm từ đầu tiên:** \`${firstPhrase}\`\n\nNguười chơi hãy nối cụm từ tiếp theo (tiếng đầu = tiếng cuối của cụm từ trước)\n\n⏱️ Luật chơi:\n• Mỗi người có **10-15 giây** để suy nghĩ\n• Không được dùng lại từ đã nói\n• Từ phải là từ có nghĩa trong Tiếng Việt\n• Nối sai hoặc hết thời gian → Thua`)
    .setFooter({ text: `Hãy gõ cụm từ bắt đầu bằng: ${startSyllable}` })
    .setTimestamp();

  await message.reply({ embeds: [startEmbed] });

  // Tự động kết thúc game sau 10 phút nếu không ai chơi
  const gameTimeout = setTimeout(async () => {
    if (activeGames.has(channelId) && gameData.isActive) {
      gameData.isActive = false;
      endNoituGame(client, message, store, channelId, gameData, 'timeout');
    }
  }, 10 * 60 * 1000);

  gameData.timeout = gameTimeout;
  return gameData;
}

async function handleNoituMessage(client, message, store, content) {
  const channelId = message.channelId;
  if (!activeGames.has(channelId)) return false;

  const gameData = activeGames.get(channelId);
  if (!gameData.isActive) return false;

  const userId = message.author.id;
  const username = message.author.username;
  const phrase = content.trim();

  // Bỏ qua tin nhắn quá ngắn
  if (phrase.length < 2) return false;

  // Kiểm tra tiếng đầu có khớp không
  const expectedSyllable = getLastSyllable(gameData.currentPhrase);
  const playerSyllable = getFirstSyllable(phrase);

  if (playerSyllable !== expectedSyllable) {
    // Thêm reaction ❌
    try {
      await message.react('❌');
    } catch (e) { /* Bỏ qua */ }

    await message.reply(`❌ Sai rồi! Cụm từ phải bắt đầu bằng tiếng: \`${expectedSyllable}\``);
    gameData.isActive = false;
    clearTimeout(gameData.timeout);
    endNoituGame(client, message, store, channelId, gameData, 'wrong');
    return true;
  }

  // Kiểm tra từ đã dùng chưa
  if (gameData.usedPhrases.has(phrase.toLowerCase())) {
    // Thêm reaction ❌
    try {
      await message.react('❌');
    } catch (e) { /* Bỏ qua */ }

    await message.reply(`❌ Cụm từ \`${phrase}\` đã được dùng rồi!`);
    gameData.isActive = false;
    clearTimeout(gameData.timeout);
    endNoituGame(client, message, store, channelId, gameData, 'duplicate');
    return true;
  }

  // Cụm từ hợp lệ - thêm reaction ✅
  try {
    await message.react('✅');
  } catch (e) { /* Bỏ qua */ }

  gameData.currentPhrase = phrase;
  gameData.usedPhrases.add(phrase.toLowerCase());
  gameData.lastWordTime = Date.now();

  // Cộng điểm cho người chơi
  if (!gameData.players.has(userId)) {
    gameData.players.set(userId, { name: username, points: 0 });
  }
  const randomReward = Math.floor(Math.random() * 2501) + 500; // 500-3000
  gameData.players.get(userId).points += randomReward;
  store.addTungXu(userId, randomReward);

  // Cộng vào lượng tin game
  const dData = store.getDailyData(userId);
  if (!dData.claimedGame) {
    dData.games += 1;
  }

  const nextSyllable = getLastSyllable(phrase);
  const responseEmbed = new EmbedBuilder()
    .setColor('#4CAF50')
    .setTitle('✅ Cụm Từ Hợp Lệ')
    .setDescription(`**${username}** nối: \`${phrase}\`\n💰 +${randomReward.toLocaleString()} Mcoin`)
    .setFooter({ text: `Tiếp theo phải bắt đầu bằng tiếng: ${nextSyllable}` })
    .setTimestamp();

  await message.reply({ embeds: [responseEmbed] });

  // Reset timeout - 15 giây chờ người tiếp theo
  clearTimeout(gameData.timeout);
  gameData.timeout = setTimeout(async () => {
    if (activeGames.has(channelId) && gameData.isActive) {
      gameData.isActive = false;
      endNoituGame(client, message, store, channelId, gameData, 'timeout');
    }
  }, 15 * 1000); // 15 giây

  return true;
}

async function endNoituGame(client, message, store, channelId, gameData, reason) {
  activeGames.delete(channelId);

  if (gameData.players.size === 0) {
    return message.channel.send('❌ Game kết thúc: Không ai chơi.');
  }

  // Tìm người thắng (điểm cao nhất)
  let winner = null;
  let maxPoints = 0;
  for (const [userId, data] of gameData.players) {
    if (data.points > maxPoints) {
      maxPoints = data.points;
      winner = { userId, ...data };
    }
  }

  if (!winner) {
    return message.channel.send('❌ Game kết thúc: Lỗi xác định người thắng.');
  }

  // Thưởng 50,000 cho người thắng
  const bonusReward = 50000;
  store.addTungXu(winner.userId, bonusReward);

  const reasonText = {
    'timeout': '⏱️ Hết thời gian',
    'wrong': '❌ Người chơi nối sai tiếng',
    'duplicate': '🔄 Người chơi nối từ trùng'
  }[reason] || 'Game kết thúc';

  const leaderboard = Array.from(gameData.players.entries())
    .sort((a, b) => b[1].points - a[1].points)
    .slice(0, 5)
    .map((entry, idx) => {
      const [userId, data] = entry;
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
      return `${medal} **${data.name}** - ${data.points.toLocaleString()} Mcoin`;
    })
    .join('\n');

  const endEmbed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🏆 KẾT THÚC GAME NỐI TIẾNG')
    .setDescription(`**Lý do kết thúc:** ${reasonText}\n\n**Cụm từ cuối cùng:** \`${gameData.currentPhrase}\`\n**Tổng cụm từ nối:** ${gameData.usedPhrases.size}`)
    .addFields(
      { name: '🥇 Người Thắng', value: `<@${winner.userId}> **${winner.name}**`, inline: false },
      { name: '🎁 Phần Thưởng', value: `💰 ${bonusReward.toLocaleString()} Mcoin + 💰 ${winner.points.toLocaleString()} Mcoin từ cụm từ nối`, inline: false },
      { name: '📊 Bảng Xếp Hạng', value: leaderboard || 'Không có', inline: false }
    )
    .setTimestamp();

  await message.channel.send({ embeds: [endEmbed] });
}

module.exports = { startNoituGame, handleNoituMessage, activeGames };
