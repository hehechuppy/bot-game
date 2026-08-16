// games/baucua.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function startBauCua(client, message, store) {
  const bcEmbed = new EmbedBuilder()
    .setColor('#FF9900')
    .setTitle('🎲 SÒNG BẦU CUA TRỰC TUYẾN 🎲')
    .setDescription('Chọn linh vật bạn muốn đặt cược bên dưới!\n(Có thể bấm cược nhiều lần, kể cả nhiều linh vật khác nhau)');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bc_bau').setLabel('Bầu 🟢').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('bc_cua').setLabel('Cua 🦀').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('bc_tom').setLabel('Tôm 🦐').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('bc_ca').setLabel('Cá 🐟').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bc_ga').setLabel('Gà 🐓').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('bc_nai').setLabel('Nai 🦌').setStyle(ButtonStyle.Success)
  );

  const gameMsg = await message.reply({ embeds: [bcEmbed], components: [row, row2] });
  store.activeBauCuaGames.set(gameMsg.id, { players: new Map() });

  const collector = gameMsg.createMessageComponentCollector({ time: 25000 });
  collector.on('end', async () => {
    const gameData = store.activeBauCuaGames.get(gameMsg.id);
    store.activeBauCuaGames.delete(gameMsg.id);
    if (!gameData || gameData.players.size === 0) {
      return gameMsg.edit({ content: '⏳ Hết giờ, sòng Bầu Cua đã hủy.', embeds: [], components: [] });
    }

    const choices = ['bau', 'cua', 'tom', 'ca', 'ga', 'nai'];
    const results = [
      choices[Math.floor(Math.random() * choices.length)],
      choices[Math.floor(Math.random() * choices.length)],
      choices[Math.floor(Math.random() * choices.length)]
    ];

    const summary = [];
    gameData.players.forEach((data, pId) => {
      const pDaily = store.getDailyData(pId);
      pDaily.games++;

      let totalWin = 0;
      let totalLoss = 0;
      const betLines = [];

      data.bets.forEach(betEntry => {
        const matches = results.filter(r => r === betEntry.choice).length;
        if (matches > 0) {
          const reward = betEntry.bet * (matches + 1);
          totalWin += reward;
          betLines.push(`${betEntry.choice.toUpperCase()} (+${reward.toLocaleString()})`);
        } else {
          totalLoss += betEntry.bet;
          betLines.push(`${betEntry.choice.toUpperCase()} (-${betEntry.bet.toLocaleString()})`);
        }
      });

      // Buff nhân tiền thắng (x2/x3/x5) - tiêu 1 lượt mỗi ván bất kể thắng/thua
      const multiplier = store.consumeBuffIfActive(pId);
      let buffTag = '';
      if (multiplier > 1 && totalWin > 0) {
        totalWin *= multiplier;
        buffTag = ` 🔥(x${multiplier})`;
      }

      let net = totalWin - totalLoss;
      let insuranceTag = '';

      // Bảo hiểm thua: chỉ áp dụng khi net âm (thua ròng cả ván)
      if (net < 0) {
        const refund = store.consumeInsuranceIfLoss(pId, -net);
        if (refund > 0) {
          store.addTungXu(pId, refund);
          net += refund;
          insuranceTag = ` 🛡️(hoàn ${refund.toLocaleString()})`;
        }
      }

      if (totalWin > 0) store.addTungXu(pId, totalWin);

      const netStr = net >= 0 ? `+${net.toLocaleString()}` : `${net.toLocaleString()}`;
      summary.push(`• **${data.username}**: ${betLines.join(', ')} → Tổng: **${netStr} Mcoin**${buffTag}${insuranceTag}`);
    });

    const resEmbed = new EmbedBuilder()
      .setColor('#00FFCC')
      .setTitle('🎲 KẾT QUẢ BẦU CUA')
      .setDescription(`Xúc xắc: **${results.map(r => r.toUpperCase()).join(' - ')}**\n\n` + summary.join('\n'));
    return gameMsg.edit({ embeds: [resEmbed], components: [] });
  });
}

module.exports = { startBauCua };
