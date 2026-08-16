// events/ready.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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
