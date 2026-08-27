// Đảm bảo bạn đã require/import 'store' hoặc các helper cần thiết ở đây
// const store = require('../path/to/store');

module.exports = {
  name: 'interactionCreate',
  async execute(arg1, arg2) {
    // 1. Sửa lỗi lệch tham số (client, interaction) từ index.js
    const interaction = (arg1 && typeof arg1.isButton === 'function') ? arg1 : arg2;
    if (!interaction) return;

    try {
      // 2. XỬ LÝ BUTTON & SELECT MENU (TẤT CẢ GAME)
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        // ⚡ QUAN TRỌNG: Gọi deferUpdate() NGAY LẬP TỨC để chặn lỗi quá 3 giây của Discord
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferUpdate().catch(() => {});
        }

        const guildId = interaction.guildId;
        const customId = interaction.customId;
        const parts = customId.split('_');
        const action = parts[1] || parts[0];

        // ---------------- GAME ĐOÁN BOM ----------------
        if (customId.startsWith('bom_') || action === 'bomjoin') {
          const gameData = store.activeBomGames?.get(interaction.message.id);
          if (!gameData) {
            return await interaction.followUp({ content: '❌ Game đã kết thúc!', ephemeral: true }).catch(() => {});
          }

          const userId = interaction.user.id;
          if (!gameData.players.includes(userId)) {
            gameData.players.push(userId);
          }

          return await interaction.editReply({
            content: `🎮 **GAME ĐOÁN BOM** 💣\nBấm nút bên dưới để tham gia!\n\n👥 Đã tham gia: **${gameData.players.length}** người`
          }).catch(() => {});
        }

        // ---------------- GAME MA SÓI (PHÙ THỦY POISON) ----------------
        if (action === 'witchpoison') {
          const targetId = parts[2];
          // Thêm logic xử lý Ma Sói của bạn tại đây...
          return await interaction.editReply({
            content: `☠️ Đã chọn đầu độc người chơi!`,
            embeds: [],
            components: []
          }).catch(() => {});
        }

        // ---------------- GAME MA SÓI (PHÙ THỦY SKIP) ----------------
        if (action === 'witchskip') {
          return await interaction.editReply({
            content: '⏭️ Bạn đã chọn bỏ qua lượt đêm nay.',
            embeds: [],
            components: []
          }).catch(() => {});
        }
      }

      // 3. XỬ LÝ MODAL SUBMIT (BẦU CUA, TUNG XU...)
      if (interaction.isModalSubmit()) {
        const guildId = interaction.guildId;
        const customId = interaction.customId;

        // ---------------- CƯỢC BẦU CUA ----------------
        if (customId.startsWith('modal_bc_')) {
          const parts = customId.split('_');
          const choice = parts[2];
          const gameMsgId = parts[3];
          const gameData = store.activeBauCuaGames?.get(gameMsgId);

          if (!gameData) {
            return await interaction.reply({ content: '❌ Sòng đã kết thúc!', ephemeral: true });
          }

          const betInput = interaction.fields.getTextInputValue('bc_bet_input');
          const betAmount = parseInt(betInput.replace(/,/g, ''), 10);
          const userId = interaction.user.id;
          const currentBal = store.getBalance(guildId, userId);

          if (isNaN(betAmount) || betAmount <= 0) {
            return await interaction.reply({ content: '❌ Số tiền cược không hợp lệ!', ephemeral: true });
          }

          if (currentBal < betAmount) {
            return await interaction.reply({
              content: `❌ Bạn không đủ tiền! Cần **${betAmount.toLocaleString()} Mcoin** (Số dư: ${currentBal.toLocaleString()} Mcoin).`,
              ephemeral: true
            });
          }

          store.addTungXu(guildId, userId, -betAmount);

          if (!gameData.bets.has(userId)) {
            gameData.bets.set(userId, {});
          }
          const userBets = gameData.bets.get(userId);
          userBets[choice] = (userBets[choice] || 0) + betAmount;

          return await interaction.reply({
            content: `✅ Bạn đã đặt cược **${betAmount.toLocaleString()} Mcoin** vào **${choice.toUpperCase()}**!`,
            ephemeral: true
          });
        }

        // ---------------- CƯỢC TUNG XU MULTI ----------------
        if (customId.startsWith('modal_tx_multi_')) {
          const parts = customId.split('_');
          const choice = parts[3];
          const gameMsgId = parts[4];
          const gameData = store.activeTungXuGames?.get(gameMsgId);

          if (!gameData) {
            return await interaction.reply({ content: '❌ Sòng đã kết thúc!', ephemeral: true });
          }

          const betInput = interaction.fields.getTextInputValue('tx_bet_input');
          const betAmount = parseInt(betInput.replace(/,/g, ''), 10);
          const userId = interaction.user.id;
          const currentBal = store.getBalance(guildId, userId);

          if (isNaN(betAmount) || betAmount <= 0) {
            return await interaction.reply({ content: '❌ Số tiền cược không hợp lệ!', ephemeral: true });
          }

          if (currentBal < betAmount) {
            return await interaction.reply({
              content: `❌ Bạn không đủ tiền! Cần **${betAmount.toLocaleString()} Mcoin** (Số dư: ${currentBal.toLocaleString()} Mcoin).`,
              ephemeral: true
            });
          }

          store.addTungXu(guildId, userId, -betAmount);

          if (!gameData.bets.has(userId)) {
            gameData.bets.set(userId, []);
          }
          gameData.bets.get(userId).push({ choice, amount: betAmount });

          return await interaction.reply({
            content: `✅ Bạn đã cược **${betAmount.toLocaleString()} Mcoin** vào mặt **${choice.toUpperCase()}**!`,
            ephemeral: true
          });
        }
      }
    } catch (err) {
      console.error('❌ Lỗi hệ thống trong interactionCreate:', err);
    }
  }
};
