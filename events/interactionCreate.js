// ---------------- HUNTER ----------------
          if (action === 'hunter') {
            await interaction.deferReply({ ephemeral: true });

            if (gameData.pendingHunterId !== userId) {
              return await safeRespond(() =>
                interaction.editReply({
                  content: '❌ Đây không phải lượt bắn của bạn!'
                })
              );
            }

            const targetId = parts[2];

            if (!targetId || !gameData.alive.has(targetId)) {
              return await safeRespond(() =>
                interaction.editReply({
                  content: '❌ Người chơi này không còn sống!'
                })
              );
            }

            gameData.hunterTarget = targetId;

            return await safeRespond(() =>
              interaction.editReply({
                content: `🏹 Bạn đã chọn kéo theo **${gameData.participants.get(targetId)}**!`
              })
            );
          }
        }

        return;
      }

      // =========================================================
      // MODAL SUBMIT (Bầu Cua / Tùng Xu)
      // =========================================================
      if (interaction.isModalSubmit()) {
        const customId = interaction.customId;

        // Bầu Cua Modal Submit
        if (customId.startsWith('modal_bc_')) {
          const parts = customId.split('_');
          const choice = parts[2];
          const gameMsgId = parts[3];
          const gameData = store.activeBauCuaGames.get(gameMsgId);

          if (!gameData) {
            return await safeRespond(() =>
              interaction.reply({
                content: '❌ Sòng Bầu Cua này đã kết thúc!',
                ephemeral: true
              })
            );
          }

          const amountInput = interaction.fields.getTextInputValue('bc_bet_input');
          const betAmount = parseInt(amountInput, 10);

          if (isNaN(betAmount) || betAmount <= 0) {
            return await safeRespond(() =>
              interaction.reply({
                content: '❌ Số tiền cược không hợp lệ!',
                ephemeral: true
              })
            );
          }

          const userBal = store.getBalance(guildId, interaction.user.id);
          if (userBal < betAmount) {
            return await safeRespond(() =>
              interaction.reply({
                content: `❌ Bạn không đủ tiền! Số dư hiện tại: **${userBal.toLocaleString()} Mcoin**`,
                ephemeral: true
              })
            );
          }

          // Trừ tiền & ghi nhận cược
          store.setBalance(guildId, interaction.user.id, userBal - betAmount);
          
          if (!gameData.bets.has(interaction.user.id)) {
            gameData.bets.set(interaction.user.id, []);
          }
          gameData.bets.get(interaction.user.id).push({ choice, amount: betAmount });

          return await safeRespond(() =>
            interaction.reply({
              content: `✅ Bạn đã cược **${betAmount.toLocaleString()} Mcoin** vào ô **${choice.toUpperCase()}**!`,
              ephemeral: true
            })
          );
        }

        // Tùng Xu Modal Submit
        if (customId.startsWith('modal_tx_multi_')) {
          const parts = customId.split('_');
          const choice = parts[3];
          const gameMsgId = parts[4];
          const gameData = store.activeTungXuGames.get(gameMsgId);

          if (!gameData) {
            return await safeRespond(() =>
              interaction.reply({
                content: '❌ Sòng Tùng Xu này đã kết thúc!',
                ephemeral: true
              })
            );
          }

          const amountInput = interaction.fields.getTextInputValue('tx_bet_input');
          const betAmount = parseInt(amountInput, 10);

          if (isNaN(betAmount) || betAmount <= 0) {
            return await safeRespond(() =>
              interaction.reply({
                content: '❌ Số tiền cược không hợp lệ!',
                ephemeral: true
              })
            );
          }

          const userBal = store.getBalance(guildId, interaction.user.id);
          if (userBal < betAmount) {
            return await safeRespond(() =>
              interaction.reply({
                content: `❌ Bạn không đủ tiền! Số dư hiện tại: **${userBal.toLocaleString()} Mcoin**`,
                ephemeral: true
              })
            );
          }

          store.setBalance(guildId, interaction.user.id, userBal - betAmount);
          
          if (!gameData.bets.has(interaction.user.id)) {
            gameData.bets.set(interaction.user.id, []);
          }
          gameData.bets.get(interaction.user.id).push({ choice, amount: betAmount });

          return await safeRespond(() =>
            interaction.reply({
              content: `✅ Bạn đã cược **${betAmount.toLocaleString()} Mcoin** vào mặt **${choice.toUpperCase()}**!`,
              ephemeral: true
            })
          );
        }
      }
    } catch (err) {
      console.error('❌ Lỗi trong interactionCreate handler:', err);
    }
  }
};
