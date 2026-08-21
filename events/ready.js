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
          option.setName('reward').setDescription('Số Mcoin làm phần thưởng').setRequired(true).setMinValue(1)
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
        .setDescription('📁 Cài đặt kênh lưu tự động backup (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addChannelOption(option =>
          option.setName('channel').setDescription('Kênh để lưu backup').setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName('tangqua')
        .setDescription('🎁 Tặng vật phẩm cho người chơi (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('Chọn người nhận quà')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('item')
            .setDescription('ID vật phẩm (VD: 6 = Lucky Box, 1 = X3 Mcoin)')
            .setRequired(true)
            .setMinValue(1)
        )
        .addIntegerOption(option =>
          option
            .setName('quantity')
            .setDescription('Số lượng vật phẩm')
            .setRequired(true)
            .setMinValue(1)
        ),

      new SlashCommandBuilder()
        .setName('backup')
        .setDescription('💾 Khôi phục dữ liệu từ file backup (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addAttachmentOption(option =>
          option.setName('file').setDescription('File JSON backup').setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName('quanli')
        .setDescription('💰 Chỉnh sửa số dư Mcoin của người chơi (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addUserOption(option =>
          option.setName('target').setDescription('Người chơi cần chỉnh sửa').setRequired(true)
        )
        .addStringOption(option =>
          option.setName('action').setDescription('Hành động').setRequired(true)
            .addChoices(
              { name: 'Đặt số dư thành (set)', value: 'set' },
              { name: 'Cộng thêm (add)', value: 'add' },
              { name: 'Trừ bớt (subtract)', value: 'subtract' }
            )
        )
        .addIntegerOption(option =>
          option.setName('amount').setDescription('Số Mcoin').setRequired(true).setMinValue(0)
        )
        .addStringOption(option =>
          option.setName('reason').setDescription('Lý do chỉnh sửa (không bắt buộc)').setRequired(false)
        )
    ];

    try {
      await client.application.commands.set(commands);
      console.log(`✅ Đã đăng ký thành công ${commands.length} slash commands (Admin)`);
    } catch (err) {
      console.error('❌ Lỗi khi đăng ký slash commands:', err);
    }

    // ================= CÀY XU VOICE =================
    // Vòng lặp chạy định kỳ mỗi 60 giây (1 phút):
    // 1. Quét tất cả phòng voice trong server để phát thưởng Mcoin ngẫu nhiên & cộng 60 giây thời gian treo.
    // 2. Kiểm tra chuyển ngày mới để tính toán, tự động phát thưởng x2 cho Top 1-10 và reset bảng xếp hạng.
    setInterval(async () => {
      client.guilds.cache.forEach(guild => {
        guild.channels.cache.filter(c => c.isVoiceBased()).forEach(channel => {
          channel.members.forEach(member => {
            if (!member.user.bot) {
              // Thưởng ngẫu nhiên từ 1,000 - 5,000 Mcoin cơ bản
              const baseEarned = Math.floor(Math.random() * 4001) + 1000;
              const multiplier = store.getVoiceMultiplier(member.id);
              const earned = baseEarned * multiplier;
              store.addTungXu(member.id, earned);

              // Cộng 60 giây vào tổng thời gian Voice
              store.addVoiceTime(member.id, 60);
            }
          });
        });
      });

      // Tự động kiểm tra reset theo ngày và thông báo trao thưởng
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
    }, 60000); // 60,000ms = 1 phút
  },
};
