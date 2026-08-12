// backup.js
const store = require('./store');
const { AttachmentBuilder } = require('discord.js');

async function sendEmergencyBackup(client) {
  if (!store.backupChannelId) return;
  try {
    const channel = await client.channels.fetch(store.backupChannelId);
    if (!channel) return;
    const buffer = Buffer.from(store.generateBackupData(), 'utf-8');
    const attachment = new AttachmentBuilder(buffer, { name: `backup-${Date.now()}.json` });
    await channel.send({ content: '⚠️ **CẢNH BÁO: Backup khẩn cấp**', files: [attachment] });
  } catch (e) {
    console.error('Không thể gửi backup khẩn cấp:', e);
  }
}

function initBackupHandlers(client) {
  process.on('SIGINT', async () => { await sendEmergencyBackup(client); process.exit(0); });
  process.on('SIGTERM', async () => { await sendEmergencyBackup(client); process.exit(0); });
}

module.exports = { initBackupHandlers, sendEmergencyBackup };