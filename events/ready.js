const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const store = require('../store');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Bot đã đăng nhập thành công: ${client.user.tag}`);

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
        .setDescription('💰 Chỉnh sửa số dư Mcoin của người chơi (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addUserOption(option =>
          option.setName('target').setDescription('Người chơi cần chỉnh').setRequired(true)
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
          option.setName('amount').setDescription('Số tiền').setRequired(true).setMinValue(0)
        )
        .addStringOption(option =>
          option.setName('reason').setDescription('Lý do thay đổi').setRequired(false)
        )
    ];

    try {
      await client.application.commands.set(commands);
      console.log('✅ Đã cập nhật Slash Commands toàn cục thành công!');
    } catch (error) {
      console.error('❌ Lỗi khi đăng ký Slash Commands:', error);
    }

    // --- KHỞI TẠO TIẾN TRÌNH PERIODIC BACKUP (MỖI 30 PHÚT) ---
    setInterval(async () => {
      try {
        if (!store.backupChannelId) return;

        const channel = await client.channels.fetch(store.backupChannelId).catch(() => null);
        if (!channel) return;

        const backupData = store.exportData ? store.exportData() : {
          economy: Array.from(store.economyMap.entries()),
          dailyData: Array.from(store.dailyDataMap.entries()),
          usedCodes: Array.from(store.usedCodesMap.entries()).map(([k, v]) => [k, Array.from(v)]),
          customCodes: Array.from(store.customCodesMap.entries()),
          leaderboard: Array.from(store.leaderboardMap.entries()),
          backupChannelId: store.backupChannelId
        };

        const jsonBuffer = Buffer.from(JSON.stringify(backupData, null, 2), 'utf-8');
        const attachment = new AttachmentBuilder(jsonBuffer, { name: `backup_${Date.now()}.json` });

        await channel.send({
          content: `✅ Periodic backup thành công: ${new Date().toISOString()}`,
          files: [attachment]
        });
      } catch (err) {
        console.error('❌ Lỗi tiến trình auto backup:', err);
      }
    }, 30 * 60 * 1000);

    console.log('✅ Periodic backup được kích hoạt mỗi 30 phút');
  }
};
