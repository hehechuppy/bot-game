// events/ready.js
const store = require('../store');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Bot đã đăng nhập thành công: ${client.user.tag}`);

    // Nếu cần đăng lệnh global/guild, đặt logic ở đây hoặc dùng file register-commands.js
    // Example: client.application.commands.set([...])

    // --- CÀY XU VOICE: mỗi 30 giây, ai đang ở kênh voice (không phải bot) sẽ nhận random Mcoin ---
    setInterval(() => {
      client.guilds.cache.forEach(guild => {
        guild.channels.cache.filter(c => c.isVoiceBased()).forEach(channel => {
          channel.members.forEach(member => {
            if (!member.user.bot) {
              const earned = Math.floor(Math.random() * 401) + 100; // random 100 -> 500
              store.addTungXu(member.id, earned);
            }
          });
        });
      });
    }, 30000);
  },
};