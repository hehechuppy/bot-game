// jobs/rewardJob.js
const { CronJob } = require('cron');
const { EmbedBuilder } = require('discord.js');
const store = require('../store');

function startRewardJob(client) {

  // ========== TREO VOICE: MỖI 120 GIÂY NHẬN 1.000 - 5.000 MCOIN ==========
  new CronJob('*/120 * * * * *', async () => {
    try {
      // Duyệt tất cả người đang có dữ liệu voice
      for (const [userId, data] of store.voiceLeaderboardMap.entries()) {
        if (!data || data.startWeek !== store.voiceWeekStart) continue;

        // Random từ 1.000 -> 5.000 Mcoin
        const reward = Math.floor(Math.random() * 4001) + 1000;

        store.addTungXu(userId, reward);
      }
    } catch (err) {
      console.error('❌ Lỗi phát Mcoin treo voice:', err);
    }
  }, null, true, 'Asia/Ho_Chi_Minh');

  // ========== PHÁT THƯỞNG HÀNG NGÀY LÚC 0H (00:00) ==========
  // Gồm: Bảng xếp hạng Mcoin + Bảng xếp hạng Voice
  new CronJob('0 0 0 * * *', async () => {
    let allRewardsLog = [];

    // ========== PHÁT THƯỞNG BẢNG XẾP HẠNG MCOIN ==========
    if (store.economyMap.size > 0) {
      const sorted = Array.from(store.economyMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const mcoinRewards = [300000, 200000, 100000, 36000];

      for (let i = 0; i < sorted.length; i++) {
        const [uId] = sorted[i];
        const reward = mcoinRewards[i] || 36000;

        if (reward > 0) {
          store.addTungXu(uId, reward);

          allRewardsLog.push({
            type: 'mcoin',
            rank: i + 1,
            userId: uId,
            reward: reward,
            box: 0
          });
        }
      }
    }

    // ========== PHÁT THƯỞNG BẢNG XẾP HẠNG VOICE (+ LUCKY BOX) ==========
    const voiceTop10 = store.getVoiceLeaderboard(10);

    if (voiceTop10.length > 0) {
      const voiceRewards = [
        { mcoin: 300000, box: 2 },
        { mcoin: 200000, box: 1 },
        { mcoin: 100000, box: 0 },
        { mcoin: 36000, box: 0 }
      ];

      for (let i = 0; i < voiceTop10.length; i++) {
        const [uId] = voiceTop10[i];
        const rewardData = voiceRewards[i] || voiceRewards[3];

        store.addTungXu(uId, rewardData.mcoin);

        if (rewardData.box > 0) {
          store.addToInventory(uId, 6, rewardData.box);
        }

        allRewardsLog.push({
          type: 'voice',
          rank: i + 1,
          userId: uId,
          reward: rewardData.mcoin,
          box: rewardData.box
        });
      }
    }

    // ========== GỬI THÔNG BÁO VỀ CHANNEL BACKUP ==========
    if (store.backupChannelId && allRewardsLog.length > 0) {
      try {
        const channel = await client.channels.fetch(store.backupChannelId);

        if (channel) {
          // ========== BXH MCOIN ==========
          const mcoinRewards = allRewardsLog.filter(
            r => r.type === 'mcoin'
          );

          const voiceRewards = allRewardsLog.filter(
            r => r.type === 'voice'
          );

          if (mcoinRewards.length > 0) {
            const mcoinDesc = mcoinRewards.map(r => {
              return `• **Top ${r.rank}** (<@${r.userId}>): +${r.reward.toLocaleString()} Mcoin`;
            }).join('\n');

            const mcoinEmbed = new EmbedBuilder()
              .setColor('#FFD700')
              .setTitle('🏆 PHÁT THƯỞNG BẢNG XẾP HẠNG MCOIN (x2)')
              .setDescription(mcoinDesc)
              .setFooter({
                text: 'Tổng thưởng gấp đôi hôm nay!'
              });

            await channel.send({
              embeds: [mcoinEmbed]
            });
          }

          // ========== BXH VOICE ==========
          if (voiceRewards.length > 0) {
            const voiceDesc = voiceRewards.map(r => {
              const boxText =
                r.box > 0
                  ? ` + 🎁 ${r.box} Lucky Box`
                  : '';

              return `• **Top ${r.rank}** (<@${r.userId}>): +${r.reward.toLocaleString()} Mcoin${boxText}`;
            }).join('\n');

            const voiceEmbed = new EmbedBuilder()
              .setColor('#00BFFF')
              .setTitle('🎙️ PHÁT THƯỞNG BẢNG XẾP HẠNG VOICE (x2)')
              .setDescription(voiceDesc)
              .setFooter({
                text: 'Tổng thưởng gấp đôi hôm nay!'
              });

            await channel.send({
              embeds: [voiceEmbed]
            });
          }
        }
      } catch (e) {
        console.error(
          '❌ Lỗi khi gửi thông báo phát thưởng:',
          e
        );
      }
    }
  }, null, true, 'Asia/Ho_Chi_Minh');
}

module.exports = { startRewardJob };
