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

module.exports = {
  name: 'interactionCreate',
  async execute(client, interaction) {
    // ================= SLASH COMMANDS =================
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      const hasAllowedRole = false; // set role check if needed

      if (commandName === 'taocode') {
        if (!isAdmin && !hasAllowedRole) {
          return interaction.reply({ content: '❌ Bạn không có quyền sử dụng lệnh tạo mã code này!', ephemeral: true });
        }
        const codeName = interaction.options.getString('code').toLowerCase().trim();
        const rewardAmount = interaction.options.getInteger('reward');
        const durationMinutes = interaction.options.getInteger('duration');

        if (store.customCodesMap.has(codeName)) {
          return interaction.reply({ content: `❌ Mã code \`${codeName}\` đã tồn tại!`, ephemeral: true });
        }

        let expiresAt = null;
        if (durationMinutes && durationMinutes > 0) expiresAt = Date.now() + durationMinutes * 60 * 1000;
        store.customCodesMap.set(codeName, { reward: rewardAmount, expiresAt });

        const timeStr = expiresAt ? `<t:${Math.floor(expiresAt / 1000)}:R>` : 'Vĩnh viễn';
        const successEmbed = new EmbedBuilder()
          .setColor('#00FFCC')
          .setTitle('🎟️ TẠO MÃ CODE THÀNH CÔNG')
          .setDescription(`• Mã: \`${codeName}\`\n• Phần thưởng: **+${rewardAmount.toLocaleString()} Mcoin**\n• Thời hạn: **${timeStr}**`);

        return interaction.reply({ embeds: [successEmbed] });
      }

      if (commandName === 'setbackup') {
        if (!isAdmin) {
          return interaction.reply({ content: '❌ Bạn không có quyền quản trị viên!', ephemeral: true });
        }
        const channel = interaction.options.getChannel('channel');
        store.backupChannelId = channel.id;
        return interaction.reply({ content: `✅ Đã cài đặt kênh backup tại: ${channel}`, ephemeral: true });
      }

      if (commandName === 'backup') {
        if (!isAdmin) {
          return interaction.reply({ content: '❌ Bạn không có quyền quản trị viên!', ephemeral: true });
        }
        const attachment = interaction.options.getAttachment('file');
        if (!attachment) return interaction.reply({ content: '❌ Thiếu file JSON!', ephemeral: true });
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
          return interaction.reply({ content: '✅ Khôi phục thành công!', ephemeral: true });
        } catch (e) {
          console.error(e);
          return interaction.reply({ content: '❌ File lỗi hoặc không đọc được.', ephemeral: true });
        }
      }

      return;
    }

    // ================= BUTTONS =================
    if (interaction.isButton()) {
      // --- Nhận thưởng Daily ---
      if (interaction.customId.startsWith('claim_daily_')) {
        const targetUserId = interaction.customId.split('_')[2];
        if (interaction.user.id !== targetUserId) {
          return interaction.reply({ content: '❌ Đây không phải bảng nhiệm vụ của bạn!', ephemeral: true });
        }

        const dData = store.getDailyData(targetUserId);
        if (dData.claimedMsg && dData.claimedGame && dData.claimedEarned) {
          return interaction.reply({ content: '❌ Bạn đã nhận toàn bộ phần thưởng nhiệm vụ hôm nay rồi!', ephemeral: true });
        }
        if (dData.messages < 20 || dData.games < 3 || dData.earned < 2000) {
          return interaction.reply({ content: '❌ Bạn chưa hoàn thành đủ các mốc nhiệm vụ!', ephemeral: true });
        }

        dData.claimedMsg = true;
        dData.claimedGame = true;
        dData.claimedEarned = true;

        const rewardBonus = 5000;
        store.addTungXu(targetUserId, rewardBonus);

        return interaction.reply({ content: `🎉 Chúc mừng bạn đã hoàn thành nhiệm vụ hằng ngày và nhận được **+${rewardBonus.toLocaleString()} Mcoin** phần thưởng!`, ephemeral: true });
      }

      // --- Chọn linh vật Bầu Cua -> mở modal nhập cược (có thể bấm nhiều lần) ---
      if (interaction.customId.startsWith('bc_')) {
        const gameData = store.activeBauCuaGames.get(interaction.message.id);
        if (!gameData) return interaction.reply({ content: '❌ Sòng Bầu Cua này đã kết thúc!', ephemeral: true });

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
        return interaction.showModal(modal);
      }

      // --- Chọn Ngửa/Sấp Tung Xu -> mở modal nhập cược ---
      if (interaction.customId === 'tx_multi_ngua' || interaction.customId === 'tx_multi_sap') {
        const gameData = store.activeTungXuGames.get(interaction.message.id);
        if (!gameData) return interaction.reply({ content: '❌ Sòng đã kết thúc!', ephemeral: true });

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
        return interaction.showModal(modal);
      }

      // --- Tham gia game Đoán Bom ---
      if (interaction.customId === 'bom_join') {
        const gameData = store.activeDoanBomGames.get(interaction.message.id);
        if (!gameData || gameData.phase !== 'joining') {
          return interaction.reply({ content: '❌ Không thể tham gia lúc này!', ephemeral: true });
        }
        const userId = interaction.user.id;
        if (gameData.participants.has(userId)) {
          return interaction.reply({ content: '❌ Bạn đã tham gia rồi!', ephemeral: true });
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
        return interaction.update({ embeds: [updatedEmbed], components: [joinRow] });
      }

      // --- Chọn ô trong game Đoán Bom ---
      if (interaction.customId.startsWith('bom_cell_')) {
        const gameData = store.activeDoanBomGames.get(interaction.message.id);
        if (!gameData || gameData.phase !== 'playing') {
          return interaction.reply({ content: '❌ Ván đã kết thúc!', ephemeral: true });
        }
        const userId = interaction.user.id;
        if (!gameData.alive.has(userId)) {
          return interaction.reply({ content: '❌ Bạn đã bị loại, không thể chọn ô!', ephemeral: true });
        }
        const cellIndex = parseInt(interaction.customId.replace('bom_cell_', ''));
        gameData.picks.set(userId, cellIndex);
        return interaction.reply({ content: `✅ Bạn đã chọn ô số **${cellIndex + 1}**!`, ephemeral: true });
      }

      // ================= GAME MA SÓI =================
      if (interaction.customId.startsWith('ms_')) {
        const parts = interaction.customId.split('_');
        const gameMsgId = parts[parts.length - 1];
        const action = parts[1];
        const gameData = store.activeMaSoiGames.get(gameMsgId);
        if (!gameData) return interaction.reply({ content: '❌ Ván Ma Sói này đã kết thúc!', ephemeral: true });

        const userId = interaction.user.id;

        // --- Tham gia: xác nhận riêng cho người bấm, rồi GỬI TIN NHẮN MỚI công khai cập nhật danh sách ---
        if (action === 'join') {
          if (gameData.phase !== 'joining') return interaction.reply({ content: '❌ Không thể tham gia lúc này!', ephemeral: true });
          if (gameData.participants.has(userId)) return interaction.reply({ content: '❌ Bạn đã tham gia rồi!', ephemeral: true });
          gameData.participants.set(userId, interaction.user.username);

          await interaction.reply({ content: '✅ Bạn đã tham gia ván Ma Sói!', ephemeral: true });

          const updatedEmbed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('🐺 GAME MA SÓI 🌕')
            .setDescription(`👥 Đã tham gia: **${gameData.participants.size}** người\n` + Array.from(gameData.participants.values()).map(n => `• ${n}`).join('\n'));
          const joinRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ms_join_${gameMsgId}`).setLabel('🙋 Tham gia').setStyle(ButtonStyle.Success)
          );
          return interaction.channel.send({ embeds: [updatedEmbed], components: [joinRow] });
        }

        const myRole = gameData.roles.get(userId);

        // Từ đây trở đi, mọi hành động (Sói/Bảo Vệ/Bác Sĩ/Tiên Tri/Phù Thủy) đều diễn ra
        // trong tin nhắn riêng (DM) mà bot gửi cho từng người.

        if (action === 'wolf') {
          if (myRole !== 'soi' || !gameData.alive.has(userId)) {
            return interaction.reply({ content: '❌ Đây không phải lượt của bạn!' });
          }
          const targetId = parts[2];
          gameData.wolfVotes.set(userId, targetId);
          return interaction.reply({ content: `✅ Bạn đã chọn tấn công **${gameData.participants.get(targetId)}**!` });
        }

        if (action === 'guard') {
          if (myRole !== 'baove' || !gameData.alive.has(userId)) {
            return interaction.reply({ content: '❌ Đây không phải lượt của bạn!' });
          }
          const targetId = parts[2];
          gameData.guardTarget = targetId;
          return interaction.reply({ content: `✅ Bạn đã chọn bảo vệ **${gameData.participants.get(targetId)}**!` });
        }

        if (action === 'doctor') {
          if (myRole !== 'bacsi' || !gameData.alive.has(userId)) {
            return interaction.reply({ content: '❌ Đây không phải lượt của bạn!' });
          }
          const targetId = parts[2];
          gameData.doctorTarget = targetId;
          return interaction.reply({ content: `✅ Bạn đã chọn cứu **${gameData.participants.get(targetId)}**!` });
        }

        if (action === 'seer') {
          if (myRole !== 'tientri' || !gameData.alive.has(userId)) {
            return interaction.reply({ content: '❌ Đây không phải lượt của bạn!' });
          }
          if (gameData.seerActed) {
            return interaction.reply({ content: '❌ Bạn đã soi rồi đêm nay!' });
          }
          gameData.seerActed = true;
          const targetId = parts[2];
          const isWolf = gameData.roles.get(targetId) === 'soi';
          return interaction.reply({
            content: `🔮 **${gameData.participants.get(targetId)}** ${isWolf ? 'LÀ SÓI 🐺!' : 'không phải Sói ✅'}`
          });
        }

        // --- Phù Thủy: menu (Cứu / Độc / Bỏ qua) được gửi thẳng qua DM, bấm trực tiếp các nút bên dưới ---

        if (action === 'witchheal') {
          if (myRole !== 'phuthuy' || gameData.witchActedTonight || gameData.witchHealUsed || !gameData.wolfVictim) {
            return interaction.update({ content: '❌ Không thể dùng lúc này!', embeds: [], components: [] });
          }
          gameData.witchHealUsed = true;
          gameData.witchSavedVictim = true;
          gameData.witchActedTonight = true;
          return interaction.update({ content: `💚 Đã cứu **${gameData.participants.get(gameData.wolfVictim)}**!`, embeds: [], components: [] });
        }

        if (action === 'witchpoisonmenu') {
          if (myRole !== 'phuthuy' || gameData.witchActedTonight || gameData.witchPoisonUsed) {
            return interaction.update({ content: '❌ Không thể dùng lúc này!', embeds: [], components: [] });
          }
          const targets = [...gameData.alive].filter(uid => uid !== userId);
          return interaction.update({ content: '☠️ Chọn mục tiêu để đầu độc:', embeds: [], components: buildPlayerButtons('ms_witchpoison', gameMsgId, gameData, targets) });
        }

        if (action === 'witchpoison') {
          if (myRole !== 'phuthuy' || gameData.witchActedTonight || gameData.witchPoisonUsed) {
            return interaction.update({ content: '❌ Không thể dùng lúc này!', embeds: [], components: [] });
          }
          const targetId = parts[2];
          gameData.witchPoisonUsed = true;
          gameData.witchPoisonTarget = targetId;
          gameData.witchActedTonight = true;
          return interaction.update({ content: `☠️ Đã đầu độc **${gameData.participants.get(targetId)}**!`, embeds: [], components: [] });
        }

        if (action === 'witchskip') {
          gameData.witchActedTonight = true;
          return interaction.update({ content: '➡️ Bạn đã bỏ qua lượt này.', embeds: [], components: [] });
        }

        // --- Các hành động sau đây vẫn diễn ra công khai trong kênh (ban ngày) nên vẫn giữ ephemeral ---

        if (action === 'vote') {
          if (!gameData.alive.has(userId)) {
            return interaction.reply({ content: '❌ Bạn đã bị loại, không thể vote!', ephemeral: true });
          }
          const targetId = parts[2];
          gameData.votes.set(userId, targetId);
          return interaction.reply({ content: `✅ Bạn đã vote treo cổ **${gameData.participants.get(targetId)}**!`, ephemeral: true });
        }

        if (action === 'hunter') {
          if (gameData.pendingHunterId !== userId) {
            return interaction.reply({ content: '❌ Đây không phải lượt của bạn!', ephemeral: true });
          }
          const targetId = parts[2];
          gameData.hunterRevengeTarget = targetId;
          gameData.pendingHunterId = null;
          return interaction.reply({ content: `🏹 Bạn đã bắn hạ **${gameData.participants.get(targetId)}** trước khi ngã xuống!`, ephemeral: true });
        }

        return;
      }

      return;
    }

    // ================= MODALS =================
    if (interaction.isModalSubmit()) {
      // --- Modal đặt cược Bầu Cua (CHO PHÉP cược nhiều lần, kể cả nhiều linh vật khác nhau) ---
      if (interaction.customId.startsWith('modal_bc_')) {
        const parts = interaction.customId.split('_');
        const choice = parts[2];
        const gameMsgId = parts[3];
        const gameData = store.activeBauCuaGames.get(gameMsgId);
        if (!gameData) return interaction.reply({ content: '❌ Sòng đã kết thúc!', ephemeral: true });

        const betAmount = parseInt(interaction.fields.getTextInputValue('bc_bet_input'));
        if (isNaN(betAmount) || betAmount <= 0) return interaction.reply({ content: '❌ Tiền cược không hợp lệ!', ephemeral: true });

        const userId = interaction.user.id;
        const currentBal = store.economyMap.get(userId) || 0;

        if (currentBal < betAmount) return interaction.reply({ content: '❌ Bạn không đủ số dư!', ephemeral: true });

        store.economyMap.set(userId, currentBal - betAmount);

        if (!gameData.players.has(userId)) {
          gameData.players.set(userId, { username: interaction.user.username, bets: [] });
        }
        gameData.players.get(userId).bets.push({ choice, bet: betAmount });
        store.addLeaderboardScore(userId, betAmount);

        const totalBetSoFar = gameData.players.get(userId).bets.reduce((sum, b) => sum + b.bet, 0);
        return interaction.reply({
          content: `✅ Đã đặt cược thêm **${betAmount.toLocaleString()} Mcoin** vào **${choice.toUpperCase()}**!\n(Tổng đã cược trong ván này: **${totalBetSoFar.toLocaleString()} Mcoin**)`,
          ephemeral: true
        });
      }

      // --- Modal đặt cược Tung Xu ---
      if (interaction.customId.startsWith('modal_tx_multi_')) {
        const parts = interaction.customId.split('_');
        const choice = parts[3];
        const gameMsgId = parts[4];
        const gameData = store.activeTungXuGames.get(gameMsgId);
        if (!gameData) return interaction.reply({ content: '❌ Sòng đã kết thúc!', ephemeral: true });

        const betAmount = parseInt(interaction.fields.getTextInputValue('tx_bet_input'));
        if (isNaN(betAmount) || betAmount <= 0) return interaction.reply({ content: '❌ Tiền cược không hợp lệ!', ephemeral: true });

        const userId = interaction.user.id;
        const currentBal = store.economyMap.get(userId) || 0;
        const oldBet = gameData.players.has(userId) ? gameData.players.get(userId).bet : 0;
        const netNeeded = betAmount - oldBet;

        if (currentBal < netNeeded) return interaction.reply({ content: '❌ Không đủ số dư!', ephemeral: true });

        store.economyMap.set(userId, currentBal - netNeeded);
        gameData.players.set(userId, { username: interaction.user.username, choice, bet: betAmount });
        store.addLeaderboardScore(userId, betAmount);

        return interaction.reply({ content: `✅ Đã cược thành công **${betAmount.toLocaleString()} Mcoin** vào **${choice.toUpperCase()}**!`, ephemeral: true });
      }

      return;
    }
  },
};
