// events/ready.js
const store = require('../store');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Bot đã đăng nhập thành công: ${client.user.tag}`);

    // --- CÀY XU VOICE: mỗi 30 giây, ai đang ở kênh voice (không phải bot) sẽ nhận random Mcoin ---
    // Nếu đang có buff X2 Voice, số Mcoin nhận được sẽ nhân đôi.
    setInterval(() => {
      client.guilds.cache.forEach(guild => {
        guild.channels.cache.filter(c => c.isVoiceBased()).forEach(channel => {
          channel.members.forEach(member => {
            if (!member.user.bot) {
              const baseEarned = Math.floor(Math.random() * 401) + 100; // random 100 -> 500
              const multiplier = store.getVoiceMultiplier(member.id);
              const earned = baseEarned * multiplier;
              store.addTungXu(member.id, earned);
            }
          });
        });
      });
    }, 30000);
  },
};
