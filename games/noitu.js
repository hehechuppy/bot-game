// games/noitu.js - Game Nối Tiếng (Word Chaining)
const { EmbedBuilder } = require('discord.js');

const WORD_LIST = [
  'mùa xuân', 'xuân thì', 'thì thầm', 'thầm lặng', 'lặng yên', 'yên tĩnh', 'tĩnh mơ', 'mơ mộng',
  'ngày hôm', 'hôm nay', 'nay mai', 'mai kia', 'kia quá', 'quá khứ', 'khứ vang', 'vang bóng',
  'sáng sớm', 'sớm mai', 'mai sau', 'sau này', 'này đó', 'đó thôi', 'thôi được', 'được rồi',
  'tối nay', 'nay mai', 'mai rồi', 'rồi thôi', 'thôi thôi', 'thôi được', 'được không', 'không được',
  'chuyên cần', 'cần mẫn', 'mẫn tiệp', 'tiệp tục', 'tục lệ', 'lệ độ', 'độ khó', 'khó khăn',
  'dáng dấp', 'dấp dểu', 'dểu dàng', 'dàng hoàng', 'hoàng hôn', 'hôn thân', 'thân yêu', 'yêu quý',
  'chùm chỉ', 'chỉ tay', 'tay chân', 'chân chạy', 'chạy nhanh', 'nhanh chóng', 'chóng mặt', 'mặt mũi',
  'bình tĩnh', 'tĩnh lặng', 'lặng im', 'im lặng', 'lặng thầm', 'thầm thì', 'thầm kín',
  'cơm cháy', 'cháy nóng', 'nóng lạnh', 'lạnh buốt', 'buốt giá', 'giá rét', 'rét mướn', 'mướn tẽn',
  'nước mắt', 'mắt nhìn', 'nhìn thấy', 'thấy được', 'được biết', 'biết rõ', 'rõ ràng', 'ràng buộc',
  'sữa ngựa', 'ngựa chạy', 'chạy tẩu', 'tẩu thoát', 'thoát thân', 'thân xác', 'xác nhận', 'nhận biết',
  'đỏ mặt', 'mặt cười', 'cười vui', 'vui lây', 'lây lan', 'lan tỏa', 'tỏa sáng', 'sáng tỏ',
  'bạc hà', 'hà tiện', 'tiện lợi', 'lợi thế', 'thế nào', 'nào nào', 'nào cũng', 'cũng được',
  'tường tận', 'tận tụy', 'tụy hoại', 'hoại rã', 'rã rời', 'rời xa', 'xa lánh', 'lánh mặt',
  'đương nhiên', 'nhiên cháy', 'cháy bỏng', 'bỏng nóng', 'nóng cháy', 'cháy rụi', 'rụi nát',
];

const activeGames = new Map(); // channelId -> gameData

function normalizeWord(str) {
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '') 
    .replace(/\s+/g, ' ')            
    .trim();
}

function getRandomPhrase() {
  return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
}

function getLastSyllable(phrase) {
  const cleanPhrase = normalizeWord(phrase);
  const words = cleanPhrase.split(/\s+/);
  if (words.length === 0) return '';
  return words[words.length - 1];
}

function getFirstSyllable(phrase) {
  const cleanPhrase = normalizeWord(phrase);
  const words = cleanPhrase.split(/\s+/);
  if (words.length === 0) return '';
  return words[0];
}

async function startNoituGame(client, message, store) {
  const channelId = message.channelId;

  if (activeGames.has(channelId)) {
    return message.reply('⚠️ Đã có game nối tiếng đang chạy trong kênh này!');
  }

  const firstPhrase = getRandomPhrase();
  const normalizedFirst = normalizeWord(firstPhrase);

  const gameData = {
    currentPhrase: firstPhrase,
    usedPhrases: new Set([normalizedFirst]),
    players: new Map(),
    lastPlayerId: null, // Lưu ID người vừa trả lời đúng gần nhất
    isActive: true,
    startTime: Date.now()
  };

  activeGames.set(channelId, gameData);

  const startSyllable = getLastSyllable(firstPhrase);
  const startEmbed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('🎮 GAME NỐI TIẾNG - BẮT ĐẦU')
    .setDescription(`**Cụm từ đầu tiên:** \`${firstPhrase}\`\n\nLuật chơi:\n• Mỗi lượt có **15 giây** để trả lời\n• **Không thể trả lời 2 lần liên tiếp** (phải chờ người khác)\n• **Không dùng từ điệp** (VD: kín kín, định định)\n• Sai từ chỉ bị nhắc nhở, game chỉ dừng khi **hết 15 giây** không ai nối tiếp!`)
    .setFooter({ text: `Hãy gõ cụm từ bắt đầu bằng: ${startSyllable}` })
    .setTimestamp();

  await message.reply({ embeds: [startEmbed] });

  // Set timeout chờ người nối từ đầu tiên
  gameData.timeout = setTimeout(async () => {
    if (activeGames.has(channelId) && gameData.isActive) {
      gameData.isActive = false;
      endNoituGame(client, message, store, channelId, gameData);
    }
  }, 15 * 1000);

  return gameData;
}

async function handleNoituMessage(client, message, store, content) {
  const channelId = message.channelId;
  if (!activeGames.has(channelId)) return false;

  const gameData = activeGames.get(channelId);
  if (!gameData.isActive) return false;

  const userId = message.author.id;
  const username = message.author.username;
  const rawPhrase = content.trim();
  const normalizedInput = normalizeWord(rawPhrase);

  if (normalizedInput.length < 2) return false;

  // 1. KIỂM TRA LƯỢT CHƠI (Không cho 1 người nối 2 lần liên tiếp)
  if (gameData.lastPlayerId === userId) {
    try { await message.react('⚠️'); } catch (e) {}
    await message.reply(`⚠️ **${username}**, bạn vừa nối rồi! Hãy chờ người khác trả lời tiếp.`);
    return true; // Không dừng game
  }

  // 2. KIỂM TRA TỪ ĐIỆP (2 tiếng lặp lại)
  const words = normalizedInput.split(/\s+/);
  if (words.length >= 2 && words[0] === words[1]) {
    try { await message.react('❌'); } catch (e) {}
    await message.reply(`❌ Không được dùng từ lặp tiếng như \`${normalizedInput}\`! Thử từ khác nhé.`);
    return true; // Cảnh báo, giữ game chạy
  }

  // 3. KIỂM TRA TIẾNG ĐẦU KHỚP VỚI TIẾNG CUỐI
  const expectedSyllable = getLastSyllable(gameData.currentPhrase);
  const playerSyllable = getFirstSyllable(normalizedInput);

  if (playerSyllable !== expectedSyllable) {
    try { await message.react('❌'); } catch (e) {}
    await message.reply(`❌ Sai rồi! Cụm từ phải bắt đầu bằng tiếng: \`${expectedSyllable}\``);
    return true; // Cảnh báo, giữ game chạy
  }

  // 4. KIỂM TRA TỪ ĐÃ ĐƯỢC DÙNG CHƯA
  if (gameData.usedPhrases.has(normalizedInput)) {
    try { await message.react('❌'); } catch (e) {}
    await message.reply(`❌ Cụm từ \`${normalizedInput}\` đã được sử dụng rồi!`);
    return true; // Cảnh báo, giữ game chạy
  }

  // ================= CỤM TỪ HỢP LỆ =================
  try { await message.react('✅'); } catch (e) {}

  gameData.currentPhrase = normalizedInput;
  gameData.usedPhrases.add(normalizedInput);
  gameData.lastPlayerId = userId; // Ghi nhận người vừa trả lời đúng

  if (!gameData.players.has(userId)) {
    gameData.players.set(userId, { name: username, points: 0 });
  }
  const randomReward = Math.floor(Math.random() * 2501) + 500;
  gameData.players.get(userId).points += randomReward;
  store.addTungXu(userId, randomReward);

  const dData = store.getDailyData(userId);
  if (!dData.claimedGame) {
    dData.games += 1;
  }

  const nextSyllable = getLastSyllable(normalizedInput);
  const responseEmbed = new EmbedBuilder()
    .setColor('#4CAF50')
    .setTitle('✅ Cụm Từ Hợp Lệ')
    .setDescription(`**${username}** nối: \`${normalizedInput}\`\n💰 +${randomReward.toLocaleString()} Mcoin`)
    .setFooter({ text: `Tiếp theo phải bắt đầu bằng tiếng: ${nextSyllable}` })
    .setTimestamp();

  await message.reply({ embeds: [responseEmbed] });

  // Reset đếm ngược 15 giây cho lượt tiếp theo
  clearTimeout(gameData.timeout);
  gameData.timeout = setTimeout(async () => {
    if (activeGames.has(channelId) && gameData.isActive) {
      gameData.isActive = false;
      endNoituGame(client, message, store, channelId, gameData);
    }
  }, 15 * 1000);

  return true;
}

async function endNoituGame(client, message, store, channelId, gameData) {
  activeGames.delete(channelId);

  if (gameData.players.size === 0) {
    return message.channel.send('⏱️ **Hết thời gian!** Game kết thúc do không có ai tham gia.');
  }

  let winner = null;
  let maxPoints = 0;
  for (const [userId, data] of gameData.players) {
    if (data.points > maxPoints) {
      maxPoints = data.points;
      winner = { userId, ...data };
    }
  }

  if (!winner) {
    return message.channel.send('⏱️ **Hết thời gian!** Game kết thúc.');
  }

  const bonusReward = 50000;
  store.addTungXu(winner.userId, bonusReward);

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
    .setDescription(`⏱️ **Hết 15 giây mà không có ai nối tiếp!**\n\n**Cụm từ cuối:** \`${gameData.currentPhrase}\`\n**Tổng số từ đã nối:** ${gameData.usedPhrases.size - 1}`)
    .addFields(
      { name: '🥇 Người Thắng Cuộc', value: `<@${winner.userId}> **${winner.name}**`, inline: false },
      { name: '🎁 Phần Thưởng Quán Quân', value: `💰 ${bonusReward.toLocaleString()} Mcoin + 💰 ${winner.points.toLocaleString()} Mcoin tích lũy`, inline: false },
      { name: '📊 Bảng Xếp Hạng', value: leaderboard || 'Không có', inline: false }
    )
    .setTimestamp();

  await message.channel.send({ embeds: [endEmbed] });
}

module.exports = { startNoituGame, handleNoituMessage, activeGames };
