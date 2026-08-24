const store = require('../store');

// Lưu thời gian tham gia voice vào Map
if (!store.voiceJoinTime) {
  store.voiceJoinTime = new Map();
}

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const userId = newState.id || oldState.id;
    const member = newState.member || oldState.member;

    if (member?.user?.bot) return; // Bỏ qua bot

    const oldChannel = oldState.channelId;
    const newChannel = newState.channelId;

    // 1. NGƯỜI DÙNG VÀO VOICE (hoặc unmute/unstream nếu có kiểm tra)
    if (!oldChannel && newChannel) {
      store.voiceJoinTime.set(userId, Date.now());
      return;
    }

    // 2. NGƯỜI DÙNG RỜI VOICE
    if (oldChannel && !newChannel) {
      const joinTime = store.voiceJoinTime.get(userId);
      if (!joinTime) return;

      const timeSpentMs = Date.now() - joinTime;
      const minutesSpent = Math.floor(timeSpentMs / (1000 * 60)); // Số phút

      store.voiceJoinTime.delete(userId); // Xóa tracker

      if (minutesSpent >= 1) {
        const rewardPerMinute = 100; // Số Mcoin thưởng mỗi phút
        const totalReward = minutesSpent * rewardPerMinute;

        // Cộng tiền vào economyMap
        const currentBal = store.economyMap.get(userId) || 0;
        store.economyMap.set(userId, currentBal + totalReward);

        console.log(`🎙️ ${member.user.username} nhận ${totalReward} Mcoin cho ${minutesSpent} phút trong voice.`);
      }
    }
  }
};
