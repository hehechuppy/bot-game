// jobs/rewardJob.js
const { EmbedBuilder } = require('discord.js');
const store = require('../store');

// ID kênh thông báo phát thưởng
const REWARD_CHANNEL_ID = '1542696708712955904';

// Cấu hình phần thưởng XH Mcoin
const XH_REWARDS = [
    { rank: 1, mcoin: 300000 },
    { rank: 2, mcoin: 200000 },
    { rank: 3, mcoin: 100000 },
    { rank: 4, mcoin: 36000 },
    { rank: 5, mcoin: 36000 },
    { rank: 6, mcoin: 36000 },
    { rank: 7, mcoin: 36000 },
    { rank: 8, mcoin: 36000 },
    { rank: 9, mcoin: 36000 },
    { rank: 10, mcoin: 36000 },
];

function startRewardJob(client) {
    // Kiểm tra mỗi phút xem đã đến 00:00 chưa
    setInterval(async () => {
        const now = new Date();

        // Chỉ chạy lúc 00:00 (giờ = 0, phút = 0)
        if (now.getHours() !== 0 || now.getMinutes() !== 0) return;

        try {
            await payXHRewards(client);
        } catch (err) {
            console.error('❌ Lỗi phát thưởng XH Mcoin:', err);
        }
    }, 60 * 1000); // Kiểm tra mỗi phút

    console.log('✅ RewardJob đã khởi động - phát thưởng XH lúc 00:00 mỗi ngày');
}

async function payXHRewards(client) {
    // Lấy kênh thông báo
    const channel = await client.channels.fetch(REWARD_CHANNEL_ID).catch(() => null);
    if (!channel) {
        console.error(`❌ Không tìm thấy kênh ${REWARD_CHANNEL_ID}`);
        return;
    }

    // Lấy guildId từ kênh
    const guildId = channel.guildId;

    // Lọc top 10 người có nhiều Mcoin nhất trong server này
    const prefix = `${guildId}_`;
    const guildEntries = Array.from(store.economyMap.entries())
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, balance]) => ({
            userId: key.slice(prefix.length),
            balance
        }))
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 10);

    if (guildEntries.length === 0) {
        console.log('⚠️ Không có ai trong bảng XH Mcoin, bỏ qua phát thưởng');
        return;
    }

    // Phát thưởng + lấy tên người dùng
    const lines = [];
    for (let i = 0; i < guildEntries.length; i++) {
        const { userId, balance } = guildEntries[i];
        const reward = XH_REWARDS[i] || { mcoin: 36000 };

        // Cộng tiền thưởng
        store.addTungXu(guildId, userId, reward.mcoin);

        // Lấy tên hiển thị (username) - fetch từ Discord
        let displayName = `User_${userId.slice(-4)}`;
        try {
            const user = await client.users.fetch(userId);
            displayName = user.displayName || user.username || displayName;
        } catch (e) { /* Bỏ qua nếu không fetch được */ }

        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**Top ${i + 1}**`;
        lines.push(`• ${medal} **${displayName}**: +${reward.mcoin.toLocaleString()} Mcoin`);
    }

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 PHÁT THƯỞNG BẢNG XẾP HẠNG MCOIN')
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'Chúc mừng những người chơi xuất sắc nhất!' })
        .setTimestamp();

    await channel.send({ embeds: [embed] });
    console.log(`✅ Đã phát thưởng XH Mcoin cho ${guildEntries.length} người`);
}

module.exports = { startRewardJob };
