// games/tungxu.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function startTungXu(client, message, store) {
  const txEmbed = new EmbedBuilder()
    .setColor('#FEE75C')
    .setTitle('🪙 SÒNG TUNG XU NHIỀU NGƯỜI CHƠI 🪙')
    .setDescription('Bấm nút để tham gia cược!');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tx_multi_ngua').setLabel('Chọn Ngửa 🪙').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('tx_multi_sap').setLabel('Chọn Sấp 🪙').setStyle(ButtonStyle.Secondary)
  );

  const gameMsg = await message.reply({ embeds: [txEmbed], components: [row] });
  store.activeTungXuGames.set(gameMsg.id, { players: new Map() });

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
      const pDaily = store.getDailyData(pId);
      pDaily.games++;

      const win = (data.choice === result);
      if (win) {
        const reward = data.bet * 2;
        store.addTungXu(pId, reward);
        summary.push(`• **${data.username}** thắng +${reward} Mcoin`);
      } else {
        summary.push(`• **${data.username}** thua -${data.bet} Mcoin`);
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
