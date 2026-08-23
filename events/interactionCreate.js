// events/interactionCreate.js

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

const store = require('../store');

const {
  activeGames
} = require('../games/noitu');

async function safeRespond(fn) {
  try {
    return await fn();
  } catch (err) {
    if (
      err?.code === 10062 ||
      err?.code === 40060
    ) {
      console.warn(
        `⚠️ Interaction đã hết hạn hoặc đã được trả lời: ${err.code}`
      );
      return null;
    }

    console.error(
      '❌ Lỗi respond:',
      err
    );

    return null;
  }
}

function buildCaoNutEmbed(
  gameData
) {
  const players =
    Array.from(
      gameData.players.values()
    );

  const playerText =
    players.length > 0
      ? players
          .map(
            (player, index) =>
              `> **${index + 1}.** ${player.username}`
          )
          .join('\n')
      : '> Chưa có ai tham gia';

  return new EmbedBuilder()
    .setColor('#FF4F9A')
    .setTitle('🃏 CÀO NÚT 3 LÁ')
    .setDescription(
      `💰 **Tiền cược:** \`${gameData.betAmount.toLocaleString()} Mcoin\`\n\n` +
      `👥 **Người tham gia:** **${players.length} người**\n` +
      `${playerText}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🙋 **Bấm nút bên dưới để tham gia ván!**\n\n` +
      `⏳ Thời gian chờ: **25 giây**\n` +
      `👤 Tối thiểu: **2 người**`
    )
    .setFooter({
      text:
        '🃏 Cào Nút • Ai cao nút hơn sẽ thắng'
    })
    .setTimestamp();
}

function buildCaoNutJoinRow() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          'caonut_join'
        )
        .setLabel(
          '🙋 Tham gia'
        )
        .setStyle(
          ButtonStyle.Success
        )
    );
}

module.exports = {
  name: 'interactionCreate',

  async execute(
    client,
    interaction
  ) {
    try {
      // =====================================================
      // BUTTON
      // =====================================================

      if (
        interaction.isButton()
      ) {
        const buttonId =
          interaction.customId;

        // ✅ HANDLE GAME BUTTON (.tx, .ms) - viết handler trực tiếp dưới đây

        // =================================================
        // TUNG XU - CHỌN NGỬA/SẤP
        // =================================================
        if (buttonId.startsWith('tx_multi_')) {
          await interaction.deferUpdate();

          const choice = buttonId.split('_')[2];
          const gameMsg = interaction.message;
          const gameData = store.activeTungXuGames.get(gameMsg.id);

          if (!gameData) {
            return await safeRespond(() =>
              interaction.followUp({ content: '❌ Ván Tung Xu này đã kết thúc!', ephemeral: true })
            );
          }

          if (gameData.players.has(userId)) {
            return await safeRespond(() =>
              interaction.followUp({ content: '⚠️ Bạn đã chọn rồi!', ephemeral: true })
            );
          }

          const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
          const modal = new ModalBuilder()
            .setCustomId(`tx_bet_${gameMsg.id}_${choice}`)
            .setTitle('💰 Nhập Tiền Cược');

          const betInput = new TextInputBuilder()
            .setCustomId('bet_amount')
            .setLabel('Số Mcoin cược')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('VD: 1000')
            .setRequired(true);

          const actionRow = new ActionRowBuilder().addComponents(betInput);
          modal.addComponents(actionRow);

          return await interaction.showModal(modal);
        }

        // =================================================
        // MA SÓI - JOIN
        // =================================================
        if (buttonId.startsWith('ms_join_')) {
          await interaction.deferUpdate();

          const gameMsgId = buttonId.split('_')[2];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) {
            return await safeRespond(() =>
              interaction.followUp({ content: '❌ Ván Ma Sói này đã kết thúc!', ephemeral: true })
            );
          }

          if (gameData.phase !== 'joining') {
            return await safeRespond(() =>
              interaction.followUp({ content: '❌ Ván Ma Sói đã bắt đầu!', ephemeral: true })
            );
          }

          if (gameData.participants.has(userId)) {
            return await safeRespond(() =>
              interaction.followUp({ content: '⚠️ Bạn đã tham gia rồi!', ephemeral: true })
            );
          }

          gameData.participants.set(userId, interaction.user.username);

          const embed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('🐺 SÒNG MA SÓI')
            .setDescription(
              `👥 **Người tham gia:** ${gameData.participants.size}\n` +
              `${[...gameData.participants.values()].map((name, i) => `> ${i + 1}. ${name}`).join('\n')}`
            )
            .setFooter({ text: 'Chờ phát triển...' });

          return await safeRespond(() =>
            interaction.message.edit({ embeds: [embed] })
          );
        }

        // =================================================
        // MA SÓI - SÓI CHỌN NẠN NHÂN
        // =================================================
        if (buttonId.startsWith('ms_wolf_')) {
          await interaction.deferUpdate();

          const parts = buttonId.split('_');
          const targetId = parts[2];
          const gameMsgId = parts[3];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) return;

          gameData.wolfVotes.set(userId, targetId);

          return await safeRespond(() =>
            interaction.followUp({
              content: `✅ Bạn đã bình chọn nạn nhân: **${gameData.participants.get(targetId)}**`,
              ephemeral: true
            })
          );
        }

        // =================================================
        // MA SÓI - BẢO VỆ CHỌN NGƯỜI
        // =================================================
        if (buttonId.startsWith('ms_guard_')) {
          await interaction.deferUpdate();

          const parts = buttonId.split('_');
          const targetId = parts[2];
          const gameMsgId = parts[3];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) return;

          gameData.guardTarget = targetId;

          return await safeRespond(() =>
            interaction.followUp({
              content: `✅ Bạn đã chọn bảo vệ: **${gameData.participants.get(targetId)}**`,
              ephemeral: true
            })
          );
        }

        // =================================================
        // MA SÓI - BÁC SĨ CHỌN NGƯỜI CỨU
        // =================================================
        if (buttonId.startsWith('ms_doctor_')) {
          await interaction.deferUpdate();

          const parts = buttonId.split('_');
          const targetId = parts[2];
          const gameMsgId = parts[3];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) return;

          gameData.doctorTarget = targetId;

          return await safeRespond(() =>
            interaction.followUp({
              content: `✅ Bạn đã chọn cứu: **${gameData.participants.get(targetId)}**`,
              ephemeral: true
            })
          );
        }

        // =================================================
        // MA SÓI - TIÊN TRI CHỌN NGƯỜI
        // =================================================
        if (buttonId.startsWith('ms_seer_')) {
          await interaction.deferUpdate();

          const parts = buttonId.split('_');
          const targetId = parts[2];
          const gameMsgId = parts[3];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) return;

          const { ROLE_META } = require('../games/masoi');
          const role = gameData.roles.get(targetId);
          const isWolf = role === 'soi';
          const rMeta = ROLE_META[role];

          gameData.seerActed = true;

          return await safeRespond(() =>
            interaction.followUp({
              content: `🔮 **${gameData.participants.get(targetId)}** là **${rMeta.label}** ${isWolf ? '🐺 **MA SÓI!**' : ''}`,
              ephemeral: true
            })
          );
        }

        // =================================================
        // MA SÓI - PHÙ THỦY CỨU NẠNHÂN
        // =================================================
        if (buttonId.startsWith('ms_witchheal_')) {
          await interaction.deferUpdate();

          const gameMsgId = buttonId.split('_')[2];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData || !gameData.wolfVictim) return;

          gameData.witchSavedVictim = true;
          gameData.witchHealUsed = true;

          return await safeRespond(() =>
            interaction.followUp({
              content: `💚 Bạn đã cứu: **${gameData.participants.get(gameData.wolfVictim)}**`,
              ephemeral: true
            })
          );
        }

        // =================================================
        // MA SÓI - PHÙ THỦY ĐỘC SAT MENU
        // =================================================
        if (buttonId.startsWith('ms_witchpoisonmenu_')) {
          await interaction.deferUpdate();

          const gameMsgId = buttonId.split('_')[3];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) return;

          const targets = [...gameData.alive];
          const rows = [];
          let row = new ActionRowBuilder();
          let count = 0;

          for (const uid of targets.slice(0, 25)) {
            if (count === 5) {
              rows.push(row);
              row = new ActionRowBuilder();
              count = 0;
            }
            const name = gameData.participants.get(uid) || 'Người chơi';
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(`ms_witchpoison_${uid}_${gameMsgId}`)
                .setLabel(name.slice(0, 80))
                .setStyle(ButtonStyle.Danger)
            );
            count++;
          }
          if (count > 0) rows.push(row);

          return await safeRespond(() =>
            interaction.followUp({
              content: '☠️ Chọn người để độc sát:',
              components: rows,
              ephemeral: true
            })
          );
        }

        // =================================================
        // MA SÓI - PHÙ THỦY ĐỘC SAT CONFIRM
        // =================================================
        if (buttonId.startsWith('ms_witchpoison_')) {
          await interaction.deferUpdate();

          const parts = buttonId.split('_');
          const targetId = parts[2];
          const gameMsgId = parts[3];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) return;

          gameData.witchPoisonTarget = targetId;
          gameData.witchPoisonUsed = true;

          return await safeRespond(() =>
            interaction.followUp({
              content: `☠️ Bạn đã độc sát: **${gameData.participants.get(targetId)}**`,
              ephemeral: true
            })
          );
        }

        // =================================================
        // MA SÓI - PHÙ THỦY BỎ QUA
        // =================================================
        if (buttonId.startsWith('ms_witchskip_')) {
          await interaction.deferUpdate();

          return await safeRespond(() =>
            interaction.followUp({
              content: '➡️ Bạn đã bỏ qua đêm nay.',
              ephemeral: true
            })
          );
        }

        // =================================================
        // MA SÓI - THỢ SĂN BẮN PHÁT SÚNG
        // =================================================
        if (buttonId.startsWith('ms_hunter_')) {
          await interaction.deferUpdate();

          const parts = buttonId.split('_');
          const targetId = parts[2];
          const gameMsgId = parts[3];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) return;

          gameData.hunterRevengeTarget = targetId;

          return await safeRespond(() =>
            interaction.followUp({
              content: `🏹 Thợ Săn đã chọn bắn: **${gameData.participants.get(targetId)}**`,
              ephemeral: true
            })
          );
        }

        // =================================================
        // MA SÓI - VOTE TREO CỔ
        // =================================================
        if (buttonId.startsWith('ms_vote_')) {
          await interaction.deferUpdate();

          const parts = buttonId.split('_');
          const targetId = parts[2];
          const gameMsgId = parts[3];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) return;

          if (gameData.votes.has(userId)) {
            return await safeRespond(() =>
              interaction.followUp({
                content: '⚠️ Bạn đã vote rồi!',
                ephemeral: true
              })
            );
          }

          gameData.votes.set(userId, targetId);

          return await safeRespond(() =>
            interaction.followUp({
              content: `✅ Bạn đã vote: **${gameData.participants.get(targetId)}**`,
              ephemeral: true
            })
          );
        }


        const userId =
          interaction.user.id;

        // =================================================
        // DAILY
        // =================================================

        if (
          buttonId.startsWith(
            'claim_daily_'
          )
        ) {
          const dData =
            store.getDailyData(
              userId
            );

          const bal =
            store.economyMap.get(
              userId
            ) || 0;

          const canClaim =
            dData.messages >= 20 &&
            dData.games >= 3 &&
            dData.earned >= 2000 &&
            !(
              dData.claimedMsg &&
              dData.claimedGame &&
              dData.claimedEarned
            );

          if (!canClaim) {
            return await safeRespond(
              () =>
                interaction.reply({
                  content:
                    '❌ Bạn chưa hoàn thành tất cả nhiệm vụ!',
                  ephemeral: true
                })
            );
          }

          const reward =
            10000;

          store.addTungXu(
            userId,
            reward
          );

          dData.claimedMsg =
            true;

          dData.claimedGame =
            true;

          dData.claimedEarned =
            true;

          const claimEmbed =
            new EmbedBuilder()
              .setColor(
                '#00FF00'
              )
              .setTitle(
                '🎁 NHẬN THƯỞNG DAILY'
              )
              .setDescription(
                `✅ Bạn đã nhận thưởng hôm nay!\n\n` +
                `💰 **+${reward.toLocaleString()} Mcoin**\n` +
                `💳 Tổng số dư: **${(
                  bal + reward
                ).toLocaleString()} Mcoin**`
              )
              .setFooter({
                text:
                  'Quay lại vào ngày mai để nhận tiếp!'
              })
              .setTimestamp();

          return await safeRespond(
            () =>
              interaction.reply({
                embeds: [
                  claimEmbed
                ],
                ephemeral: false
              })
          );
        }

        // =================================================
        // CÀO NÚT - THAM GIA
        // =================================================

        if (
          buttonId ===
          'caonut_join'
        ) {
          const gameMsgId =
            interaction.message.id;

          const gameData =
            store.activeCaoNutGames.get(
              gameMsgId
            );

          // Ván không tồn tại
          if (!gameData) {
            return await safeRespond(
              () =>
                interaction.reply({
                  content:
                    '❌ Ván Cào Nút này đã kết thúc!',
                  ephemeral: true
                })
            );
          }

          // Ván đã bắt đầu
          if (
            gameData.started ||
            gameData.ended ||
            gameData.handData
          ) {
            return await safeRespond(
              () =>
                interaction.reply({
                  content:
                    '❌ Ván Cào Nút đã bắt đầu, không thể tham gia nữa!',
                  ephemeral: true
                })
            );
          }

          // Đã tham gia
          if (
            gameData.players.has(
              userId
            )
          ) {
            return await safeRespond(
              () =>
                interaction.reply({
                  content:
                    '⚠️ Bạn đã tham gia ván Cào Nút này rồi!',
                  ephemeral: true
                })
            );
          }

          const betAmount =
            gameData.betAmount;

          const currentBalance =
            store.economyMap.get(
              userId
            ) || 0;

          // Không đủ tiền
          if (
            currentBalance <
            betAmount
          ) {
            return await safeRespond(
              () =>
                interaction.reply({
                  content:
                    `❌ Bạn không đủ số dư!\n\n` +
                    `💰 Tiền cược: **${betAmount.toLocaleString()} Mcoin**\n` +
                    `💳 Số dư của bạn: **${currentBalance.toLocaleString()} Mcoin**\n` +
                    `📉 Còn thiếu: **${(
                      betAmount -
                      currentBalance
                    ).toLocaleString()} Mcoin**`,
                  ephemeral: true
                })
            );
          }

          // =================================================
          // TRỪ TIỀN NGAY
          // =================================================

          store.economyMap.set(
            userId,
            currentBalance -
              betAmount
          );

          // =================================================
          // THÊM NGƯỜI CHƠI
          // =================================================

          gameData.players.set(
            userId,
            {
              username:
                interaction.user
                  .username,
              hand: []
            }
          );

          // =================================================
          // CẬP NHẬT EMBED
          // =================================================

          try {
            await interaction.deferUpdate();

            await interaction.message.edit({
              embeds: [
                buildCaoNutEmbed(
                  gameData
                )
              ],
              components: [
                buildCaoNutJoinRow()
              ]
            });
          } catch (err) {
            // Nếu update message thất bại,
            // hoàn tiền để tránh mất tiền.
            const balanceNow =
              store.economyMap.get(
                userId
              ) || 0;

            store.economyMap.set(
              userId,
              balanceNow +
                betAmount
            );

            gameData.players.delete(
              userId
            );

            console.error(
              '❌ Lỗi cập nhật ván Cào Nút:',
              err
            );

            return;
          }

          console.log(
            `🃏 ${interaction.user.username} đã tham gia Cào Nút ${gameMsgId}`
          );

          return;
        }

        // =================================================
        // CÀO NÚT - MỞ LÁ 3
        // =================================================

        if (
          buttonId.startsWith(
            'caonut_reveal_'
          )
        ) {
          const parts =
            buttonId.split('_');

          // caonut_reveal_GAMEID_USERID
          const gameMsgId =
            parts[2];

          const targetUserId =
            parts[3];

          // Chỉ chủ lá bài được mở
          if (
            userId !==
            targetUserId
          ) {
            return await safeRespond(
              () =>
                interaction.reply({
                  content:
                    '❌ Đây không phải lá bài của bạn!',
                  ephemeral: true
                })
            );
          }

          const gameData =
            store.activeCaoNutGames.get(
              gameMsgId
            );

          if (
            !gameData ||
            !gameData.handData ||
            !gameData.dmData
          ) {
            return await safeRespond(
              () =>
                interaction.reply({
                  content:
                    '❌ Ván Cào Nút này đã kết thúc hoặc chưa phát bài!',
                  ephemeral: true
                })
            );
          }

          const dmData =
            gameData.dmData.get(
              userId
            );

          if (
            !dmData
          ) {
            return;
          }

          if (
            dmData.revealed
          ) {
            return await safeRespond(
              () =>
                interaction.reply({
                  content:
                    '⚠️ Bạn đã mở lá thứ 3 rồi!',
                  ephemeral: true
                })
            );
          }

          const hand =
            gameData.handData.get(
              userId
            );

          if (
            !hand ||
            hand.length < 3
          ) {
            return;
          }

          dmData.revealed =
            true;

          const dmEmbed =
            new EmbedBuilder()
              .setColor(
                '#FF4F9A'
              )
              .setTitle(
                '🃏 THẺ CÀO NÚT CỦA BẠN'
              )
              .setDescription(
                `💳 **Lá 1:** ${hand[0].rank}${hand[0].suit}\n` +
                `💳 **Lá 2:** ${hand[1].rank}${hand[1].suit}\n` +
                `💳 **Lá 3:** ${hand[2].rank}${hand[2].suit} ✨\n\n` +
                `🎯 Bạn đã mở đủ 3 lá!`
              )
              .setFooter({
                text:
                  '🃏 Cào Nút 3 Lá'
              })
              .setTimestamp();

          try {
            await interaction.update({
              embeds: [
                dmEmbed
              ],
              components: []
            });
          } catch (err) {
            console.error(
              '❌ Lỗi mở lá 3:',
              err
            );
          }

          return;
        }

        // =================================================
        // TUNG XU - CHỌN NGỬA/SẤP
        // =================================================

        if (buttonId.startsWith('tx_multi_')) {
          await interaction.deferUpdate();

          const choice = buttonId.split('_')[2];
          const gameMsg = interaction.message;
          const gameData = store.activeTungXuGames.get(gameMsg.id);

          if (!gameData) {
            return await safeRespond(() =>
              interaction.followUp({ content: '❌ Ván Tung Xu này đã kết thúc!', ephemeral: true })
            );
          }

          if (gameData.players.has(userId)) {
            return await safeRespond(() =>
              interaction.followUp({ content: '⚠️ Bạn đã chọn rồi!', ephemeral: true })
            );
          }

          const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
          const modal = new ModalBuilder()
            .setCustomId(`tx_bet_${gameMsg.id}_${choice}`)
            .setTitle('💰 Nhập Tiền Cược');

          const betInput = new TextInputBuilder()
            .setCustomId('bet_amount')
            .setLabel('Số Mcoin cược')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('VD: 1000')
            .setRequired(true);

          const actionRow = new ActionRowBuilder().addComponents(betInput);
          modal.addComponents(actionRow);

          return await interaction.showModal(modal);
        }

        // =================================================
        // MA SÓI - JOIN
        // =================================================

        if (buttonId.startsWith('ms_join_')) {
          await interaction.deferUpdate();

          const gameMsgId = buttonId.split('_')[2];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) {
            return await safeRespond(() =>
              interaction.followUp({ content: '❌ Ván Ma Sói này đã kết thúc!', ephemeral: true })
            );
          }

          if (gameData.phase !== 'joining') {
            return await safeRespond(() =>
              interaction.followUp({ content: '❌ Ván Ma Sói đã bắt đầu!', ephemeral: true })
            );
          }

          if (gameData.participants.has(userId)) {
            return await safeRespond(() =>
              interaction.followUp({ content: '⚠️ Bạn đã tham gia rồi!', ephemeral: true })
            );
          }

          gameData.participants.set(userId, interaction.user.username);

          const embed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('🐺 SÒNG MA SÓI')
            .setDescription(
              `👥 **Người tham gia:** ${gameData.participants.size}\n` +
              `${[...gameData.participants.values()].map((name, i) => `> ${i + 1}. ${name}`).join('\n')}`
            )
            .setFooter({ text: 'Chờ phát triển...' });

          return await safeRespond(() =>
            interaction.message.edit({ embeds: [embed] })
          );
        }

        // =================================================
        // MA SÓI - SÓI CHỌN NẠN NHÂN
        // =================================================

        if (buttonId.startsWith('ms_wolf_')) {
          await interaction.deferUpdate();

          const parts = buttonId.split('_');
          const targetId = parts[2];
          const gameMsgId = parts[3];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) return;

          gameData.wolfVotes.set(userId, targetId);

          return await safeRespond(() =>
            interaction.followUp({
              content: `✅ Bạn đã bình chọn nạn nhân: **${gameData.participants.get(targetId)}**`,
              ephemeral: true
            })
          );
        }

        // =================================================
        // MA SÓI - BẢO VỆ CHỌN NGƯỜI
        // =================================================

        if (buttonId.startsWith('ms_guard_')) {
          await interaction.deferUpdate();

          const parts = buttonId.split('_');
          const targetId = parts[2];
          const gameMsgId = parts[3];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) return;

          gameData.guardTarget = targetId;

          return await safeRespond(() =>
            interaction.followUp({
              content: `✅ Bạn đã chọn bảo vệ: **${gameData.participants.get(targetId)}**`,
              ephemeral: true
            })
          );
        }

        // =================================================
        // MA SÓI - BÁC SĨ CHỌN NGƯỜI CỨU
        // =================================================

        if (buttonId.startsWith('ms_doctor_')) {
          await interaction.deferUpdate();

          const parts = buttonId.split('_');
          const targetId = parts[2];
          const gameMsgId = parts[3];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) return;

          gameData.doctorTarget = targetId;

          return await safeRespond(() =>
            interaction.followUp({
              content: `✅ Bạn đã chọn cứu: **${gameData.participants.get(targetId)}**`,
              ephemeral: true
            })
          );
        }

        // =================================================
        // MA SÓI - TIÊN TRI CHỌN NGƯỜI
        // =================================================

        if (buttonId.startsWith('ms_seer_')) {
          await interaction.deferUpdate();

          const parts = buttonId.split('_');
          const targetId = parts[2];
          const gameMsgId = parts[3];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) return;

          const { ROLE_META } = require('../games/masoi');
          const role = gameData.roles.get(targetId);
          const isWolf = role === 'soi';
          const rMeta = ROLE_META[role];

          gameData.seerActed = true;

          return await safeRespond(() =>
            interaction.followUp({
              content: `🔮 **${gameData.participants.get(targetId)}** là **${rMeta.label}** ${isWolf ? '🐺 **MA SÓI!**' : ''}`,
              ephemeral: true
            })
          );
        }

        // =================================================
        // MA SÓI - PHÙ THỦY CỨU NẠNHÂN
        // =================================================

        if (buttonId.startsWith('ms_witchheal_')) {
          await interaction.deferUpdate();

          const gameMsgId = buttonId.split('_')[2];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData || !gameData.wolfVictim) return;

          gameData.witchSavedVictim = true;
          gameData.witchHealUsed = true;

          return await safeRespond(() =>
            interaction.followUp({
              content: `💚 Bạn đã cứu: **${gameData.participants.get(gameData.wolfVictim)}**`,
              ephemeral: true
            })
          );
        }

        // =================================================
        // MA SÓI - PHÙ THỦY ĐỘC SAT MENU
        // =================================================

        if (buttonId.startsWith('ms_witchpoisonmenu_')) {
          await interaction.deferUpdate();

          const gameMsgId = buttonId.split('_')[3];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) return;

          const targets = [...gameData.alive];
          const rows = [];
          let row = new ActionRowBuilder();
          let count = 0;

          for (const uid of targets.slice(0, 25)) {
            if (count === 5) {
              rows.push(row);
              row = new ActionRowBuilder();
              count = 0;
            }
            const name = gameData.participants.get(uid) || 'Người chơi';
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(`ms_witchpoison_${uid}_${gameMsgId}`)
                .setLabel(name.slice(0, 80))
                .setStyle(ButtonStyle.Danger)
            );
            count++;
          }
          if (count > 0) rows.push(row);

          return await safeRespond(() =>
            interaction.followUp({
              content: '☠️ Chọn người để độc sát:',
              components: rows,
              ephemeral: true
            })
          );
        }

        // =================================================
        // MA SÓI - PHÙ THỦY ĐỘC SAT CONFIRM
        // =================================================

        if (buttonId.startsWith('ms_witchpoison_')) {
          await interaction.deferUpdate();

          const parts = buttonId.split('_');
          const targetId = parts[2];
          const gameMsgId = parts[3];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) return;

          gameData.witchPoisonTarget = targetId;
          gameData.witchPoisonUsed = true;

          return await safeRespond(() =>
            interaction.followUp({
              content: `☠️ Bạn đã độc sát: **${gameData.participants.get(targetId)}**`,
              ephemeral: true
            })
          );
        }

        // =================================================
        // MA SÓI - PHÙ THỦY BỎ QUA
        // =================================================

        if (buttonId.startsWith('ms_witchskip_')) {
          await interaction.deferUpdate();

          return await safeRespond(() =>
            interaction.followUp({
              content: '➡️ Bạn đã bỏ qua đêm nay.',
              ephemeral: true
            })
          );
        }

        // =================================================
        // MA SÓI - THỢ SĂN BẮN PHÁT SÚNG
        // =================================================

        if (buttonId.startsWith('ms_hunter_')) {
          await interaction.deferUpdate();

          const parts = buttonId.split('_');
          const targetId = parts[2];
          const gameMsgId = parts[3];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) return;

          gameData.hunterRevengeTarget = targetId;

          return await safeRespond(() =>
            interaction.followUp({
              content: `🏹 Thợ Săn đã chọn bắn: **${gameData.participants.get(targetId)}**`,
              ephemeral: true
            })
          );
        }

        // =================================================
        // MA SÓI - VOTE TREO CỔ
        // =================================================

        if (buttonId.startsWith('ms_vote_')) {
          await interaction.deferUpdate();

          const parts = buttonId.split('_');
          const targetId = parts[2];
          const gameMsgId = parts[3];
          const gameData = store.activeMaSoiGames.get(gameMsgId);

          if (!gameData) return;

          if (gameData.votes.has(userId)) {
            return await safeRespond(() =>
              interaction.followUp({
                content: '⚠️ Bạn đã vote rồi!',
                ephemeral: true
              })
            );
          }

          gameData.votes.set(userId, targetId);

          return await safeRespond(() =>
            interaction.followUp({
              content: `✅ Bạn đã vote: **${gameData.participants.get(targetId)}**`,
              ephemeral: true
            })
          );
        }

        return;

      // =====================================================
      // MODAL
      // Hiện tại Cào Nút KHÔNG dùng Modal.
      // .cn 3000 -> bấm Tham gia -> vào luôn.
      // =====================================================

      if (
        interaction.isModalSubmit()
      ) {
        // ✅ TUNG XU - NỘP TIỀN CƯỢC
        if (interaction.customId.startsWith('tx_bet_')) {
          await interaction.deferReply({ ephemeral: true });

          const parts = interaction.customId.split('_');
          const gameMsgId = parts[2];
          const choice = parts[3];

          const betAmount = parseInt(interaction.fields.getTextInputValue('bet_amount'));

          if (isNaN(betAmount) || betAmount <= 0) {
            return await safeRespond(() =>
              interaction.followUp({ content: '❌ Số tiền không hợp lệ!' })
            );
          }

          const gameData = store.activeTungXuGames.get(gameMsgId);
          if (!gameData) {
            return await safeRespond(() =>
              interaction.followUp({ content: '❌ Ván Tung Xu đã kết thúc!' })
            );
          }

          const balance = store.economyMap.get(userId) || 0;
          if (balance < betAmount) {
            return await safeRespond(() =>
              interaction.followUp({
                content: `❌ Bạn không đủ Mcoin!\n💰 Cần: ${betAmount.toLocaleString()} | Có: ${balance.toLocaleString()}`
              })
            );
          }

          // Trừ tiền ngay
          store.economyMap.set(userId, balance - betAmount);

          // Ghi nhận người chơi
          gameData.players.set(userId, {
            username: interaction.user.username,
            choice: choice,
            bet: betAmount
          });

          // Cộng game count
          const pDaily = store.getDailyData(userId);
          pDaily.games++;

          return await safeRespond(() =>
            interaction.followUp({
              content: `✅ Bạn đã cược **${betAmount.toLocaleString()} Mcoin** chọn **${choice.toUpperCase()}**!`
            })
          );
        }

        return;
      }

      // =====================================================
      // SLASH COMMAND
      // =====================================================

      if (
        !interaction.isChatInputCommand()
      ) {
        return;
      }

      const commandName =
        interaction.commandName;

      const isAdmin =
        interaction.member?.permissions?.has(
          PermissionFlagsBits.Administrator
        );

      // =====================================================
      // BACKUP
      // =====================================================

      if (
        commandName ===
        'backup'
      ) {
        if (!isAdmin) {
          return await safeRespond(
            () =>
              interaction.reply({
                content:
                  '❌ Bạn không có quyền sử dụng lệnh này!',
                ephemeral: true
              })
          );
        }

        const attachment =
          interaction.options.getAttachment(
            'file'
          );

        if (!attachment) {
          return await safeRespond(
            () =>
              interaction.reply({
                content:
                  '❌ Vui lòng cung cấp file backup!',
                ephemeral: true
              })
          );
        }

        try {
          const response =
            await fetch(
              attachment.url
            );

          const backupJson =
            await response.text();

          if (
            store.restoreBackupData(
              backupJson
            )
          ) {
            return await safeRespond(
              () =>
                interaction.reply({
                  content:
                    '✅ Khôi phục dữ liệu thành công!',
                  ephemeral: false
                })
            );
          }

          return await safeRespond(
            () =>
              interaction.reply({
                content:
                  '❌ File backup không hợp lệ!',
                ephemeral: true
              })
          );
        } catch (err) {
          console.error(
            '❌ Lỗi khôi phục backup:',
            err
          );

          return await safeRespond(
            () =>
              interaction.reply({
                content:
                  '❌ Lỗi khi khôi phục dữ liệu!',
                ephemeral: true
              })
          );
        }
      }

      // =====================================================
      // TAOCODE
      // =====================================================

      if (
        commandName ===
        'taocode'
      ) {
        if (!isAdmin) {
          return await safeRespond(
            () =>
              interaction.reply({
                content:
                  '❌ Bạn không có quyền sử dụng lệnh này!',
                ephemeral: true
              })
          );
        }

        const code =
          interaction.options
            .getString(
              'code'
            )
            .toLowerCase();

        const reward =
          interaction.options.getInteger(
            'reward'
          );

        const duration =
          interaction.options.getInteger(
            'duration'
          ) || 0;

        if (
          store.customCodesMap.has(
            code
          )
        ) {
          return await safeRespond(
            () =>
              interaction.reply({
                content:
                  '❌ Mã code này đã tồn tại rồi!',
                ephemeral: true
              })
          );
        }

        const expiresAt =
          duration > 0
            ? Date.now() +
              duration *
                60 *
                1000
            : null;

        store.customCodesMap.set(
          code,
          {
            reward,
            expiresAt
          }
        );

        const codeEmbed =
          new EmbedBuilder()
            .setColor(
              '#00FF00'
            )
            .setTitle(
              '✅ TẠO MÃ CODE THÀNH CÔNG'
            )
            .addFields(
              {
                name:
                  '🎟️ Mã Code',
                value:
                  `\`${code}\``,
                inline: true
              },
              {
                name:
                  '💰 Phần Thưởng',
                value:
                  `${reward.toLocaleString()} Mcoin`,
                inline: true
              },
              {
                name:
                  '⏰ Thời Hạn',
                value:
                  expiresAt
                    ? `<t:${Math.floor(
                        expiresAt /
                          1000
                      )}:R>`
                    : 'Vĩnh viễn',
                inline: true
              }
            )
            .setFooter({
              text:
                'Người chơi có thể dùng .nhapcode để nhập'
            })
            .setTimestamp();

        return await safeRespond(
          () =>
            interaction.reply({
              embeds: [
                codeEmbed
              ],
              ephemeral: false
            })
        );
      }

      // =====================================================
      // XOACODE
      // =====================================================

      if (
        commandName ===
        'xoacode'
      ) {
        if (!isAdmin) {
          return await safeRespond(
            () =>
              interaction.reply({
                content:
                  '❌ Bạn không có quyền sử dụng lệnh này!',
                ephemeral: true
              })
          );
        }

        const code =
          interaction.options
            .getString(
              'code'
            )
            .toLowerCase();

        if (
          !store.customCodesMap.has(
            code
          )
        ) {
          return await safeRespond(
            () =>
              interaction.reply({
                content:
                  '❌ Mã code không tồn tại!',
                ephemeral: true
              })
          );
        }

        store.customCodesMap.delete(
          code
        );

        return await safeRespond(
          () =>
            interaction.reply({
              content:
                `✅ Đã xóa mã code \`${code}\`!`,
              ephemeral: false
            })
        );
      }

      // =====================================================
      // SETBACKUP
      // =====================================================

      if (
        commandName ===
        'setbackup'
      ) {
        if (!isAdmin) {
          return await safeRespond(
            () =>
              interaction.reply({
                content:
                  '❌ Bạn không có quyền sử dụng lệnh này!',
                ephemeral: true
              })
          );
        }

        const channel =
          interaction.options.getChannel(
            'channel'
          );

        store.backupChannelId =
          channel.id;

        return await safeRespond(
          () =>
            interaction.reply({
              content:
                `✅ Đã cài đặt kênh backup: <#${channel.id}>`,
              ephemeral: false
            })
        );
      }

      // =====================================================
      // QUANLI
      // =====================================================

      if (
        commandName ===
        'quanli'
      ) {
        if (!isAdmin) {
          return await safeRespond(
            () =>
              interaction.reply({
                content:
                  '❌ Bạn không có quyền sử dụng lệnh quản lý này!',
                ephemeral: true
              })
          );
        }

        const targetUser =
          interaction.options.getUser(
            'user'
          );

        const amount =
          interaction.options.getString(
            'amount'
          );

        if (!targetUser) {
          return await safeRespond(
            () =>
              interaction.reply({
                content:
                  '❌ Vui lòng chỉ định người chơi!',
                ephemeral: true
              })
          );
        }

        if (!amount) {
          return await safeRespond(
            () =>
              interaction.reply({
                content:
                  '❌ Vui lòng nhập số tiền (VD: 50000 hoặc +50000 hoặc -50000)!',
                ephemeral: true
              })
          );
        }

        const currentBalance =
          store.economyMap.get(
            targetUser.id
          ) || 0;

        let newBalance =
          currentBalance;

        let operationType =
          'SET';

        if (
          amount.startsWith(
            '+'
          )
        ) {
          const addAmount =
            parseInt(
              amount.slice(1)
            );

          if (
            isNaN(
              addAmount
            )
          ) {
            return await safeRespond(
              () =>
                interaction.reply({
                  content:
                    '❌ Số tiền không hợp lệ!',
                  ephemeral: true
                })
            );
          }

          newBalance =
            currentBalance +
            addAmount;

          operationType =
            'ADD';
        } else if (
          amount.startsWith(
            '-'
          )
        ) {
          const subAmount =
            parseInt(
              amount.slice(1)
            );

          if (
            isNaN(
              subAmount
            )
          ) {
            return await safeRespond(
              () =>
                interaction.reply({
                  content:
                    '❌ Số tiền không hợp lệ!',
                  ephemeral: true
                })
            );
          }

          newBalance =
            Math.max(
              0,
              currentBalance -
                subAmount
            );

          operationType =
            'SUBTRACT';
        } else {
          const setAmount =
            parseInt(
              amount
            );

          if (
            isNaN(
              setAmount
            )
          ) {
            return await safeRespond(
              () =>
                interaction.reply({
                  content:
                    '❌ Số tiền không hợp lệ!',
                  ephemeral: true
                })
            );
          }

          newBalance =
            setAmount;

          operationType =
            'SET';
        }

        store.economyMap.set(
          targetUser.id,
          newBalance
        );

        const operationText =
          operationType ===
          'SET'
            ? `SET = ${newBalance.toLocaleString()}`
            : operationType ===
              'ADD'
              ? `+${(
                  newBalance -
                  currentBalance
                ).toLocaleString()}`
              : `-${(
                  currentBalance -
                  newBalance
                ).toLocaleString()}`;

        const resultEmbed =
          new EmbedBuilder()
            .setColor(
              '#00FF00'
            )
            .setTitle(
              '💰 QUẢN LÝ TIỀN - THAY ĐỔI THÀNH CÔNG'
            )
            .addFields(
              {
                name:
                  '👤 Người chơi',
                value:
                  `${targetUser.username} (${targetUser.id})`,
                inline: false
              },
              {
                name:
                  '💸 Loại thay đổi',
                value:
                  operationType,
                inline: true
              },
              {
                name:
                  '📊 Số dư cũ',
                value:
                  `**${currentBalance.toLocaleString()}** Mcoin`,
                inline: true
              },
              {
   ... (Còn 5 KB)
