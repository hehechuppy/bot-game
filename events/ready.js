// events/ready.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const store = require('../store');
module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Bot đã đăng nhập thành công: ${client.user.tag}`);
    // --- ĐĂNG KÝ SLASH COMMANDS ---
    const commands = [
      new SlashCommandBuilder()
        .setName('taocode')
        .setDescription('🎟️ Tạo một mã code mới (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addStringOption(option =>
          option.setName('code').setDescription('Tên mã code').setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('reward').setDescription('Số Mcoin để phần thưởng').setRequired(true).setMinValue(1)
        )
        .addIntegerOption(option =>
          option.setName('duration').setDescription('Thời hạn (phút), 0 = vĩnh viễn').setRequired(false).setMinValue(0)
        ),

      new SlashCommandBuilder()
        .setName('xoacode')
        .setDescription('🗑️ Xóa một mã code (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addStringOption(option =>
          option.setName('code').setDescription('Tên mã code cần xóa').setRequired(true).setAutocomplete(true)
        ),

      new SlashCommandBuilder()
        .setName('setbackup')
        .setDescription('📁 Cài đặt kênh backup (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addChannelOption(option =>
          option.setName('channel').setDescription('Kênh để lưu backup').setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName('backup')
        .setDescription('💾 Khôi phục dữ liệu từ file (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addAttachmentOption(option =>
          option.setName('file').setDescription('File JSON backup').setRequired(true)
        )
    ];
    try {
      await client.application.commands.set(commands);
      console.log('✅ Đã đăng ký 4 slash commands (admin)');
    } catch (err) {
      console.error('❌ Lỗi đăng ký slash commands:', err);
    }
    // --- CÀY XU VOICE: mỗi 60 giây, ai đang ở kênh voice (không phải bot) sẽ nhận random Mcoin ---
    // Nếu đang có buff X2 Voice, số Mcoin nhận được sẽ nhân đôi.
    // Đồng thời cộng dồn thời gian voice cho bảng xếp hạng .xhvoice (reset + phát thưởng hàng tuần).
    setInterval(async () => {
      client.guilds.cache.forEach(guild => {
        guild.channels.cache.filter(c => c.isVoiceBased()).forEach(channel => {
          channel.members.forEach(member => {
            if (!member.user.bot) {
              const baseEarned = Math.floor(Math.random() * 4001) + 1000; // random 1000 -> 5000
              const multiplier = store.getVoiceMultiplier(member.id);
              const earned = baseEarned * multiplier;
              store.addTungXu(member.id, earned);

              // Cộng thêm 30 giây vào thời gian voice tuần này
              store.addVoiceTime(member.id, 60);
            }
          });
        });
      });

      // Kiểm tra xem đã sang tuần mới chưa -> nếu có, tự động phát thưởng top 1-10 và reset bảng
      try {
        const winners = await store.checkAndResetVoiceWeek();
        if (winners && winners.length > 0) {
          const desc = winners.map(w => {
            const hours = Math.floor(w.seconds / 3600);
            const mins = Math.floor((w.seconds % 3600) / 60);
            const boxText = w.box > 0 ? ` + 🎁 ${w.box} Lucky Box` : '';
            return `**#${w.rank}** — <@${w.userId}> (⏱️ ${hours}h${mins}m)\n💰 +${w.mcoin.toLocaleString()} Mcoin${boxText}`;
          }).join('\n\n');

          const resultEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 KẾT QUẢ BẢNG XẾP HẠNG VOICE TUẦN NÀY')
            .setDescription(desc)
            .setFooter({ text: 'Bảng xếp hạng đã được reset cho tuần mới!' })
            .setTimestamp();

          client.guilds.cache.forEach(guild => {
            if (guild.systemChannel) {
              guild.systemChannel.send({ embeds: [resultEmbed] }).catch(() => {});
            }
          });
        }
      } catch (err) {
        console.error('❌ Lỗi khi reset/phát thưởng bảng xếp hạng voice:', err);
      }
    }, 30000);
  },
};
