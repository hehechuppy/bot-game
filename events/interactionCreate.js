const {
  EmbedBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

const store = require('../store');

function buildPlayerButtons(prefix, gameMsgId, gameData, targetIds) {
  const rows = [];
  let row = new ActionRowBuilder();
  let count = 0;

  for (const uid of targetIds.slice(0, 25)) {
    if (count === 5) {
      rows.push(row);
      row = new ActionRowBuilder();
      count = 0;
    }

    const name = gameData.participants.get(uid) || 'Người chơi';

    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${prefix}_${uid}_${gameMsgId}`)
        .setLabel(name.slice(0, 80))
        .setStyle(ButtonStyle.Secondary)
    );

    count++;
  }

  if (count > 0) rows.push(row);
  return rows;
}

async function safeRespond(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err?.code === 10062 || err?.code === 40060) {
      console.warn(`⚠️ Bỏ qua lỗi interaction ${err.code}`);
      return null;
    }

    console.error('❌ Interaction response error:', err);
    return null;
  }
}

module.exports = {
  name: 'interactionCreate',

  async execute(client, interaction) {
    try {

      // =========================================================
      // AUTOCOMPLETE
      // =========================================================
      if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'xoacode') {
          const focusedValue = interaction.options.getFocused();

          const allCodes = Array.from(
            store.customCodesMap.keys()
          );

          const filtered = allCodes
            .filter(code =>
              code.toLowerCase().includes(
                focusedValue.toLowerCase()
              )
            )
            .slice(0, 25);

          const choices = filtered.map(code => ({
            name: `${code} (+${store.customCodesMap.get(code).reward.toLocaleString()} Mcoin)`,
            value: code
          }));

          return await safeRespond(() =>
            interaction.respond(choices)
          );
        }

        return;
      }

      // =========================================================
      // SLASH COMMANDS
      // =========================================================
      if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        const isAdmin = interaction.member?.permissions?.has(
          PermissionFlagsBits.Administrator
        );

        // ================= TANGQUA - Tặng vật phẩm =================
        if (commandName === 'tangqua') {
          if (!isAdmin) {
            return await safeRespond(() =>
              interaction.reply({
                content: '❌ Bạn không có quyền sử dụng lệnh này!',
                ephemeral: true
              })
            );
          }

          const targetUser = interaction.options.getUser('user');
          const itemId = interaction.options.getInteger('item');
          const quantity = interaction.options.getInteger('quantity');

          if (!targetUser) {
            return await safeRespond(() =>
              interaction.reply({
                content: '❌ Vui lòng chỉ định người nhận!',
                ephemeral: true
              })
            );
          }

          const item = store.SHOP_ITEMS.find(i => i.id === itemId);
          if (!item) {
            return await safeRespond(() =>
              interaction.reply({
                content: `❌ Không tìm thấy vật phẩm ID ${itemId}!`,
                ephemeral: true
              })
            );
          }

          if (quantity <= 0) {
            return await safeRespond(() =>
              interaction.reply({
                content: '❌ Số lượng phải lớn hơn 0!',
                ephemeral: true
              })
            );
          }

          store.addToInventory(targetUser.id, itemId, quantity);

          const giftEmbed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle('🎁 TẶNG VẬT PHẨM - THÀNH CÔNG')
            .addFields(
              { name: '🎉 Người Nhận', value: `${targetUser.username}`, inline: true },
              { name: '📦 Vật Phẩm', value: `${item.name} (ID: ${item.id})`, inline: true },
              { name: '📊 Số Lượng', value: `**${quantity}** cái`, inline: true },
              { name: '💰 Giá Trị', value: `${(item.price * quantity).toLocaleString()} Mcoin`, inline: true },
              { name: '👨‍💼 Người Tặng', value: interaction.user.username, inline: true }
            )
            .setFooter({ text: 'Vật phẩm đã được thêm vào kho của người nhận' })
            .setTimestamp();

          return await safeRespond(() =>
            interaction.reply({
              embeds: [giftEmbed],
              ephemeral: false
            })
          );
        }

        // ---------------- TAO CODE ----------------
        if (commandName === 'taocode') {
          if (!isAdmin) {
            return await safeRespond(() =>
              interaction.reply({
                content: '❌ Bạn không có quyền sử dụng lệnh tạo mã code này!',
                ephemeral: true
              })
            );
          }

          const codeName = interaction.options
            .getString('code')
            .toLowerCase()
            .trim();

          const rewardAmount = interaction.options.getInteger('reward');
          const durationMinutes = interaction.options.getInteger('duration');

          if (store.customCodesMap.has(codeName)) {
            return await safeRespond(() =>
              interaction.reply({
                content: `❌ Mã code \`${codeName}\` đã tồn tại!`,
                ephemeral: true
              })
            );
          }

          let expiresAt = null;

          if (durationMinutes && durationMinutes > 0) {
            expiresAt = Date.now() + durationMinutes * 60 * 1000;
          }

          store.customCodesMap.set(codeName, {
            reward: rewardAmount,
            expiresAt
          });

          const timeStr = expiresAt
            ? `<t:${Math.floor(expiresAt / 1000)}:R>`
            : 'Vĩnh viễn';

          const successEmbed = new EmbedBuilder()
            .setColor('#00FFCC')
            .setTitle('🎟️ TẠO MÃ CODE THÀNH CÔNG')
            .setDescription(
              `• Mã: \`${codeName}\`\n` +
              `• Phần thưởng: **+${rewardAmount.toLocaleString()} Mcoin**\n` +
              `• Thời hạn: **${timeStr}**`
            );

          return await safeRespond(() =>
            interaction.reply({
              embeds: [successEmbed]
            })
          );
        }

        // ---------------- XOA CODE ----------------
        if (commandName === 'xoacode') {
          if (!isAdmin) {
            return await safeRespond(() =>
              interaction.reply({
                content: '❌ Bạn không có quyền sử dụng lệnh xóa code này!',
                ephemeral: true
              })
            );
          }

          const codeName = interaction.options
            .getString('code')
            .toLowerCase()
            .trim();

          if (!store.customCodesMap.has(codeName)) {
            return await safeRespond(() =>
              interaction.reply({
                content: `❌ Mã code \`${codeName}\` không tồn tại!`,
                ephemeral: true
              })
            );
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

          return await safeRespond(() =>
            interaction.reply({
              embeds: [successEmbed]
            })
          );
        }

        // ---------------- SET BACKUP ----------------
        if (commandName === 'setbackup') {
          if (!isAdmin) {
            return await safeRespond(() =>
              interaction.reply({
                content: '❌ Bạn không có quyền quản trị viên!',
                ephemeral: true
              })
            );
          }

          const channel = interaction.options.getChannel('channel');
          store.backupChannelId = channel.id;

          return await safeRespond(() =>
            interaction.reply({
              content: `✅ Đã cài đặt kênh backup tại: ${channel}`,
              ephemeral: true
            })
          );
        }

        // ---------------- BACKUP ----------------
        if (commandName === 'backup') {
          if (!isAdmin) {
            return await safeRespond(() =>
              interaction.reply({
                content: '❌ Bạn không có quyền quản trị viên!',
                ephemeral: true
              })
            );
          }

          const attachment = interaction.options.getAttachment('file');

          if (!attachment) {
            return await safeRespond(() =>
              interaction.reply({
                content: '❌ Thiếu file JSON!',
                ephemeral: true
              })
            );
          }

          try {
            const response = await fetch(attachment.url);

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const data = JSON.parse(await response.text());

            if (data.economy) {
              store.economyMap.clear();
              data.economy.forEach(([k, v]) => store.economyMap.set(k, v));
            }

            if (data.dailyData) {
              store.dailyDataMap.clear();
              data.dailyData.forEach(([k, v]) => store.dailyDataMap.set(k, v));
            }

            if (data.usedCodes) {
              store.usedCodesMap.clear();
              data.usedCodes.forEach(([k, v]) =>
                store.usedCodesMap.set(k, new Set(v))
              );
            }

            if (data.customCodes) {
              store.customCodesMap.clear();
              data.customCodes.forEach(([k, v]) => store.customCodesMap.set(k, v));
            }

            if (data.leaderboard) {
              store.leaderboardMap.clear();
              data.leaderboard.forEach(([k, v]) => store.leaderboardMap.set(k, v));
            }

            if (data.backupChannelId !== undefined) {
              store.backupChannelId = data.backupChannelId;
            }

            return await safeRespond(() =>
              interaction.reply({
                content: '✅ Khôi phục thành công!',
                ephemeral: true
              })
            );

          } catch (e) {
            console.error(e);
            return await safeRespond(() =>
              interaction.reply({
                content: '❌ File lỗi hoặc không đọc được.',
                ephemeral: true
              })
            );
          }
        }

        // ---------------- QUẢN LÝ SỐ DƯ ----------------
        if (commandName === 'quanli') {
          if (!isAdmin) {
            return await safeRespond(() =>
              interaction.reply({
                content: '❌ Bạn không có quyền sử dụng lệnh này!',
                ephemeral: true
              })
            );
          }

          const target = interaction.options.getUser('target');
          const action = interaction.options.getString('action');
          const amount = interaction.options.getInteger('amount');
          const reason = interaction.options.getString('reason') || 'Không có lý do';

          const before = store.economyMap.get(target.id) || 0;
          let after, actionLabel, deltaText;

          if (action === 'set') {
            after = amount;
            actionLabel = 'Đặt số dư thành';
            deltaText = `${amount.toLocaleString()} Mcoin`;
          } else if (action === 'add') {
            after = before + amount;
            actionLabel = 'Cộng thêm';
            deltaText = `+${amount.toLocaleString()} Mcoin`;
          } else {
            after = Math.max(0, before - amount);
            actionLabel = 'Trừ bớt';
            deltaText = `-${amount.toLocaleString()} Mcoin`;
          }

          store.economyMap.set(target.id, after);

          const logEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('💰 QUẢN LÝ SỐ DƯ NGƯỜI CHƠI')
            .addFields(
              { name: '🛠️ Quản trị viên', value: `${interaction.user.username}`, inline: true },
              { name: '🎯 Người chơi', value: `${target.username}`, inline: true },
              { name: '📋 Hành động', value: actionLabel, inline: true },
              { name: '💵 Thay đổi', value: deltaText, inline: true },
              { name: '📉 Số dư trước', value: `${before.toLocaleString()} Mcoin`, inline: true },
              { name: '📈 Số dư sau', value: `${after.toLocaleString()} Mcoin`, inline: true },
              { name: '📝 Lý do', value: reason, inline: false }
            )
            .setFooter({ text: `ID người chơi: ${target.id}` })
            .setTimestamp();

          return await safeRespond(() =>
            interaction.reply({ embeds: [logEmbed] })
          );
        }

        return;
      }

      // =========================================================
      // BUTTONS
      // =========================================================
      if (interaction.isButton()) {
        const customId = interaction.customId;

        // =======================================================
        // DAILY
        // =======================================================
        if (customId.startsWith('claim_daily_')) {
          await interaction.deferReply({ ephemeral: true });

          const targetUserId = customId.split('_')[2];

          if (interaction.user.id !== targetUserId) {
            return await safeRespond(() =>
              interaction.editReply({
                content: '❌ Đây không phải bảng nhiệm vụ của bạn!'
              })
            );
          }

          const dData = store.getDailyData(targetUserId);

          if (dData.claimedMsg && dData.claimedGame && dData.claimedEarned) {
            return await safeRespond(() =>
              interaction.editReply({
                content: '❌ Bạn đã nhận toàn bộ phần thưởng nhiệm vụ hôm nay rồi!'
              })
            );
          }

          if (dData.messages < 20 || dData.games < 3 || dData.earned < 2000) {
            return await safeRespond(() =>
              interaction.editReply({
                content: '❌ Bạn chưa hoàn thành đủ các mốc nhiệm vụ!'
              })
            );
          }

          dData.claimedMsg = true;
          dData.claimedGame = true;
          dData.claimedEarned = true;

          const rewardBonus = 5000;
          store.addTungXu(targetUserId, rewardBonus);

          return await safeRespond(() =>
            interaction.editReply({
              content: `🎉 Chúc mừng bạn đã hoàn thành nhiệm vụ hằng ngày và nhận được **+${rewardBonus.toLocaleString()} Mcoin** phần thưởng!`
            })
          );
        }

        // =======================================================
        // BAU CUA
        // =======================================================
        if (customId.startsWith('bc_')) {
          if (interaction.replied || interaction.deferred) return;

          const gameMsgId = interaction.message.id;
          const gameData = store.activeBauCuaGames.get(gameMsgId);

          if (!gameData) {
            return await safeRespond(() =>
              interaction.reply({
                content: '❌ Sòng đã kết thúc!',
                ephemeral: true
              })
            );
          }

          const choice = customId.replace('bc_', '');
          const userId = interaction.user.id;
          const currentBal = store.economyMap.get(userId) || 0;

          const modal = new ModalBuilder()
            .setCustomId(`modal_bc_${choice}_${gameMsgId}`)
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

        // =======================================================
        // TUNG XU
        // =======================================================
        if (customId === 'tx_multi_ngua' || customId === 'tx_multi_sap') {
          if (interaction.replied || interaction.deferred) return;

          const gameMsgId = interaction.message.id;
          const gameData = store.activeTungXuGames.get(gameMsgId);

          if (!gameData) {
            return await safeRespond(() =>
              interaction.reply({
                content: '❌ Sòng đã kết thúc!',
                ephemeral: true
              })
            );
          }

          const userId = interaction.user.id;
          const currentBal = store.economyMap.get(userId) || 0;
          const choice = customId === 'tx_multi_ngua' ? 'ngửa' : 'sấp';

          const modal = new ModalBuilder()
            .setCustomId(`modal_tx_multi_${choice}_${gameMsgId}`)
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

        // =======================================================
        // DOAN BOM JOIN
        // =======================================================
        if (customId === 'bom_join') {
          await interaction.deferUpdate();

          const gameId = `bom_${interaction.message.id}`;
          const gameData = store.activeDoanBomGames.get(gameId);

          if (!gameData) {
            return await safeRespond(() =>
              interaction.editReply({ content: '❌ Không tìm thấy ván Đoán Bom này!' })
            );
          }

          if (gameData.phase !== 'joining') {
            return await safeRespond(() =>
              interaction.editReply({ content: '❌ Ván Đoán Bom đã bắt đầu hoặc đã kết thúc!' })
            );
          }

          const userId = interaction.user.id;

          if (gameData.participants.has(userId)) {
            return await safeRespond(() =>
              interaction.editReply({ content: '⚠️ Bạn đã tham gia ván này rồi!' })
            );
          }

          gameData.participants.set(userId, interaction.user.username);

          const playerList = Array.from(gameData.participants.values())
            .map(name => `• ${name}`)
            .join('\n');

          const updatedEmbed = new EmbedBuilder()
            .setColor('#FF4444')
            .setTitle('🎮 GAME ĐOÁN BOM 💣')
            .setDescription(
              `Bấm nút bên dưới để tham gia!\n\n` +
              `👥 Đã tham gia: **${gameData.participants.size}** người\n` +
              playerList
            );

          const joinRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('bom_join')
              .setLabel('🙋 Tham gia')
              .setStyle(ButtonStyle.Success)
          );

          return await safeRespond(() =>
            interaction.editReply({
              embeds: [updatedEmbed],
              components: [joinRow]
            })
          );
        }

        // =======================================================
        // MA SOI
        // =======================================================
        if (customId.startsWith('ms_')) {
          const parts = customId.split('_');
          const gameMsgId = parts[parts.length - 1];
          const action = parts[1];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) {
            return await safeRespond(() =>
              interaction.reply({
                content: '❌ Ván Ma Sói này đã kết thúc!',
                ephemeral: true
              })
            );
          }

          const userId = interaction.user.id;

          // ---------------- JOIN ----------------
          if (action === 'join') {
            await interaction.deferUpdate();

            if (gameData.phase !== 'joining') {
              return await safeRespond(() =>
                interaction.editReply({ content: '❌ Ván Ma Sói đã bắt đầu!' })
              );
            }

            if (gameData.participants.has(userId)) {
              return await safeRespond(() =>
                interaction.editReply({ content: '⚠️ Bạn đã tham gia ván Ma Sói rồi!' })
              );
            }

            gameData.participants.set(userId, interaction.user.username);

            const updatedEmbed = new EmbedBuilder()
              .setColor('#8B0000')
              .setTitle('🐺 GAME MA SÓI 🌕')
              .setDescription(
                `👥 Đã tham gia: **${gameData.participants.size}** người\n` +
                Array.from(gameData.participants.values())
                  .map(n => `• ${n}`)
                  .join('\n')
              );

            const joinRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`ms_join_${gameMsgId}`)
                .setLabel('🙋 Tham gia')
                .setStyle(ButtonStyle.Success)
            );

            return await safeRespond(() =>
              interaction.editReply({
                embeds: [updatedEmbed],
                components: [joinRow]
              })
            );
          }

          const myRole = gameData.roles?.get(userId);

          // ---------------- WOLF ----------------
          if (action === 'wolf') {
            await interaction.deferReply({ ephemeral: true });

            if (myRole !== 'soi' || !gameData.alive?.has(userId)) {
              return await safeRespond(() =>
                interaction.editReply({ content: '❌ Đây không phải lượt của bạn!' })
              );
            }

            const targetId = parts[2];
            gameData.wolfVotes.set(userId, targetId);

            return await safeRespond(() =>
              interaction.editReply({
                content: `✅ Bạn đã chọn tấn công **${gameData.participants.get(targetId)}**!`
              })
            );
          }

          // ---------------- GUARD ----------------
          if (action === 'guard') {
            await interaction.deferReply({ ephemeral: true });

            if (myRole !== 'baove' || !gameData.alive?.has(userId)) {
              return await safeRespond(() =>
                interaction.editReply({ content: '❌ Đây không phải lượt của bạn!' })
              );
            }

            const targetId = parts[2];
            gameData.guardTarget = targetId;

            return await safeRespond(() =>
              interaction.editReply({
                content: `✅ Bạn đã chọn bảo vệ **${gameData.participants.get(targetId)}**!`
              })
            );
          }

          // ---------------- DOCTOR ----------------
          if (action === 'doctor') {
            await interaction.deferReply({ ephemeral: true });

            if (myRole !== 'bacsi' || !gameData.alive?.has(userId)) {
              return await safeRespond(() =>
                interaction.editReply({ content: '❌ Đây không phải lượt của bạn!' })
              );
            }

            const targetId = parts[2];
            gameData.doctorTarget = targetId;

            return await safeRespond(() =>
              interaction.editReply({
                content: `✅ Bạn đã chọn cứu **${gameData.participants.get(targetId)}**!`
              })
            );
          }

          // ---------------- SEER ----------------
          if (action === 'seer') {
            await interaction.deferReply({ ephemeral: true });

            if (myRole !== 'tientri' || !gameData.alive?.has(userId)) {
              return await safeRespond(() =>
                interaction.editReply({ content: '❌ Đây không phải lượt của bạn!' })
              );
            }

            if (gameData.seerActed) {
              return await safeRespond(() =>
                interaction.editReply({ content: '❌ Bạn đã soi rồi đêm nay!' })
              );
            }

            const targetId = parts[2];
            gameData.seerActed = true;
            const isWolf = gameData.roles.get(targetId) === 'soi';

            return await safeRespond(() =>
              interaction.editReply({
                content: `🔮 **${gameData.participants.get(targetId)}** ${isWolf ? 'LÀ SÓI 🐺!' : 'không phải Sói ✅'}`
              })
            );
          }

          // ---------------- WITCH HEAL ----------------
          if (action === 'witchheal') {
            await interaction.deferUpdate();

            if (
              myRole !== 'phuthuy' ||
              gameData.witchActedTonight ||
              gameData.witchHealUsed ||
              !gameData.wolfVictim
            ) {
              return await safeRespond(() =>
                interaction.editReply({
                  content: '❌ Không thể dùng thuốc giải lúc này!',
                  embeds: [],
                  components: []
                })
              );
            }

            gameData.witchHealUsed = true;
            gameData.witchSavedVictim = true;
            gameData.witchActedTonight = true;

            return await safeRespond(() =>
              interaction.editReply({
                content: `💚 Đã cứu **${gameData.participants.get(gameData.wolfVictim)}**!`,
                embeds: [],
                components: []
              })
            );
          }

          // ---------------- WITCH POISON MENU ----------------
          if (action === 'witchpoisonmenu') {
            await interaction.deferUpdate();

            if (
              myRole !== 'phuthuy' ||
              gameData.witchActedTonight ||
              gameData.witchPoisonUsed
            ) {
              return await safeRespond(() =>
                interaction.editReply({
                  content: '❌ Không thể dùng thuốc độc lúc này!',
                  embeds: [],
                  components: []
                })
              );
            }

            const aliveTargets = Array.from(gameData.alive.keys()).filter(id => id !== userId);
            const poisonRows = buildPlayerButtons('ms_witchpoison', gameMsgId, gameData, aliveTargets);

            return await safeRespond(() =>
              interaction.editReply({
                content: '🧪 Chọn người chơi bạn muốn hạ độc:',
                embeds: [],
                components: poisonRows
              })
            );
          }

          // ---------------- WITCH POISON ----------------
          if (action === 'witchpoison') {
            await interaction.deferUpdate();

            if (
              myRole !== 'phuthuy' ||
              gameData.witchActedTonight ||
              gameData.witchPoisonUsed
            ) {
              return await safeRespond(() =>
                interaction.editReply({
                  content: '❌ Bạn không thể hạ độc lúc này!',
                  embeds: [],
                  components: []
                })
              );
            }

            const targetId = parts[2];
            gameData.witchPoisonUsed = true;
            gameData.witchPoisonTarget = targetId;
            gameData.witchActedTonight = true;

            return await safeRespond(() =>
              interaction.editReply({
                content: `☠️ Bạn đã dùng bình độc lên **${gameData.participants.get(targetId)}**!`,
                embeds: [],
                components: []
              })
            );
          }

          // ---------------- WITCH PASS ----------------
          if (action === 'witchpass') {
            await interaction.deferUpdate();

            gameData.witchActedTonight = true;

            return await safeRespond(() =>
              interaction.editReply({
                content: '💤 Bạn đã quyết định không dùng phép thuật đêm nay.',
                embeds: [],
                components: []
              })
            );
          }

          // ---------------- VOTE ----------------
          if (action === 'vote') {
            await interaction.deferReply({ ephemeral: true });

            if (!gameData.alive?.has(userId)) {
              return await safeRespond(() =>
                interaction.editReply({ content: '❌ Người chết không được tham gia treo cổ!' })
              );
            }

            const targetId = parts[2];
            gameData.dayVotes.set(userId, targetId);

            return await safeRespond(() =>
              interaction.editReply({
                content: `🗳️ Bạn đã bỏ phiếu treo cổ **${gameData.participants.get(targetId)}**!`
              })
            );
          }
        }

        return;
      }

      // =========================================================
      // MODAL SUBMITS
      // =========================================================
      if (interaction.isModalSubmit()) {
        const customId = interaction.customId;

        // ---------------- MODAL BẦU CUA ----------------
        if (customId.startsWith('modal_bc_')) {
          await interaction.deferReply({ ephemeral: true });

          const parts = customId.split('_');
          const choice = parts[2];
          const gameMsgId = parts[3];

          const gameData = store.activeBauCuaGames.get(gameMsgId);
          if (!gameData) {
            return await safeRespond(() =>
              interaction.editReply({ content: '❌ Sòng Bầu Cua đã kết thúc!' })
            );
          }

          const amountInput = interaction.fields.getTextInputValue('bc_bet_input');
          const amount = parseInt(amountInput);

          if (isNaN(amount) || amount <= 0) {
            return await safeRespond(() =>
              interaction.editReply({ content: '❌ Số tiền cược không hợp lệ!' })
            );
          }

          const userId = interaction.user.id;
          const userBal = store.economyMap.get(userId) || 0;

          if (userBal < amount) {
            return await safeRespond(() =>
              interaction.editReply({ content: '❌ Số dư Mcoin của bạn không đủ!' })
            );
          }

          // Trừ tiền và lưu cược
          store.economyMap.set(userId, userBal - amount);

          if (!gameData.bets.has(userId)) {
            gameData.bets.set(userId, []);
          }
          gameData.bets.get(userId).push({ choice, amount });

          return await safeRespond(() =>
            interaction.editReply({
              content: `✅ Đặt cược thành công **${amount.toLocaleString()} Mcoin** vào **${choice.toUpperCase()}**!`
            })
          );
        }

        // ---------------- MODAL TÙNG XỦ MULTI ----------------
        if (customId.startsWith('modal_tx_multi_')) {
          await interaction.deferReply({ ephemeral: true });

          const parts = customId.split('_');
          const choice = parts[3]; // 'ngửa' hoặc 'sấp'
          const gameMsgId = parts[4];

          const gameData = store.activeTungXuGames.get(gameMsgId);
          if (!gameData) {
            return await safeRespond(() =>
              interaction.editReply({ content: '❌ Sòng Tùng Xử đã kết thúc!' })
            );
          }

          const amountInput = interaction.fields.getTextInputValue('tx_bet_input');
          const amount = parseInt(amountInput);

          if (isNaN(amount) || amount <= 0) {
            return await safeRespond(() =>
              interaction.editReply({ content: '❌ Số tiền cược không hợp lệ!' })
            );
          }

          const userId = interaction.user.id;
          const userBal = store.economyMap.get(userId) || 0;

          if (userBal < amount) {
            return await safeRespond(() =>
              interaction.editReply({ content: '❌ Số dư Mcoin của bạn không đủ!' })
            );
          }

          // Trừ tiền và lưu cược
          store.economyMap.set(userId, userBal - amount);

          if (!gameData.bets.has(userId)) {
            gameData.bets.set(userId, []);
          }
          gameData.bets.get(userId).push({ choice, amount });

          return await safeRespond(() =>
            interaction.editReply({
              content: `✅ Đặt cược thành công **${amount.toLocaleString()} Mcoin** vào cửa **${choice.toUpperCase()}**!`
            })
          );
        }
      }

    } catch (error) {
      console.error('💥 Lỗi không xác định tại interactionCreate:', error);
    }
  }
};
