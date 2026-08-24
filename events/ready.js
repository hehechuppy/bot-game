// events/ready.js - Chỉnh xhvoice: ngày + reward 1000-3000/60s
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
        ),

      new SlashCommandBuilder()
        .setName('quanli')
        .setDescription('💰 Quản lý tiền người chơi (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addUserOption(option =>
          option.setName('user').setDescription('Chọn người chơi').setRequired(true)
        )
        .addStringOption(option =>
          option.setName('amount').setDescription('Số tiền (VD: 50000, +50000, -50000)').setRequired(true).setPlaceholder('50000 hoặc +50000 hoặc -50000')
        ),

      new SlashCommandBuilder()
        .setName('tangqua')
        .setDescription('🎁 Tặng vật phẩm cho người chơi (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addUserOption(option =>
          option.setName('user').setDescription('Chọn người nhận quà').setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('item').setDescription('ID vật phẩm (VD: 6=Lucky Box, 1=X3 Mcoin)').setRequired(true).setMinValue(1)
        )
        .addIntegerOption(option =>
          option.setName('quantity').setDescription('Số lượng').setRequired(true).setMinValue(1)
        )
    ];

    try {
      await client.application.commands.set(commands);
      console.log('✅ Đã đăng ký thành công 6 slash commands (Admin)');
    } catch (err) {
      console.error('❌ Lỗi đăng ký slash commands:', err);
    }

    // ================= TREO VOICE: CÀY MCOIN =================
    // Mỗi 60 giây, kiểm tra ai đang ở kênh voice
    // Cộng random 1000-3000 Mcoin + 60 giây thời gian voice ngày
    setInterval(async () => {
      try {
        for (const [guildId, guild] of client.guilds.cache) {
          for (const [channelId, channel] of guild.channels.cache) {
            if (!channel.isVoiceBased()) continue;

            for (const [memberId, member] of channel.members) {
              if (member.user.bot) continue;

              // Cộng Mcoin (1000-3000, nhân 2 nếu có buff)
              const baseEarned = Math.floor(Math.random() * 2001) + 1000; // 1000-3000
              const multiplier = store.getVoiceMultiplier(member.id);
              const earned = baseEarned * multiplier;
              store.addTungXu(member.id, earned);

              // Cộng thời gian voice (60 giây mỗi 60 giây tick)
              store.addVoiceTime(member.id, 60);
            }
          }
        }
      } catch (err) {
        console.error('❌ Lỗi cộng voice Mcoin:', err);
      }
    }, 60000); // 60 giây

    // ================= RESET BẢNG VOICE NGÀY (00:00 UTC) =================
    // Kiểm tra mỗi phút xem đã sang ngày mới chưa
    // Nếu có, phát thưởng top 1-10 và reset bảng
    setInterval(async () => {
      try {
        const winners = await store.checkAndResetVoiceDaily();
        if (winners && winners.length > 0) {
          const desc = winners.map(w => {
            const hours = Math.floor(w.seconds / 3600);
            const mins = Math.floor((w.seconds % 3600) / 60);
            const boxText = w.box > 0 ? ` + 🎁 ${w.box} Lucky Box` : '';
            return `**#${w.rank}** — <@${w.userId}> (⏱️ ${hours}h${mins}m)\n💰 +${w.mcoin.toLocaleString()} Mcoin${boxText}`;
          }).join('\n\n');

          const resultEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 KẾT QUẢ BẢNG XẾP HẠNG VOICE HÔM NAY')
            .setDescription(desc)
            .setFooter({ text: 'Bảng xếp hạng đã được reset cho ngày mới!' })
            .setTimestamp();

          for (const [guildId, guild] of client.guilds.cache) {
            if (guild.systemChannel) {
              guild.systemChannel.send({ embeds: [resultEmbed] }).catch(() => {});
            }
          }

          console.log('✅ Phát thưởng voice ngày và reset bảng xếp hạng');
        }
      } catch (err) {
        console.error('❌ Lỗi reset/phát thưởng voice:', err);
      }
    }, 60000); // Kiểm tra mỗi phút
  },
};
