module.exports = {
  name: 'interactionCreate',
  async execute(arg1, arg2) {
    // Tự động xác định đối tượng interaction kể cả khi index.js truyền (client, interaction)
    const interaction = (arg1 && typeof arg1.isButton === 'function') ? arg1 : arg2;
    if (!interaction || typeof interaction.isButton !== 'function') return;

    try {
      const guildId = interaction.guildId;

      // =========================================================
      // BUTTONS & SELECT MENUS
      // =========================================================
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        const customId = interaction.customId;
        const parts = customId.split('_');
        const action = parts[1];

        // WITCH POISON
        if (action === 'witchpoison') {
          await interaction.deferUpdate();

          if (
            myRole !== 'phuthuy' ||
            gameData.witchActedTonight ||
            gameData.witchPoisonUsed
          ) {
            return await safeRespond(() =>
              interaction.editReply({
                content: '❌ Không thể dùng lúc này!',
                embeds: [],
                components: []
              })
            );
          }

          const targetId = parts[2];
          gameData.witchPoisonTarget = targetId;
          gameData.witchPoisonUsed = true;
          gameData.witchActedTonight = true;

          return await safeRespond(() =>
            interaction.editReply({
              content: `☠️ Bạn đã chọn đầu độc **${gameData.participants.get(targetId)}**!`,
              embeds: [],
              components: []
            })
          );
        }

        // WITCH SKIP
        if (action === 'witchskip') {
          await interaction.deferUpdate();

          if (myRole !== 'phuthuy' || gameData.witchActedTonight) {
            return await safeRespond(() =>
              interaction.editReply({
                content: '❌ Không thể dùng lúc này!',
                embeds: [],
                components: []
              })
            );
          }

          gameData.witchActedTonight = true;

          return await safeRespond(() =>
            interaction.editReply({
              content: '⏭️ Bạn đã chọn bỏ qua lượt đêm nay.',
              embeds: [],
              components: []
            })
          );
        }
      }

      // =========================================================
      // MODAL SUBMITS
      // =========================================================
      if (interaction.isModalSubmit()) {
        const customId = interaction.customId;

        // ---------------- CƯỢC BẦU CUA ----------------
        if (customId.startsWith('modal_bc_')) {
          const parts = customId.split('_');
          const choice = parts[2];
          const gameMsgId = parts[3];
          const gameData = store.activeBauCuaGames.get(gameMsgId);

          if (!gameData) {
            return await safeRespond(() =>
              interaction.reply({ content: '❌ Sòng đã kết thúc!', ephemeral: true })
            );
          }

          const betInput = interaction.fields.getTextInputValue('bc_bet_input');
          const betAmount = parseInt(betInput.replace(/,/g, ''), 10);
          const userId = interaction.user.id;
          const currentBal = store.getBalance(guildId, userId);

          if (isNaN(betAmount) || betAmount <= 0) {
            return await safeRespond(() =>
              interaction.reply({ content: '❌ Số tiền cược không hợp lệ!', ephemeral: true })
            );
          }

          if (currentBal < betAmount) {
            return await safeRespond(() =>
              interaction.reply({
                content: `❌ Bạn không đủ tiền! Cần **${betAmount.toLocaleString()} Mcoin** (Số dư: ${currentBal.toLocaleString()} Mcoin).`,
                ephemeral: true
              })
            );
          }

          store.addTungXu(guildId, userId, -betAmount);

          if (!gameData.bets.has(userId)) {
            gameData.bets.set(userId, {});
          }
          const userBets = gameData.bets.get(userId);
          userBets[choice] = (userBets[choice] || 0) + betAmount;

          return await safeRespond(() =>
            interaction.reply({
              content: `✅ Bạn đã đặt cược **${betAmount.toLocaleString()} Mcoin** vào **${choice.toUpperCase()}**!`,
              ephemeral: true
            })
          );
        }

        // ---------------- CƯỢC TUNG XU MULTI ----------------
        if (customId.startsWith('modal_tx_multi_')) {
          const parts = customId.split('_');
          const choice = parts[3];
          const gameMsgId = parts[4];
          const gameData = store.activeTungXuGames.get(gameMsgId);

          if (!gameData) {
            return await safeRespond(() =>
              interaction.reply({ content: '❌ Sòng đã kết thúc!', ephemeral: true })
            );
          }

          const betInput = interaction.fields.getTextInputValue('tx_bet_input');
          const betAmount = parseInt(betInput.replace(/,/g, ''), 10);
          const userId = interaction.user.id;
          const currentBal = store.getBalance(guildId, userId);

          if (isNaN(betAmount) || betAmount <= 0) {
            return await safeRespond(() =>
              interaction.reply({ content: '❌ Số tiền cược không hợp lệ!', ephemeral: true })
            );
          }

          if (currentBal < betAmount) {
            return await safeRespond(() =>
              interaction.reply({
                content: `❌ Bạn không đủ tiền! Cần **${betAmount.toLocaleString()} Mcoin** (Số dư: ${currentBal.toLocaleString()} Mcoin).`,
                ephemeral: true
              })
            );
          }

          store.addTungXu(guildId, userId, -betAmount);

          if (!gameData.bets.has(userId)) {
            gameData.bets.set(userId, []);
          }
          gameData.bets.get(userId).push({ choice, amount: betAmount });

          return await safeRespond(() =>
            interaction.reply({
              content: `✅ Bạn đã cược **${betAmount.toLocaleString()} Mcoin** vào mặt **${choice.toUpperCase()}**!`,
              ephemeral: true
            })
          );
        }
      }
    } catch (err) {
      console.error('❌ Lỗi hệ thống trong interactionCreate:', err);
    }
  }
};
