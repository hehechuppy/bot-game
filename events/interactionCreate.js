// events/interactionCreate.js
const { EmbedBuilder } = require('discord.js');
const store = require('../store');

// Hàm hỗ trợ phản hồi an toàn chống crash do Interaction timeout / đã reply
async function safeRespond(action) {
  try {
    return await action();
  } catch (err) {
    if (err.code !== 10062 && err.code !== 40060) {
      console.error('⚠️ SafeRespond Error:', err);
    }
  }
}

module.exports = {
  name: 'interactionCreate',
  async execute(client, interaction) {
    if (!interaction.isButton() && !interaction.isModalSubmit()) return;

    const guildId = interaction.guild?.id;
    if (!guildId) return;

    try {
      // =========================================================
      // NÚT BẤM (BUTTON INTERACTIONS)
      // =========================================================
      if (interaction.isButton()) {
        const customId = interaction.customId;

        // ---------------- NHẬN THƯỞNG DAILY ----------------
        if (customId.startsWith('claim_daily_')) {
          const parts = customId.split('_');
          const targetUserId = parts[3];

          if (interaction.user.id !== targetUserId) {
            return await safeRespond(() =>
              interaction.reply({ content: '❌ Nút bấm này không thuộc về bạn!', ephemeral: true })
            );
          }

          const dData = store.getDailyData(guildId, interaction.user.id);

          if (dData.messages < 20 || dData.games < 3 || dData.earned < 2000) {
            return await safeRespond(() =>
              interaction.reply({ content: '❌ Bạn chưa hoàn thành đủ 3 nhiệm vụ hằng ngày!', ephemeral: true })
            );
          }

          if (dData.claimedMsg && dData.claimedGame && dData.claimedEarned) {
            return await safeRespond(() =>
              interaction.reply({ content: '❌ Bạn đã nhận phần thưởng hằng ngày hôm nay rồi!', ephemeral: true })
            );
          }

          dData.claimedMsg = true;
          dData.claimedGame = true;
          dData.claimedEarned = true;

          const rewardAmount = 5000;
          store.addTungXu(guildId, interaction.user.id, rewardAmount);

          const successEmbed = new EmbedBuilder()
            .setColor('#4CAF50')
            .setTitle('🎉 NHẬN THƯỞNG THÀNH CÔNG')
            .setDescription(`Chúc mừng **${interaction.user.username}** đã hoàn thành nhiệm vụ và nhận được **+${rewardAmount.toLocaleString()} Mcoin**!`)
            .setTimestamp();

          try {
            const disabledRow = {
              type: 1,
              components: [
                {
                  ...interaction.message.components[0].components[0].data,
                  disabled: true
                }
              ]
            };
            await interaction.update({ embeds: interaction.message.embeds, components: [disabledRow] });
            return await safeRespond(() => interaction.followUp({ embeds: [successEmbed] }));
          } catch (e) {
            return await safeRespond(() => interaction.reply({ embeds: [successEmbed] }));
          }
        }

        // ---------------- ACTION MA SÓI (PHÙ THỦY, BẢO VỆ, MA SÓI, V.V.) ----------------
        if (customId.startsWith('ms_')) {
          const parts = customId.split('_');
          const action = parts[1];
          const gameMsgId = parts[parts.length - 1];
          const gameData = store.activeMaSoiGames?.get(gameMsgId);

          if (gameData) {
            const userId = interaction.user.id;
            const myRole = gameData.roles?.get(userId);

            // Phù thủy dùng bình cứu
            if (action === 'witchcure') {
              await interaction.deferUpdate();

              if (myRole !== 'phuthuy' || gameData.witchHealUsed || gameData.witchActedTonight) {
                return await safeRespond(() =>
                  interaction.editReply({
                    content: '❌ Không thể dùng bình cứu lúc này!',
                    embeds: [],
                    components: []
                  })
                );
              }

              gameData.witchSaveTarget = true;
              gameData.witchHealUsed = true;
              gameData.witchActedTonight = true;

              return await safeRespond(() =>
                interaction.editReply({
                  content: '🧪 Bạn đã dùng bình cứu đêm nay thành công!',
                  embeds: [],
                  components: []
                })
              );
            }

            // Phù thủy chọn mục tiêu độc
            if (action === 'witchpoison') {
              const targetId = parts[2];
              await interaction.deferUpdate();

              if (myRole !== 'phuthuy' || gameData.witchPoisonUsed || gameData.witchActedTonight) {
                return await safeRespond(() =>
                  interaction.editReply({
                    content: '❌ Không thể dùng thuốc độc lúc này!',
                    embeds: [],
                    components: []
                  })
                );
              }

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

            // Phù thủy bỏ qua lượt
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
        }
      }

      // =========================================================
      // FORM ĐIỀN THÔNG TIN (MODAL SUBMITS)
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
