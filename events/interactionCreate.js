// events/interactionCreate.js
const { EmbedBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, ModalBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const store = require('../store');

function buildPlayerButtons(prefix, gameMsgId, gameData, targetIds) {
  const rows = [];
  let row = new ActionRowBuilder();
  let count = 0;
  for (const uid of targetIds.slice(0, 25)) {
    if (count === 5) { rows.push(row); row = new ActionRowBuilder(); count = 0; }
    const name = gameData.participants.get(uid) || 'Người chơi';
    row.addComponents(
      new ButtonBuilder().setCustomId(`${prefix}_${uid}_${gameMsgId}`).setLabel(name.slice(0, 80)).setStyle(ButtonStyle.Secondary)
    );
    count++;
  }
  if (count > 0) rows.push(row);
  return rows;
}

// Hàm an toàn để tránh lỗi 10062 (Unknown interaction)
// Discord chỉ cho 3 giây để reply, nếu quá hạn sẽ bị lỗi này
async function safeRespond(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err?.code === 10062 || err?.code === 40060) {
      console.warn(`⚠️ Bỏ qua lỗi interaction ${err.code} (đã hết hạn hoặc xử lý trước đó)`);
      return null;
    }
    throw err;
  }
}

module.exports = {
  name: 'interactionCreate',
  async execute(client, interaction) {
    try {
    // ================= AUTOCOMPLETE =================
    if (interaction.isAutocomplete()) {
      if (interaction.commandName === 'xoacode') {
        const focusedValue = interaction.options.getFocused();
        const allCodes = Array.from(store.customCodesMap.keys());
        
        const filtered = allCodes
          .filter(code => code.toLowerCase().includes(focusedValue.toLowerCase()))
          .slice(0, 25);
        
        const choices = filtered.map(code => ({
          name: `${code} (+${store.customCodesMap.get(code).reward.toLocaleString()} Mcoin)`,
          value: code
        }));
        
        return await safeRespond(() => interaction.respond(choices));
      }
      return;
    }

    // ================= SLASH COMMANDS =================
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (commandName === 'taocode') {
        if (!isAdmin) {
          return await safeRespond(() => interaction.reply({ content: '❌ Bạn không có quyền sử dụng lệnh tạo mã code này!', ephemeral: true }));
        }
        const codeName = interaction.options.getString('code').toLowerCase().trim();
        const rewardAmount = interaction.options.getInteger('reward');
        const durationMinutes = interaction.options.getInteger('duration');

        if (store.customCodesMap.has(codeName)) {
          return await safeRespond(() => interaction.reply({ content: `❌ Mã code \`${codeName}\` đã tồn tại!`, ephemeral: true }));
        }

        let expiresAt = null;
        if (durationMinutes && durationMinutes > 0) expiresAt = Date.now() + durationMinutes * 60 * 1000;
        store.customCodesMap.set(codeName, { reward: rewardAmount, expiresAt });

        const timeStr = expiresAt ? `<t:${Math.floor(expiresAt / 1000)}:R>` : 'Vĩnh viễn';
        const successEmbed = new EmbedBuilder()
          .setColor('#00FFCC')
          .setTitle('🎟️ TẠO MÃ CODE THÀNH CÔNG')
          .setDescription(`• Mã: \`${codeName}\`\n• Phần thưởng: **+${rewardAmount.toLocaleString()} Mcoin**\n• Thời hạn: **${timeStr}**`);

        return await safeRespond(() => interaction.reply({ embeds: [successEmbed] }));
      }

      if (commandName === 'xoacode') {
        if (!isAdmin) {
          return await safeRespond(() => interaction.reply({ 
            content: '❌ Bạn không có quyền sử dụng lệnh xóa code này!', 
            ephemeral: true 
          }));
        }
        
        const codeName = interaction.options.getString('code').toLowerCase().trim();
        
        if (!store.customCodesMap.has(codeName)) {
          return await safeRespond(() => interaction.reply({ 
            content: `❌ Mã code \`${codeName}\` không tồn tại!`, 
            ephemeral: true 
          }));
        }
        
        const deletedCode = store.customCodesMap.get(codeName);
        store.customCodesMap.delete(codeName);
        
        const successEmbed = new EmbedBuilder()
          .setColor('#FF4444')
          .setTitle('🗑️ ĐÃ XÓA MÃ CODE')
          .setDescription(
            `• Mã: \`${codeName}\`\n` +
            `• Phần thưởng cũ: **+${deletedCode.reward.toLocaleString()} Mcoin**\n` +
            `• Người xóa: ${interaction.user.username}`
          )
          .setTimestamp();
        
        return await safeRespond(() => interaction.reply({ embeds: [successEmbed] }));
      }

      if (commandName === 'setbackup') {
        if (!isAdmin) {
          return await safeRespond(() => interaction.reply({ content: '❌ Bạn không có quyền quản trị viên!', ephemeral: true }));
        }
        const channel = interaction.options.getChannel('channel');
        store.backupChannelId = channel.id;
        return await safeRespond(() => interaction.reply({ content: `✅ Đã cài đặt kênh backup tại: ${channel}`, ephemeral: true }));
      }

      if (commandName === 'backup') {
        if (!isAdmin) {
          return await safeRespond(() => interaction.reply({ content: '❌ Bạn không có quyền quản trị viên!', ephemeral: true }));
        }
        const attachment = interaction.options.getAttachment('file');
        if (!attachment) return await safeRespond(() => interaction.reply({ content: '❌ Thiếu file JSON!', ephemeral: true }));
        try {
          const response = await fetch(attachment.url);
          const data = JSON.parse(await response.text());
          if (data.economy) { store.economyMap.clear(); data.economy.forEach(([k, v]) => store.economyMap.set(k, v)); }
          if (data.dailyData) { store.dailyDataMap.clear(); data.dailyData.forEach(([k, v]) => store.dailyDataMap.set(k, v)); }
          if (data.usedCodes) {
            store.usedCodesMap.clear();
            data.usedCodes.forEach(([k, v]) => store.usedCodesMap.set(k, new Set(v)));
          }
          if (data.customCodes) { store.customCodesMap.clear(); data.customCodes.forEach(([k, v]) => store.customCodesMap.set(k, v)); }
          if (data.leaderboard) { store.leaderboardMap.clear(); data.leaderboard.forEach(([k, v]) => store.leaderboardMap.set(k, v)); }
          if (data.backupChannelId !== undefined) store.backupChannelId = data.backupChannelId;
          return await safeRespond(() => interaction.reply({ content: '✅ Khôi phục thành công!', ephemeral: true }));
        } catch (e) {
          console.error(e);
          return await safeRespond(() => interaction.reply({ content: '❌ File lỗi hoặc không đọc được.', ephemeral: true }));
        }
      }

      return;
    }

    // ================= BUTTONS =================
    if (interaction.isButton()) {
      // --- Nhận thưởng Daily ---
      if (interaction.customId.startsWith('claim_daily_')) {
        await interaction.deferReply({ ephemeral: true });
        const targetUserId = interaction.customId.split('_')[2];
        if (interaction.user.id !== targetUserId) {
          return await safeRespond(() => interaction.editReply({ content: '❌ Đây không phải bảng nhiệm vụ của bạn!' }));
        }

        const dData = store.getDailyData(targetUserId);
        if (dData.claimedMsg && dData.claimedGame && dData.claimedEarned) {
          return await safeRespond(() => interaction.editReply({ content: '❌ Bạn đã nhận toàn bộ phần thưởng nhiệm vụ hôm nay rồi!' }));
        }
        if (dData.messages < 20 || dData.games < 3 || dData.earned < 2000) {
          return await safeRespond(() => interaction.editReply({ content: '❌ Bạn chưa hoàn thành đủ các mốc nhiệm vụ!' }));
        }

        dData.claimedMsg = true;
        dData.claimedGame = true;
        dData.claimedEarned = true;

        const rewardBonus = 5000;
        store.addTungXu(targetUserId, rewardBonus);

        return await safeRespond(() => interaction.editReply({ content: `🎉 Chúc mừng bạn đã hoàn thành nhiệm vụ hằng ngày và nhận được **+${rewardBonus.toLocaleString()} Mcoin** phần thưởng!` }));
      }

      // --- Chọn linh vật Bầu Cua -> mở modal nhập cược ---
      if (interaction.customId.startsWith('bc_')) {
        await interaction.deferUpdate();
        const gameData = store.activeBauCuaGames.get(interaction.message.id);
        if (!gameData) return;

        const choice = interaction.customId.replace('bc_', '');
        const userId = interaction.user.id;
        const currentBal = store.economyMap.get(userId) || 0;

        const modal = new ModalBuilder()
          .setCustomId(`modal_bc_${choice}_${interaction.message.id}`)
          .setTitle(`Cược ${choice.toUpperCase()}`)
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('bc_bet_input')
                .setLabel(`Nhập số tiền cược (Số dư: ${currentBal.toLocaleString()}):`)
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            )
          );
        return await safeRespond(() => interaction.showModal(modal));
      }

      // --- Chọn Ngửa/Sấp Tung Xu -> mở modal nhập cược ---
      if (interaction.customId === 'tx_multi_ngua' || interaction.customId === 'tx_multi_sap') {
        await interaction.deferUpdate();
        const gameData = store.activeTungXuGames.get(interaction.message.id);
        if (!gameData) return;

        const userId = interaction.user.id;
        const currentBal = store.economyMap.get(userId) || 0;
        const choice = interaction.customId === 'tx_multi_ngua' ? 'ngửa' : 'sấp';

        const modal = new ModalBuilder()
          .setCustomId(`modal_tx_multi_${choice}_${interaction.message.id}`)
          .setTitle(`Chọn ${choice.toUpperCase()}`)
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('tx_bet_input')
                .setLabel(`Nhập số tiền cược (Số dư: ${currentBal.toLocaleString()} Mcoin):`)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('VD: 500')
                .setRequired(true)
            )
          );
        return await safeRespond(() => interaction.showModal(modal));
      }

      // --- Tham gia game Đoán Bom ---
      if (interaction.customId === 'bom_join') {
        await interaction.deferUpdate();
        const gameData = store.activeDoanBomGames.get(interaction.message.id);
        if (!gameData || gameData.phase !== 'joining') {
          return;
        }
        const userId = interaction.user.id;
        if (gameData.participants.has(userId)) {
          return;
        }
        gameData.participants.set(userId, interaction.user.username);

        const updatedEmbed = new EmbedBuilder()
          .setColor('#FF4444')
          .setTitle('🎮 GAME ĐOÁN BOM 💣')
          .setDescription(
            `Bấm nút bên dưới để tham gia!\n\n👥 Đã tham gia: **${gameData.participants.size}** người\n` +
            Array.from(gameData.participants.values()).map(n => `• ${n}`).join('\n')
          );
        const joinRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('bom_join').setLabel('🙋 Tham gia').setStyle(ButtonStyle.Success)
        );
        return await safeRespond(() => interaction.editReply({ embeds: [updatedEmbed], components: [joinRow] }));
      }

      // --- Chọn ô trong game Đoán Bom ---
      if (interaction.customId.startsWith('bom_cell_')) {
        await interaction.deferReply({ ephemeral: true });
        const gameData = store.activeDoanBomGames.get(interaction.message.id);
        if (!gameData || gameData.phase !== 'playing') {
          return await safeRespond(() => interaction.editReply({ content: '❌ Ván đã kết thúc!' }));
        }
        const userId = interaction.user.id;
        if (!gameData.alive.has(userId)) {
          return await safeRespond(() => interaction.editReply({ content: '❌ Bạn đã bị loại, không thể chọn ô!' }));
        }
        const cellIndex = parseInt(interaction.customId.replace('bom_cell_', ''));
        gameData.picks.set(userId, cellIndex);
        return await safeRespond(() => interaction.editReply({ content: `✅ Bạn đã chọn ô số **${cellIndex + 1}**!` }));
      }

      // ================= GAME MA SÓI =================
      if (interaction.customId.startsWith('ms_')) {
        const parts = interaction.customId.split('_');
        const gameMsgId = parts[parts.length - 1];
        const action = parts[1];
        const gameData = store.activeMaSoiGames.get(gameMsgId);
        if (!gameData) return await safeRespond(() => interaction.reply({ content: '❌ Ván Ma Sói này đã kết thúc!', ephemeral: true }));

        const userId = interaction.user.id;

        if (action === 'join') {
          await interaction.deferReply({ ephemeral: true });
          if (gameData.phase !== 'joining') return;
          if (gameData.participants.has(userId)) return;
          gameData.participants.set(userId, interaction.user.username);

          await safeRespond(() => interaction.editReply({ content: '✅ Bạn đã tham gia ván Ma Sói!' }));

          const updatedEmbed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('🐺 GAME MA SÓI 🌕')
            .setDescription(`👥 Đã tham gia: **${gameData.participants.size}** người\n` + Array.from(gameData.participants.values()).map(n => `• ${n}`).join('\n'));
          const joinRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ms_join_${gameMsgId}`).setLabel('🙋 Tham gia').setStyle(ButtonStyle.Success)
          );
          return interaction.channel.send({ embeds: [updatedEmbed], components: [joinRow] }).catch(err => console.error('Lỗi gửi tin:', err));
        }

        const myRole = gameData.roles.get(userId);

        if (action === 'wolf') {
          await interaction.deferReply({ ephemeral: true });
          if (myRole !== 'soi' || !gameData.alive.has(userId)) {
            return await safeRespond(() => interaction.editReply({ content: '❌ Đây không phải lượt của bạn!' }));
          }
          const targetId = parts[2];
          gameData.wolfVotes.set(userId, targetId);
          return await safeRespond(() => interaction.editReply({ content: `✅ Bạn đã chọn tấn công **${gameData.participants.get(targetId)}**!` }));
        }

        if (action === 'guard') {
          await interaction.deferReply({ ephemeral: true });
          if (myRole !== 'baove' || !gameData.alive.has(userId)) {
            return await safeRespond(() => interaction.editReply({ content: '❌ Đây không phải lượt của bạn!' }));
          }
          const targetId = parts[2];
          gameData.guardTarget = targetId;
          return await safeRespond(() => interaction.editReply({ content: `✅ Bạn đã chọn bảo vệ **${gameData.participants.get(targetId)}**!` }));
        }

        if (action === 'doctor') {
          await interaction.deferReply({ ephemeral: true });
          if (myRole !== 'bacsi' || !gameData.alive.has(userId)) {
            return await safeRespond(() => interaction.editReply({ content: '❌ Đây không phải lượt của bạn!' }));
          }
          const targetId = parts[2];
          gameData.doctorTarget = targetId;
          return await safeRespond(() => interaction.editReply({ content: `✅ Bạn đã chọn cứu **${gameData.participants.get(targetId)}**!` }));
        }

        if (action === 'seer') {
          await interaction.deferReply({ ephemeral: true });
          if (myRole !== 'tientri' || !gameData.alive.has(userId)) {
            return await safeRespond(() => interaction.editReply({ content: '❌ Đây không phải lượt của bạn!' }));
          }
          if (gameData.seerActed) {
            return await safeRespond(() => interaction.editReply({ content: '❌ Bạn đã soi rồi đêm nay!' }));
          }
          gameData.seerActed = true;
          const targetId = parts[2];
          const isWolf = gameData.roles.get(targetId) === 'soi';
          return await safeRespond(() => interaction.editReply({
            content: `🔮 **${gameData.participants.get(targetId)}** ${isWolf ? 'LÀ SÓI 🐺!' : 'không phải Sói ✅'}`
          }));
        }

        if (action === 'witchheal') {
          await interaction.deferUpdate();
          if (myRole !== 'phuthuy' || gameData.witchActedTonight || gameData.witchHealUsed || !gameData.wolfVictim) {
            return await safeRespond(() => interaction.editReply({ content: '❌ Không thể dùng lúc này!', embeds: [], components: [] }));
          }
          gameData.witchHealUsed = true;
          gameData.witchSavedVictim = true;
          gameData.witchActedTonight = true;
          return await safeRespond(() => interaction.editReply({ content: `💚 Đã cứu **${gameData.participants.get(gameData.wolfVictim)}**!`, embeds: [], components: [] }));
        }

        if (action === 'witchpoisonmenu') {
          await interaction.deferUpdate();
          if (myRole !== 'phuthuy' || gameData.witchActedTonight || gameData.witchPoisonUsed) {
            return await safeRespond(() => interaction.editReply({ content: '❌ Không thể dùng lúc này!', embeds: [], components: [] }));
          }
          const targets = [...gameData.alive].filter(uid => uid !== userId);
          return await safeRespond(() => interaction.editReply({ content: '☠️ Chọn mục tiêu để đầu độc:', embeds: [], components: buildPlayerButtons('ms_witchpoison', gameMsgId, gameData, targets) }));
        }

        if (action === 'witchpoison') {
          await interaction.deferUpdate();
          if (myRole !== 'phuthuy' || gameData.witchActedTonight || gameData.witchPoisonUsed) {
            return await safeRespond(() => interaction.editReply({ content: '❌ Không thể dùng lúc này!', embeds: [], components: [] }));
          }
          const targetId = parts[2];
          gameData.witchPoisonUsed = true;
          gameData.witchPoisonTarget = targetId;
          gameData.witchActedTonight = true;
          return await safeRespond(() => interaction.editReply({ content: `☠️ Đã đầu độc **${gameData.participants.get(targetId)}**!`, embeds: [], components: [] }));
        }

        if (action === 'witchskip') {
          await interaction.deferUpdate();
          gameData.witchActedTonight = true;
          return await safeRespond(() => interaction.editReply({ content: '➡️ Bạn đã bỏ qua lượt này.', embeds: [], components: [] }));
        }

        if (action === 'vote') {
          await interaction.deferReply({ ephemeral: true });
          if (!gameData.alive.has(userId)) {
            return await safeRespond(() => interaction.editReply({ content: '❌ Bạn đã bị loại, không thể vote!' }));
          }
          const targetId = parts[2];
          gameData.votes.set(userId, targetId);
          return await safeRespond(() => interaction.editReply({ content: `✅ Bạn đã vote treo cổ **${gameData.participants.get(targetId)}**!` }));
        }

        if (action === 'hunter') {
          await interaction.deferReply({ ephemeral: true });
          if (gameData.pendingHunterId !== userId) {
            return await safeRespond(() => interaction.editReply({ content: '❌ Đây không phải lượt của bạn!' }));
          }
          const targetId = parts[2];
          gameData.hunterRevengeTarget = targetId;
          gameData.pendingHunterId = null;
          return await safeRespond(() => interaction.editReply({ content: `🏹 Bạn đã bắn hạ **${gameData.participants.get(targetId)}** trước khi ngã xuống!` }));
        }

        return;
      }

      return;
    }

    // ================= MODALS =================
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('modal_bc_')) {
        await interaction.deferReply({ ephemeral: true });
        const parts = interaction.customId.split('_');
        const choice = parts[2];
        const gameMsgId = parts[3];
        const gameData = store.activeBauCuaGames.get(gameMsgId);
        if (!gameData) return await safeRespond(() => interaction.editReply({ content: '❌ Sòng đã kết thúc!' }));

        const betAmount = parseInt(interaction.fields.getTextInputValue('bc_bet_input'));
        if (isNaN(betAmount) || betAmount <= 0) return await safeRespond(() => interaction.editReply({ content: '❌ Tiền cược không hợp lệ!' }));

        const userId = interaction.user.id;
        const currentBal = store.economyMap.get(userId) || 0;

        if (currentBal < betAmount) return await safeRespond(() => interaction.editReply({ content: '❌ Bạn không đủ số dư!' }));

        store.economyMap.set(userId, currentBal - betAmount);

        if (!gameData.players.has(userId)) {
          gameData.players.set(userId, { username: interaction.user.username, bets: [] });
        }
        gameData.players.get(userId).bets.push({ choice, bet: betAmount });
        store.addLeaderboardScore(userId, betAmount);

        const totalBetSoFar = gameData.players.get(userId).bets.reduce((sum, b) => sum + b.bet, 0);
        return await safeRespond(() => interaction.editReply({
          content: `✅ Đã đặt cược thêm **${betAmount.toLocaleString()} Mcoin** vào **${choice.toUpperCase()}**!\n(Tổng đã cược trong ván này: **${totalBetSoFar.toLocaleString()} Mcoin**)`
        }));
      }

      if (interaction.customId.startsWith('modal_tx_multi_')) {
        await interaction.deferReply({ ephemeral: true });
        const parts = interaction.customId.split('_');
        const choice = parts[3];
        const gameMsgId = parts[4];
        const gameData = store.activeTungXuGames.get(gameMsgId);
        if (!gameData) return await safeRespond(() => interaction.editReply({ content: '❌ Sòng đã kết thúc!' }));

        const betAmount = parseInt(interaction.fields.getTextInputValue('tx_bet_input'));
        if (isNaN(betAmount) || betAmount <= 0) return await safeRespond(() => interaction.editReply({ content: '❌ Tiền cược không hợp lệ!' }));

        const userId = interaction.user.id;
        const currentBal = store.economyMap.get(userId) || 0;
        const oldBet = gameData.players.has(userId) ? gameData.players.get(userId).bet : 0;
        const netNeeded = betAmount - oldBet;

        if (currentBal < netNeeded) return await safeRespond(() => interaction.editReply({ content: '❌ Không đủ số dư!' }));

        store.economyMap.set(userId, currentBal - netNeeded);
        gameData.players.set(userId, { username: interaction.user.username, choice, bet: betAmount });
        store.addLeaderboardScore(userId, betAmount);

        return await safeRespond(() => interaction.editReply({ content: `✅ Đã cược thành công **${betAmount.toLocaleString()} Mcoin** vào **${choice.toUpperCase()}**!` }));
      }

      return;
    }
    } catch (err) {
      if (err?.code === 10062 || err?.code === 40060) {
        console.warn(`⚠️ Bỏ qua lỗi interaction ${err.code}`);
        return;
      }
      console.error('❌ Lỗi xử lý interactionCreate:', err);
    }
  }
};
