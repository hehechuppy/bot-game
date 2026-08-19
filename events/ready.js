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

    // ========== CÀY XU VOICE: MỖI 1 PHÚT CỘNG THÊM 60 GIÂY ==========
    // Ai đang ở voice sẽ nhận random Mcoin + cộng voice time
    // Nếu cùng phút sẽ đứng cùng top nhau
    // Mỗi 0h sẽ phát thưởng x2 cho cả .xhvoice và .xh
    setInterval(async () => {
      client.guilds.cache.forEach(guild => {
        guild.channels.cache.filter(c => c.isVoiceBased()).forEach(channel => {
          channel.members.forEach(member => {
            if (!member.user.bot) {
              // Nhận random Mcoin (1000-5000)
              const baseEarned = Math.floor(Math.random() * 4001) + 1000;
              const multiplier = store.getVoiceMultiplier(member.id);
              const earned = baseEarned * multiplier;
              store.addTungXu(member.id, earned);

              // Cộng 60 giây (1 phút) vào thời gian voice hằng ngày
              store.addVoiceTime(member.id, 60);
            }
          });
        });
      });

      // Kiểm tra xem đã sang ngày mới chưa -> nếu có, tự động phát thưởng top 1-10 (x2) và reset bảng
      try {
        const result = await store.checkAndResetVoiceDay();
        if (result && result.winners && result.winners.length > 0) {
          const desc = result.winners.map(w => {
            const hours = Math.floor(w.seconds / 3600);
            const mins = Math.floor((w.seconds % 3600) / 60);
            const boxText = w.box > 0 ? ` + 🎁 ${w.box} Lucky Box` : '';
            return `**#${w.rank}** — <@${w.userId}> (⏱️ ${hours}h${mins}m)\n💰 +${w.mcoin.toLocaleString()} Mcoin${boxText}`;
          }).join('\n\n');

          const voiceEmbed = new EmbedBuilder()
            .setColor('#00BFFF')
            .setTitle('🎙️ KẾT QUẢ BẢNG XẾP HẠNG VOICE HÔM NAY (x2 THƯỞNG)')
            .setDescription(desc)
            .setFooter({ text: 'Bảng xếp hạng đã được reset cho ngày mới!' })
            .setTimestamp();

          client.guilds.cache.forEach(guild => {
            if (guild.systemChannel) {
              guild.systemChannel.send({ embeds: [voiceEmbed] }).catch(() => {});
            }
          });
        }
      } catch (err) {
        console.error('❌ Lỗi khi reset/phát thưởng bảng xếp hạng voice:', err);
      }
    }, 60000); // 60 giây = 1 phút
  },
};
