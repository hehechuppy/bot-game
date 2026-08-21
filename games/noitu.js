// games/noitu.js - Game Nối Từ (Word Chain)
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Danh sách từ Tiếng Việt để chơi
const WORD_LIST = [
  'an', 'áp', 'ác', 'áo', 'ăn', 'âu', 'âm', 'âu',
  'ba', 'bàn', 'bán', 'bàng', 'băng', 'bắp', 'bát', 'bắt', 'bây', 'bên', 'bê', 'bít', 'bò', 'bộ', 'bỏ', 'bợn', 'bơi', 'bơm', 'bớt', 'bụ', 'bụi', 'bừa', 'bừng', 'búa', 'búi', 'bủi', 'bủn', 'bụn', 'bụp',
  'ca', 'cà', 'cả', 'cái', 'cam', 'can', 'canh', 'cáp', 'cạo', 'cặp', 'cát', 'cày', 'cắm', 'cắn', 'cắp', 'cắt', 'cây', 'cơ', 'cơm', 'cơn', 'cơ', 'cơ', 'co', 'cò', 'cóc', 'cóc', 'cóc', 'còi', 'cỏ', 'côi', 'còn', 'cốc', 'cốn', 'cốp', 'cột', 'cộc', 'công', 'côn', 'cốt', 'cỏ', 'cớ', 'cờ', 'cỡ', 'cơ', 'cối', 'cộng', 'cỏ',
  'da', 'dã', 'dạ', 'dạc', 'dại', 'dắc', 'dắm', 'dắn', 'dập', 'dắt', 'dây', 'danh', 'dâu', 'dâm', 'dâng', 'dâu', 'dâu', 'dè', 'để', 'đằng', 'dễ', 'dế', 'dệm', 'dế', 'dệu', 'dì', 'di', 'dí', 'dia', 'dích', 'diêm', 'diên', 'diếp', 'diều', 'diệp', 'diệu', 'do', 'đó', 'dò', 'dỏ', 'dộ', 'đom', 'đon', 'dỏng', 'dốc', 'dỏi', 'dỏi', 'dỏm', 'dột', 'dộng', 'dợc', 'dợi', 'dợng', 'du', 'dũ', 'dỏ', 'dua', 'dục', 'dục', 'dủi', 'dụi', 'dụm', 'dụn', 'dụng', 'dụp', 'dụt', 'duy', 'duyên', 'duyết', 'duyệt', 'dữ', 'dữa', 'dữm', 'dữt',
  'ế', 'êm', 'ên',
  'ga', 'gà', 'gã', 'gái', 'gạch', 'gạn', 'gạo', 'gạt', 'gây', 'gân', 'gân', 'gần', 'gặp', 'gặt', 'gầm', 'gầu', 'gầu', 'gây', 'ge', 'gê', 'ghen', 'ghi', 'ghích', 'ghìm', 'ghì', 'ghìn', 'ghìp', 'ghị', 'ghiền', 'ghim', 'ghì', 'ghì', 'ghiền', 'ghiệp', 'ghiệu', 'ghó', 'ghoả', 'ghọc', 'ghoè', 'ghom', 'ghom', 'ghón', 'ghop', 'ghót', 'ghu', 'ghù', 'ghua', 'ghủa', 'ghúc', 'ghuế', 'ghui', 'ghùi', 'ghúi', 'ghủi', 'ghuim', 'ghùim', 'ghúi', 'ghúi', 'ghuim', 'ghum', 'ghùm', 'ghumng', 'ghúng', 'ghùng', 'ghúng', 'ghun', 'ghùn', 'ghúp', 'ghùt', 'ghút', 'ghưa', 'ghương', 'ghương', 'ghượng', 'ghước', 'ghữ', 'gì', 'gia', 'giá', 'gia', 'giai', 'gianh', 'giáp', 'giát', 'giàn', 'giàng', 'giàng', 'giành', 'giập', 'giặc', 'giặng', 'giặt', 'giậu', 'giậu', 'giây', 'giảng', 'giảm', 'giản', 'giập', 'giặc', 'giặn', 'giặp', 'giặt', 'giặu', 'giậu', 'giậy', 'giề', 'giề', 'giết', 'giết', 'giễn', 'giễu', 'giệng', 'giệp', 'giệu', 'giết', 'giệu', 'giệu', 'giệu', 'giệu', 'giệu',
  'ha', 'há', 'hà', 'hả', 'hã', 'hài', 'hạc', 'hạch', 'hạ', 'hạh', 'hạm', 'hạn', 'hạnh', 'hạo', 'hạp', 'hạt', 'hạu', 'hạy', 'hây', 'hăm', 'hăn', 'hăng', 'hăng', 'hăp', 'hăp', 'hăng', 'hắc', 'hắm', 'hắn', 'hắng', 'hắp', 'hắt', 'hắu', 'hắy', 'hây', 'hâm', 'hâm', 'hân', 'hâm', 'hâm', 'hâm', 'hâm', 'hâm', 'hâm', 'hâm', 'hâm', 'hâm', 'hâm', 'hâm', 'hâu', 'hâu', 'hâu', 'hâu', 'hâu', 'hâu', 'hâu', 'hâu', 'hâu', 'hâu', 'hâu', 'hâu',
  'khác', 'khai', 'kham', 'khan', 'khanh', 'khao', 'khap', 'khat', 'khau', 'khay', 'khảng', 'khảm', 'khản', 'khặc', 'khặn', 'khặp', 'khặt', 'khặu', 'khậu', 'khẩu', 'khẩu', 'khẩu',
  'lã', 'là', 'lả', 'lái', 'lam', 'lan', 'lanh', 'lao', 'lap', 'lat', 'lau', 'lau', 'lau', 'lay', 'lây', 'lăm', 'lăn', 'lăng', 'lăp', 'lăt', 'lắc', 'lắm', 'lắn', 'lắp', 'lắt', 'lắu', 'lắy', 'lây', 'lâm', 'lân', 'lâng', 'lâu', 'lậm', 'lận', 'lập', 'lậu', 'lậy', 'lề', 'lên', 'lết', 'lêu', 'lệ', 'lệ', 'lệ', 'lệ', 'lệ', 'lệ',
  'mà', 'má', 'mả', 'mặc', 'mai', 'mam', 'man', 'manh', 'mao', 'map', 'mat', 'mau', 'may', 'mây', 'măm', 'măn', 'măng', 'măp', 'măt', 'mắc', 'mắm', 'mắn', 'mắp', 'mắt', 'mắu', 'mắy', 'mây', 'mâm', 'mân', 'mâu', 'mậm', 'mận', 'mập', 'mậu', 'mậy', 'mê', 'mét', 'mêu', 'mệ', 'mệ', 'mệu',
  'na', 'ná', 'nà', 'nả', 'nại', 'nam', 'nan', 'nanh', 'nao', 'nap', 'nat', 'nau', 'nay', 'nây', 'năm', 'năn', 'năng', 'năp', 'năp', 'năt', 'nắc', 'nắm', 'nắn', 'nắp', 'nắt', 'nắu', 'nắy', 'nây', 'nâm', 'nân', 'nâng', 'nâu', 'nậm', 'nận', 'nập', 'nậu', 'nậy', 'nề', 'nên', 'nết', 'nêu', 'nê', 'nê', 'nê',
  'oa', 'oà', 'oả', 'oai', 'oam', 'oan', 'oanh', 'oao', 'oap', 'oat', 'oau', 'oay', 'oâm', 'oân', 'oâu',
  'pa', 'pà', 'pả', 'pái', 'pam', 'pan', 'panh', 'pao', 'pap', 'pat', 'pau', 'pay', 'pây', 'păm', 'păn', 'păng', 'păp', 'păt', 'pắc', 'pắm', 'pắn', 'pắp', 'pắt', 'pắu', 'pắy', 'pây', 'pâm', 'pân', 'pâng', 'pâu', 'pậm', 'pận', 'pập', 'pậu', 'pậy', 'pê', 'pên', 'pét', 'pêu', 'pề', 'pề', 'pề',
  'qua', 'quả', 'quai', 'quam', 'quan', 'quanh', 'quao', 'quap', 'quat', 'quau', 'quay', 'quây', 'quăm', 'quăn', 'quăng', 'quăp', 'quăt', 'quắc', 'quắm', 'quắn', 'quắp', 'quắt', 'quắu', 'quắy', 'quây', 'quâm', 'quân', 'quâng', 'quâu', 'quậm', 'quận', 'quập', 'quậu', 'quậy',
  'ra', 'rà', 'rả', 'rại', 'ram', 'ran', 'ranh', 'rao', 'rap', 'rat', 'rau', 'ray', 'rây', 'răm', 'răn', 'răng', 'răp', 'răt', 'rắc', 'rắm', 'rắn', 'rắp', 'rắt', 'rắu', 'rắy', 'rây', 'râm', 'rân', 'râng', 'râu', 'rậm', 'rận', 'rập', 'rậu', 'rậy', 're', 'rè', 'rén', 'rét', 'rêu', 'rề', 'rề', 'rề',
  'sa', 'sà', 'sả', 'sái', 'sam', 'san', 'sanh', 'sao', 'sap', 'sat', 'sau', 'say', 'sây', 'săm', 'săn', 'săng', 'săp', 'săt', 'sắc', 'sắm', 'sắn', 'sắp', 'sắt', 'sắu', 'sắy', 'sây', 'sâm', 'sân', 'sâng', 'sâu', 'sậm', 'sận', 'sập', 'sậu', 'sậy', 'sề', 'sên', 'sét', 'sêu', 'sề', 'sề', 'sề',
  'ta', 'tà', 'tả', 'tại', 'tam', 'tan', 'tanh', 'tao', 'tap', 'tat', 'tau', 'tay', 'tây', 'tăm', 'tăn', 'tăng', 'tăp', 'tăt', 'tắc', 'tắm', 'tắn', 'tắp', 'tắt', 'tắu', 'tắy', 'tây', 'tâm', 'tân', 'tâng', 'tâu', 'tậm', 'tận', 'tập', 'tậu', 'tậy', 'tề', 'tên', 'tét', 'têu', 'tề', 'tề', 'tề',
  'ưa', 'ưỡ', 'ưỡng', 'ước', 'ươi', 'ương', 'ượng', 'ựu',
  'va', 'và', 'vả', 'vai', 'vam', 'van', 'vanh', 'vao', 'vap', 'vat', 'vau', 'vay', 'vây', 'văm', 'văn', 'văng', 'văp', 'văt', 'vắc', 'vắm', 'vắn', 'vắp', 'vắt', 'vắu', 'vắy', 'vây', 'vâm', 'vân', 'vâng', 'vâu', 'vậm', 'vận', 'vập', 'vậu', 'vậy', 've', 'vè', 'vén', 'vét', 'vêu', 'về', 'về', 'về',
  'xa', 'xà', 'xả', 'xái', 'xam', 'xan', 'xanh', 'xao', 'xap', 'xat', 'xau', 'xay', 'xây', 'xăm', 'xăn', 'xăng', 'xăp', 'xăt', 'xắc', 'xắm', 'xắn', 'xắp', 'xắt', 'xắu', 'xắy', 'xây', 'xâm', 'xân', 'xâng', 'xâu', 'xậm', 'xận', 'xập', 'xậu', 'xậy', 'xé', 'xen', 'xét', 'xêu', 'xề', 'xề', 'xề',
  'ya', 'yên', 'yết', 'yêu',
  'zing', 'zit'
];

const activeGames = new Map(); // channelId -> gameData

function getRandomWord() {
  return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
}

// Lấy từ cuối cùng của một chuỗi từ (tách bằng dấu cách)
function getLastWord(phrase) {
  const words = phrase.trim().split(/\s+/);
  return words[words.length - 1].toLowerCase();
}

// Lấy từ đầu tiên của một chuỗi từ
function getFirstWord(phrase) {
  const words = phrase.trim().split(/\s+/);
  return words[0].toLowerCase();
}

async function startNoituGame(client, message, store) {
  const channelId = message.channelId;

  // Kiểm tra xem đã có game đang chạy không
  if (activeGames.has(channelId)) {
    return message.reply('⚠️ Đã có game nối từ đang chạy trong kênh này! Chờ đến khi kết thúc.');
  }

  const firstWord = getRandomWord();
  const gameData = {
    currentWord: firstWord,
    usedWords: new Set([firstWord]),
    players: new Map(), // userId -> { name, points }
    isActive: true,
    startTime: Date.now(),
    messageCount: 0,
    lastWordTime: Date.now()
  };

  activeGames.set(channelId, gameData);

  const startEmbed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('🎮 GAME NỐI TỪ - BẮT ĐẦU')
    .setDescription(`**Từ đầu tiên:** \`${firstWord}\`\n\nNguười chơi hãy nối từ tiếp theo (từ đầu = từ cuối của từ trước)\n\n⏱️ Game sẽ kết thúc nếu:\n• Không ai nối được trong 30 giây\n• Ai nối sai (từ đầu không khớp)\n• Ai nối từ đã dùng`)
    .setFooter({ text: `Hãy gõ từ bắt đầu bằng: ${firstWord} | Gõ từ của bạn trong chat!` })
    .setTimestamp();

  await message.reply({ embeds: [startEmbed] });

  // Tự động kết thúc game sau 5 phút nếu không ai chơi
  const gameTimeout = setTimeout(async () => {
    if (activeGames.has(channelId) && gameData.isActive) {
      gameData.isActive = false;
      endNoituGame(client, message, store, channelId, gameData, 'timeout');
    }
  }, 5 * 60 * 1000); // 5 phút

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
  const word = content.trim().toLowerCase();

  // Kiểm tra từ hợp lệ (chỉ chữ cái)
  if (!/^[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+$/.test(word)) {
    return false; // Bỏ qua tin nhắn không phải từ
  }

  // Kiểm tra từ đầu có khớp với từ cuối của từ trước không
  const expectedWord = getLastWord(gameData.currentWord);
  const playerWord = getFirstWord(word);
  
  if (playerWord !== expectedWord) {
    // Thêm reaction ❌ vào tin nhắn người chơi
    try {
      await message.react('❌');
    } catch (e) { /* Bỏ qua nếu lỗi */ }
    
    await message.reply(`❌ Sai rồi! Từ của bạn phải bắt đầu bằng \`${expectedWord}\``);
    gameData.isActive = false;
    clearTimeout(gameData.timeout);
    endNoituGame(client, message, store, channelId, gameData, 'wrong');
    return true;
  }

  // Kiểm tra từ đã dùng chưa
  if (gameData.usedWords.has(word)) {
    // Thêm reaction ❌ vào tin nhắn người chơi
    try {
      await message.react('❌');
    } catch (e) { /* Bỏ qua nếu lỗi */ }
    
    await message.reply(`❌ Từ \`${word}\` đã được dùng rồi!`);
    gameData.isActive = false;
    clearTimeout(gameData.timeout);
    endNoituGame(client, message, store, channelId, gameData, 'duplicate');
    return true;
  }

  // Từ hợp lệ - thêm reaction ✅
  try {
    await message.react('✅');
  } catch (e) { /* Bỏ qua nếu lỗi */ }
  
  gameData.currentWord = word;
  gameData.usedWords.add(word);
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

  const nextWord = getLastWord(word);
  const responseEmbed = new EmbedBuilder()
    .setColor('#4CAF50')
    .setTitle('✅ Từ Hợp Lệ')
    .setDescription(`**${username}** nối: \`${word}\`\n💰 +${randomReward.toLocaleString()} Mcoin`)
    .setFooter({ text: `Từ tiếp theo phải bắt đầu bằng: ${nextWord}` })
    .setTimestamp();

  await message.reply({ embeds: [responseEmbed] });

  // Check timeout - nếu không ai nối trong 30 giây
  clearTimeout(gameData.timeout);
  gameData.timeout = setTimeout(async () => {
    if (activeGames.has(channelId) && gameData.isActive) {
      gameData.isActive = false;
      endNoituGame(client, message, store, channelId, gameData, 'timeout');
    }
  }, 30 * 1000); // 30 giây

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
    'wrong': '❌ Người chơi sai từ',
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
    .setTitle('🏆 KẾT THÚC GAME NỐI TỪ')
    .setDescription(`**Lý do kết thúc:** ${reasonText}\n\n**Từ cuối cùng:** \`${gameData.currentWord}\`\n**Từ cuối cần nối tiếp:** \`${getLastWord(gameData.currentWord)}\`\n**Tổng từ:** ${gameData.usedWords.size}`)
    .addFields(
      { name: '🥇 Người Thắng', value: `<@${winner.userId}> **${winner.name}**`, inline: false },
      { name: '🎁 Phần Thưởng', value: `💰 ${bonusReward.toLocaleString()} Mcoin + 💰 ${winner.points.toLocaleString()} Mcoin từ nối`, inline: false },
      { name: '📊 Bảng Xếp Hạng', value: leaderboard, inline: false }
    )
    .setTimestamp();

  await message.channel.send({ embeds: [endEmbed] });
}

module.exports = { startNoituGame, handleNoituMessage, activeGames };
