// events/interactionCreate.js
const { EmbedBuilder } = require('discord.js');
const store = require('../store');

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

    // Bỏ qua nút nối từ để Collector tự xử lý
    if (interaction.customId?.startsWith('nt_')) return;

    const guildId = interaction.guild?.id;
    if (!guildId) return;

    try {
      if (interaction.isButton()) {
        const customId = interaction.customId;

        // Daily Claim
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
      }

      // Modal Submits (Bầu Cua, Tùng Xú)
      if (interaction.isModalSubmit()) {
        const customId = interaction.customId;

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
      }
    } catch (err) {
      console.error('❌ Lỗi hệ thống trong interactionCreate:', err);
    }
  }
};
