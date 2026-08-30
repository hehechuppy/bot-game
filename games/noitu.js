// games/noitu.js - Game Nối Tiếng
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const activeGames = new Map(); // channelId -> gameData

// Danh sách từ khởi đầu ngẫu nhiên (2 tiếng)
const START_WORDS = [
  'mùa xuân', 'hoa hồng', 'bầu trời', 'con người', 'tình yêu',
  'cuộc sống', 'học sinh', 'gia đình', 'bạn bè', 'trường học',
  'công việc', 'thành phố', 'quê hương', 'thiên nhiên', 'âm nhạc',
  'nghệ thuật', 'văn hóa', 'lịch sử', 'khoa học', 'công nghệ',
  'sức khỏe', 'thể thao', 'du lịch', 'ẩm thực', 'thời trang',
  'kinh tế', 'chính trị', 'xã hội', 'môi trường', 'giáo dục',
  'hạnh phúc', 'ước mơ', 'tương lai', 'kỷ niệm', 'cảm xúc'
];

function getRandomWord() {
  return START_WORDS[Math.floor(Math.random() * START_WORDS.length)];
}

// Lấy tiếng cuối của cụm từ
function getLastSyllable(phrase) {
  const words = phrase.trim().split(/\s+/);
  return words[words.length - 1].toLowerCase();
}

// Lấy tiếng đầu của cụm từ
function getFirstSyllable(phrase) {
  const words = phrase.trim().split(/\s+/);
  return words[0].toLowerCase();
}

async function startNoituGame(client, message, store) {
  const channelId = message.channelId;
  const guildId = message.guild.id;

  if (activeGames.has(channelId)) {
    return message.reply('⚠️ Đã có game nối tiếng đang chạy trong kênh này!');
  }

  const firstWord = getRandomWord();

  const gameData = {
    guildId,
    channelId,
    hostId: message.author.id,
    currentPhrase: firstWord,
    usedPhrases: new Set([firstWord.toLowerCase()]),
    players: new Map(), // userId -> { name, points }
    joinedUsers: new Set(), // userId đã tham gia
    isActive: false, // chưa bắt đầu - đang chờ người join
    timeout: null,
    startTime: null
  };

  activeGames.set(channelId, gameData);

  // ================= EMBED CHỜ NGƯỜI THAM GIA =================
  const waitEmbed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle('🎮 GAME NỐI TIẾNG - TÌM KIẾM NGƯỜI CHƠI')
    .setDescription(
      `👤 **Người tạo:** ${message.author.username}\n\n` +
      `📋 **Luật chơi:**\n` +
      `• Từ nối phải là **từ 2 tiếng có nghĩa** trong Tiếng Việt\n` +
      `• Mỗi lượt có **15 giây** để trả lời\n` +
      `• Không thể trả lời **2 lần liên tiếp**\n` +
      `• Không dùng từ điệp (VD: đình đình, kín kín)\n` +
      `• Nhập sai chỉ bị nhắc nhở, game dừng khi **hết 15 giây**!\n\n` +
      `👥 **Người đã tham gia (0):**\n*Chưa có ai*`
    )
    .setFooter({ text: 'Bấm nút bên dưới để tham gia game!' })
    .setTimestamp();

  const joinRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`noitu_join_${channelId}`)
      .setLabel('🙋 Tham Gia')
      .setStyle(ButtonStyle.Success)
  );

  const waitMsg = await message.reply({ embeds: [waitEmbed], components: [joinRow] });

  // ================= XỬ LÝ BUTTON THAM GIA =================
  const joinCollector = waitMsg.createMessageComponentCollector({ time: 30000 });

  joinCollector.on('collect', async (interaction) => {
    if (interaction.customId !== `noitu_join_${channelId}`) return;

    const userId = interaction.user.id;

    if (gameData.joinedUsers.has(userId)) {
      return interaction.reply({ content: '⚠️ Bạn đã tham gia rồi!', ephemeral: true });
    }

    gameData.joinedUsers.add(userId);

    const joinedList = Array.from(gameData.joinedUsers).map((uid, i) => {
      const name = interaction.guild.members.cache.get(uid)?.displayName || `User_${uid.slice(-4)}`;
      return `${i + 1}. ${name}`;
    }).join('\n');

    const updatedEmbed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('🎮 GAME NỐI TIẾNG - TÌM KIẾM NGƯỜI CHƠI')
      .setDescription(
        `👤 **Người tạo:** ${message.author.username}\n\n` +
        `📋 **Luật chơi:**\n` +
        `• Từ nối phải là **từ 2 tiếng có nghĩa** trong Tiếng Việt\n` +
        `• Mỗi lượt có **15 giây** để trả lời\n` +
        `• Không thể trả lời **2 lần liên tiếp**\n` +
        `• Không dùng từ điệp (VD: đình đình, kín kín)\n` +
        `• Nhập sai chỉ bị nhắc nhở, game dừng khi **hết 15 giây**!\n\n` +
        `👥 **Người đã tham gia (${gameData.joinedUsers.size}):**\n${joinedList}`
      )
      .setFooter({ text: 'Bấm nút bên dưới để tham gia game!' })
      .setTimestamp();

    await interaction.update({ embeds: [updatedEmbed], components: [joinRow] });
  });

  joinCollector.on('end', async () => {
    // Kiểm tra tối thiểu 2 người (bao gồm host)
    const totalPlayers = gameData.joinedUsers.size;

    if (totalPlayers < 2) {
      activeGames.delete(channelId);
      try {
        await waitMsg.edit({
          content: '❌ **Game hủy:** Không đủ người chơi (tối thiểu 2 người)!',
          embeds: [],
          components: []
        });
      } catch (e) {}
      return;
    }

    // Khởi tạo players map từ joinedUsers
    for (const uid of gameData.joinedUsers) {
      const member = message.guild.members.cache.get(uid);
      const name = member?.displayName || `User_${uid.slice(-4)}`;
      gameData.players.set(uid, { name, points: 0 });
    }

    // Bắt đầu game
    gameData.isActive = true;
    gameData.startTime = Date.now();
    gameData.lastUserId = null; // Người vừa nối từ cuối

    try {
      await waitMsg.edit({ embeds: [], components: [], content: '✅ Game đang bắt đầu...' });
    } catch (e) {}

    // Gửi embed bắt đầu game
    const startSyllable = getLastSyllable(firstWord);
    const startEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🎮 GAME NỐI TIẾNG - BẮT ĐẦU!')
      .setDescription(
        `**Cụm từ đầu tiên:** \`${firstWord}\`\n\n` +
        `Hãy nối cụm từ bắt đầu bằng tiếng: **"${startSyllable}"**\n\n` +
        `⏱️ Mỗi lượt có **15 giây** để trả lời\n` +
        `💰 Mỗi từ nối đúng nhận **500-3000 Mcoin**`
      )
      .setFooter({ text: `Gõ từ của bạn trong chat! Tiếp theo bắt đầu bằng: ${startSyllable}` })
      .setTimestamp();

    await message.channel.send({ embeds: [startEmbed] });

    // Bắt đầu timeout 15 giây
    startTurnTimeout(client, message.channel, store, channelId, gameData);
  });
}

function startTurnTimeout(client, channel, store, channelId, gameData) {
  if (gameData.timeout) clearTimeout(gameData.timeout);

  gameData.timeout = setTimeout(async () => {
    if (!activeGames.has(channelId)) return;
    if (!gameData.isActive) return;

    gameData.isActive = false;
    activeGames.delete(channelId);

    await endNoituGame(client, channel, store, channelId, gameData, 'timeout');
  }, 15000); // 15 giây
}

async function handleNoituMessage(client, message, store, content) {
  const channelId = message.channelId;
  if (!activeGames.has(channelId)) return false;

  const gameData = activeGames.get(channelId);
  if (!gameData.isActive) return false;

  const userId = message.author.id;
  const username = message.author.username;
  const guildId = gameData.guildId;

  // Chỉ người đã tham gia mới được nối
  if (!gameData.joinedUsers.has(userId)) return false;

  // Không thể nối 2 lần liên tiếp
  if (gameData.lastUserId === userId) {
    await message.react('❌');
    await message.reply('❌ Bạn vừa nối rồi! Hãy để người khác nối tiếp.');
    return true;
  }

  const phrase = content.trim().toLowerCase();

  // Phải có ít nhất 2 tiếng (1 dấu cách)
  if (!phrase.includes(' ') || phrase.split(/\s+/).length < 2) {
    return false; // Bỏ qua tin nhắn 1 tiếng
  }

  // Kiểm tra từ điệp (2 tiếng giống nhau)
  const phraseParts = phrase.split(/\s+/);
  if (phraseParts.length === 2 && phraseParts[0] === phraseParts[1]) {
    await message.react('❌');
    await message.reply(`❌ Không được dùng từ điệp! (${phraseParts[0]} ${phraseParts[1]})`);
    return true;
  }

  // Kiểm tra tiếng đầu có khớp với tiếng cuối của từ trước không
  const expectedSyllable = getLastSyllable(gameData.currentPhrase);
  const playerSyllable = getFirstSyllable(phrase);

  if (playerSyllable !== expectedSyllable) {
    await message.react('❌');
    await message.reply(`❌ Sai rồi! Tiếng đầu phải là **"${expectedSyllable}"** (bạn gõ: "${playerSyllable}")`);
    return true;
  }

  // Kiểm tra từ đã dùng chưa
  if (gameData.usedPhrases.has(phrase)) {
    await message.react('❌');
    await message.reply(`❌ Từ \`${phrase}\` đã được dùng rồi!`);
    return true;
  }

  // ================= TỪ HỢP LỆ =================
  try {
    await message.react('✅');
  } catch (e) {}

  gameData.currentPhrase = phrase;
  gameData.usedPhrases.add(phrase);
  gameData.lastUserId = userId;

  // Cộng điểm
  if (!gameData.players.has(userId)) {
    gameData.players.set(userId, { name: username, points: 0 });
  }

  const randomReward = Math.floor(Math.random() * 2501) + 500; // 500-3000
  gameData.players.get(userId).points += randomReward;
  store.addTungXu(guildId, userId, randomReward);

  // Cộng game count cho daily
  const dData = store.getDailyData(guildId, userId);
  if (dData && !dData.claimedGame) dData.games += 1;

  // Gửi embed xác nhận
  const nextSyllable = getLastSyllable(phrase);
  const responseEmbed = new EmbedBuilder()
    .setColor('#4CAF50')
    .setTitle('✅ Từ Hợp Lệ')
    .setDescription(
      `**${username}** nối: \`${phrase}\`\n` +
      `💰 +${randomReward.toLocaleString()} Mcoin\n\n` +
      `⏭️ Tiếp theo phải bắt đầu bằng tiếng: **"${nextSyllable}"**`
    )
    .setTimestamp();

  await message.reply({ embeds: [responseEmbed] });

  // Reset timeout 15 giây
  startTurnTimeout(client, message.channel, store, channelId, gameData);

  return true;
}

async function endNoituGame(client, channel, store, channelId, gameData, reason) {
  activeGames.delete(channelId);

  if (gameData.players.size === 0) {
    return channel.send('❌ Game kết thúc: Không ai nối từ.');
  }

  // Tìm người thắng (điểm cao nhất)
  let winner = null;
  let maxPoints = -1;
  for (const [uid, data] of gameData.players) {
    if (data.points > maxPoints) {
      maxPoints = data.points;
      winner = { userId: uid, ...data };
    }
  }

  const reasonText = reason === 'timeout' ? '⏱️ Hết thời gian 15 giây' : '❌ Lỗi game';

  // Thưởng thêm cho người thắng
  const bonusReward = 50000;
  if (winner) {
    store.addTungXu(gameData.guildId, winner.userId, bonusReward);
  }

  // Bảng xếp hạng
  const leaderboard = Array.from(gameData.players.entries())
    .sort((a, b) => b[1].points - a[1].points)
    .slice(0, 5)
    .map(([uid, data], idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
      return `${medal} **${data.name}** — ${data.points.toLocaleString()} Mcoin`;
    })
    .join('\n');

  const endEmbed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🏆 KẾT THÚC GAME NỐI TIẾNG')
    .setDescription(
      `**Lý do kết thúc:** ${reasonText}\n` +
      `**Từ cuối cùng:** \`${gameData.currentPhrase}\`\n` +
      `**Tổng từ đã nối:** ${gameData.usedPhrases.size}`
    )
    .addFields(
      {
        name: '🥇 Người Thắng',
        value: winner ? `**${winner.name}** (+${bonusReward.toLocaleString()} Mcoin thưởng)` : 'Không có',
        inline: false
      },
      {
        name: '📊 Bảng Xếp Hạng',
        value: leaderboard || 'Không có',
        inline: false
      }
    )
    .setTimestamp();

  await channel.send({ embeds: [endEmbed] });
}

module.exports = { startNoituGame, handleNoituMessage, activeGames };
