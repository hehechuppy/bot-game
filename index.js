const { Client, GatewayIntentBits } = require('discord.js');
const messageHandler = require('./events/messageCreate');
const interactionHandler = require('./events/interactionCreate');
const readyHandler = require('./events/ready');
const backup = require('./backup');
const { startRewardJob } = require('./jobs/rewardJob.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.on('error', (err) => console.error('❌ Client error:', err));
process.on('unhandledRejection', (err) => console.error('❌ Unhandled rejection:', err));

client.once('ready', (...args) => readyHandler.execute(client, ...args));

client.on('messageCreate', async (...args) => {
    try {
        await messageHandler.execute(client, ...args);
    } catch (err) {
        console.error('❌ Lỗi xử lý messageCreate:', err);
    }
});

client.on('interactionCreate', async (...args) => {
    try {
        await interactionHandler.execute(client, ...args);
    } catch (err) {
        console.error('❌ Lỗi xử lý interactionCreate:', err);
    }
});

backup.initBackupHandlers(client);
startRewardJob(client);

client.login(process.env.DISCORD_TOKEN);

// --- Handle port cho Render (Background Worker) ---
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running');
}).listen(PORT, () => {
    console.log(✅ Server listening on port ${PORT});
});
Đó
