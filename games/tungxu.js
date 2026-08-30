// games/tungxu.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function startTungXu(client, message, store) {
  const guildId = message.guild.id;

  const txEmbed = new EmbedBuilder()
    .setColor('#FEE75C')
    .setTitle('🪙 SÒNG TUNG XU NHIỀU NGƯỜI CHƠI 🪙')
    .setDescription('Bấm nút để tham gia cược!');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tx_multi_ngua').setLabel('Chọn Ngửa 🪙').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('tx_multi_sap').setLabel('Chọn Sấp 🪙').setStyle(ButtonStyle.Secondary)
  );

  const gameMsg = await message.reply({ embeds: [txEmbed], components: [row] });

  store.activeTungXuGames.set(gameMsg.id, { guildId, players: new Map() });

  const collector = gameMsg.createMessageComponentCollector({ time: 20000 });

  collector.on('end', async () => {
    const gameData = store.activeTungXuGames.get(gameMsg.id);
    store.activeTungXuGames.delete(gameMsg.id);

    if (!gameData || gameData.players.size === 0) {
      return gameMsg.edit({ content: '⏳ Hết giờ, sòng hủy.', embeds: [], components: [] });
    }

    const result = Math.random() < 0.5 ? 'ngửa' : 'sấp';
    const summary = [];

    gameData.players.forEach((data, pId) => {
      // ✅ Fix: thêm guildId vào getDailyData
      const pDaily = store.getDailyData(guildId, pId);
      pDaily.games++;

      const win = (data.choice === result);

      // ✅ Fix: thêm guildId vào consumeBuffIfActive
      const multiplier = store.consumeBuffIfActive(guildId, pId);

      if (win) {
        let reward = data.bet * 2;
        let buffTag = '';
        if (multiplier > 1) {
          reward *= multiplier;
          buffTag = ` 🔥(x${multiplier})`;
        }
        store.addTungXu(guildId, pId, reward);
        summary.push(`• **${data.username}** thắng +${reward.toLocaleString()} Mcoin${buffTag}`);
      } else {
        // ✅ Fix: thêm guildId vào consumeInsuranceIfLoss
        const refund = store.consumeInsuranceIfLoss(guildId, pId, data.bet);
        let insuranceTag = '';
        if (refund > 0) {
          store.addTungXu(guildId, pId, refund);
          insuranceTag = ` 🛡️(hoàn ${refund.toLocaleString()})`;
        }
        const netLoss = data.bet - refund;
        summary.push(`• **${data.username}** thua -${netLoss.toLocaleString()} Mcoin${insuranceTag}`);
      }
    });

    const resEmbed = new EmbedBuilder()
      .setColor('#00FFCC')
      .setTitle('🪙 KẾT QUẢ TUNG XU')
      .setDescription(`Kết quả: **${result.toUpperCase()}**\n\n` + summary.join('\n'));

    return gameMsg.edit({ embeds: [resEmbed], components: [] });
  });
}

module.exports = { startTungXu };
