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

        return;
      }

      // =====================================================
      // MODAL
      // Hiện tại Cào Nút KHÔNG dùng Modal.
      // .cn 3000 -> bấm Tham gia -> vào luôn.
      // =====================================================

      if (
        interaction.isModalSubmit()
      ) {
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
                name:
                  '📊 Số dư mới',
                value:
                  `**${newBalance.toLocaleString()}** Mcoin`,
                inline: true
              },
              {
                name:
                  '🔄 Thay đổi',
                value:
                  operationText,
                inline: true
              },
              {
                name:
                  '👨‍💼 Người thực hiện',
                value:
                  interaction.user
                    .username,
                inline: true
              }
            )
            .setTimestamp();

        return await safeRespond(
          () =>
            interaction.reply({
              embeds: [
                resultEmbed
              ],
              ephemeral: false
            })
        );
      }

      // =====================================================
      // TANGQUA
      // =====================================================

      if (
        commandName ===
        'tangqua'
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

        const targetUser =
          interaction.options.getUser(
            'user'
          );

        const itemId =
          interaction.options.getInteger(
            'item'
          );

        const quantity =
          interaction.options.getInteger(
            'quantity'
          );

        if (!targetUser) {
          return await safeRespond(
            () =>
              interaction.reply({
                content:
                  '❌ Vui lòng chỉ định người nhận!',
                ephemeral: true
              })
          );
        }

        const item =
          store.SHOP_ITEMS.find(
            i =>
              i.id ===
              itemId
          );

        if (!item) {
          return await safeRespond(
            () =>
              interaction.reply({
                content:
                  `❌ Không tìm thấy vật phẩm ID ${itemId}!`,
                ephemeral: true
              })
          );
        }

        if (
          quantity <= 0
        ) {
          return await safeRespond(
            () =>
              interaction.reply({
                content:
                  '❌ Số lượng phải lớn hơn 0!',
                ephemeral: true
              })
          );
        }

        store.addToInventory(
          targetUser.id,
          itemId,
          quantity
        );

        const giftEmbed =
          new EmbedBuilder()
            .setColor(
              '#FF69B4'
            )
            .setTitle(
              '🎁 TẶNG VẬT PHẨM - THÀNH CÔNG'
            )
            .addFields(
              {
                name:
                  '🎉 Người Nhận',
                value:
                  `${targetUser.username}`,
                inline: true
              },
              {
                name:
                  '📦 Vật Phẩm',
                value:
                  `${item.name} (ID: ${item.id})`,
                inline: true
              },
              {
                name:
                  '📊 Số Lượng',
                value:
                  `**${quantity}** cái`,
                inline: true
              },
              {
                name:
                  '💰 Giá Trị',
                value:
                  `${(
                    item.price *
                    quantity
                  ).toLocaleString()} Mcoin`,
                inline: true
              },
              {
                name:
                  '👨‍💼 Người Tặng',
                value:
                  interaction.user
                    .username,
                inline: true
              }
            )
            .setFooter({
              text:
                'Vật phẩm đã được thêm vào kho của người nhận'
            })
            .setTimestamp();

        return await safeRespond(
          () =>
            interaction.reply({
              embeds: [
                giftEmbed
              ],
              ephemeral: false
            })
        );
      }

      return;

    } catch (err) {
      console.error(
        '❌ Lỗi interactionCreate:',
        err
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        return await safeRespond(
          () =>
            interaction.reply({
              content:
                '❌ Đã xảy ra lỗi khi xử lý thao tác này.',
              ephemeral: true
            })
        );
      }
    }
  }
};
