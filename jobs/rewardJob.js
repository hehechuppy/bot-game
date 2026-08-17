// jobs/rewardJob.js
const { CronJob } = require('cron');
const { EmbedBuilder } = require('discord.js');
const store = require('../store');

function startRewardJob(client) {
  new CronJob('0 0 0 * * *', async () => {
    if (store.economyMap.size === 0) return;

    const sorted = Array.from(store.economyMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    let rewardLog = [];

    for (let i = 0; i < sorted.length; i++) {
      const [uId] = sorted[i];
      let reward = 0;
      if (i === 0) reward = 50000;
      else if (i === 1) reward = 20000;
      else if (i === 2) reward = 10000;
      else reward = 367;

      if (reward > 0) {
        store.addTungXu(uId, reward);
        rewardLog.push(`• **Top ${i + 1}** (<@${uId}>): +${reward.toLocaleString()}$`);
      }
    }

    if (store.backupChannelId) {
      try {
        const channel = await client.channels.fetch(store.backupChannelId);
        if (channel) {
          const rewardEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 TỔNG KẾT VÀ PHÁT THƯỞNG BẢNG XẾP HẠNG HÀNG NGÀY')
            .setDescription('Hệ thống đã tự động trao thưởng cho các vị trí dẫn đầu:\n\n' + rewardLog.join('\n'));
          await channel.send({ embeds: [rewardEmbed] });
        }
      } catch (e) {
        console.error('Không thể gửi thông báo phát thưởng BXH:', e);
      }
    }
  }, null, true, 'Asia/Ho_Chi_Minh');
}

module.exports = { startRewardJob };
