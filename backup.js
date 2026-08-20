// backup.js
const store = require('./store');
const { AttachmentBuilder } = require('discord.js');

let backupInterval = null; // Lưu intervalId để có thể cancel nếu cần

async function sendEmergencyBackup(client) {
  if (!store.backupChannelId) {
    console.warn('⚠️ Backup channel ID chưa được thiết lập!');
    return;
  }
  try {
    const channel = await client.channels.fetch(store.backupChannelId);
    if (!channel) {
      console.error('❌ Không tìm thấy backup channel:', store.backupChannelId);
      return;
    }
    
    const backupData = store.generateBackupData();
    const buffer = Buffer.from(backupData, 'utf-8');
    const timestamp = new Date().toISOString();
    const attachment = new AttachmentBuilder(buffer, { name: `backup-${Date.now()}.json` });
    
    await channel.send({ 
      content: `⚠️ **CẢNH BÁO: Backup khẩn cấp** — ${timestamp}`, 
      files: [attachment] 
    });
    
    console.log('✅ Backup khẩn cấp đã gửi:', timestamp);
  } catch (e) {
    console.error('❌ Không thể gửi backup khẩn cấp:', e.message);
  }
}

async function sendPeriodicBackup(client, intervalMs = 30 * 60 * 1000) {
  if (!store.backupChannelId) {
    console.warn('⚠️ Backup channel ID chưa được thiết lập, bỏ qua periodic backup!');
    return;
  }

  const sendBackup = async () => {
    try {
      const channel = await client.channels.fetch(store.backupChannelId);
      if (!channel) return;

      const backupData = store.generateBackupData();
      const buffer = Buffer.from(backupData, 'utf-8');
      const timestamp = new Date().toISOString();
      const attachment = new AttachmentBuilder(buffer, { name: `backup-${Date.now()}.json` });

      await channel.send({
        content: `📦 **Periodic Backup** — ${timestamp}`,
        files: [attachment]
      });

      console.log(`✅ Periodic backup thành công: ${timestamp}`);
    } catch (e) {
      console.error('❌ Lỗi khi gửi periodic backup:', e.message);
    }
  };

  // Gửi ngay lần đầu
  console.log('⏳ Gửi periodic backup lần đầu...');
  await sendBackup();

  // Sau đó gửi mỗi intervalMs
  backupInterval = setInterval(sendBackup, intervalMs);
  console.log(`✅ Periodic backup được kích hoạt mỗi ${(intervalMs / 1000 / 60).toFixed(0)} phút`);
}

function initBackupHandlers(client) {
  // Backup khi bot shutdown (SIGINT, SIGTERM)
  process.on('SIGINT', async () => {
    console.log('⚠️ SIGINT nhận được, gửi backup khẩn cấp...');
    if (backupInterval) clearInterval(backupInterval);
    await sendEmergencyBackup(client);
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('⚠️ SIGTERM nhận được, gửi backup khẩn cấp...');
    if (backupInterval) clearInterval(backupInterval);
    await sendEmergencyBackup(client);
    process.exit(0);
  });

  // Lỗi uncaught
  process.on('uncaughtException', async (err) => {
    console.error('💥 Uncaught Exception:', err);
    await sendEmergencyBackup(client);
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    console.error('💥 Unhandled Rejection:', reason);
    await sendEmergencyBackup(client);
  });

  console.log('✅ Backup handlers khởi tạo');
}

// ✅ SETUP HOÀN CHỈNH - chỉ cần gọi 1 lần
async function setupBackup(client, periodicIntervalMs = 30 * 60 * 1000) {
  console.log('🔧 Đang setup backup system...');
  initBackupHandlers(client);
  await sendPeriodicBackup(client, periodicIntervalMs);
}

module.exports = { 
  initBackupHandlers, 
  sendEmergencyBackup,
  sendPeriodicBackup,
  setupBackup
};
