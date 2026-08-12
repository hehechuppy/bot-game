const { Client, GatewayIntentBits } = require('discord.js');
const messageHandler = require('./events/messageCreate');
const interactionHandler = require('./events/interactionCreate');
const readyHandler = require('./events/ready');
const backup = require('./backup');
const { startRewardJob } = require('./jobs/rewardJob');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // <-- Bắt buộc phải có dòng này để đọc lệnh dấu chấm
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates // <-- Bắt buộc phải có dòng này để đọc thành viên trong voice (cày xu voice)
    ]
});

// --- LƯỚI AN TOÀN: không cho lỗi chưa bắt làm sập toàn bộ bot ---
client.on('error', (err) => console.error('❌ Client error:', err));
process.on('unhandledRejection', (err) => console.error('❌ Unhandled rejection:', err));

// Đăng ký sự kiện Ready
client.once('ready', (...args) => readyHandler.execute(client, ...args));

// Đăng ký sự kiện đọc tin nhắn (xử lý các lệnh .tien, .daily, ...)
client.on('messageCreate', async (...args) => {
    try {
        await messageHandler.execute(client, ...args);
    } catch (err) {
        console.error('❌ Lỗi xử lý messageCreate:', err);
    }
});

// Đăng ký sự kiện tương tác nút bấm / slash command / modal
client.on('interactionCreate', async (...args) => {
    try {
        await interactionHandler.execute(client, ...args);
    } catch (err) {
        console.error('❌ Lỗi xử lý interactionCreate:', err);
    }
});

// Chạy backup và các tính năng ngầm
backup.initBackupHandlers(client);
startRewardJob(client);

// Đăng nhập bot
client.login(process.env.DISCORD_TOKEN);
