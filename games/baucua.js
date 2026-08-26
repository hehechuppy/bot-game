// games/baucua.js
const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle 
} = require('discord.js');

const MASCOTS = [
  { id: 'bau', name: 'Bầu', emoji: '🍐' },
  { id: 'cua', name: 'Cua', emoji: '🦀' },
  { id: 'tom', name: 'Tôm', emoji: '🦐' },
  { id: 'ca',  name: 'Cá',  emoji: '🐟' },
  { id: 'ga',  name: 'Gà',  emoji: '🐓' },
  { id: 'nai', name: 'Nai', emoji: '🦌' }
];

async function startBauCua(client, message, store) {
  const guildId = message.guild.id;
  const channelId = message.channelId;

  // 1. Tạo Embed sòng cược công khai
  const renderEmbed = (timeLeft = 25) => {
    return new EmbedBuilder()
      .setColor('#FF9900')
      .setTitle('🎰 SÒNG BẦU CUA TÔM CÁ 🎰')
      .setDescription(
        `⏰ **Thời gian còn lại:** <t:${Math.floor((Date.now() + timeLeft * 1000) / 1000)}:R>\n` +
        `👇 *Bấm vào nút linh vật bên dưới để chọn cửa & nhập tiền đặt cược!*`
      )
      .addFields(
        { name: '🍐 Bầu', value: '🟢', inline: true },
        { name: '🦀 Cua', value: '🔴', inline: true },
        { name: '🦐 Tôm', value: '🔵', inline: true },
        { name: '🐟 Cá',  value: '⚪', inline: true },
        { name: '🐓 Gà',  value: '🔵', inline: true },
        { name: '🦌 Nai',  value: '🟢', inline: true }
      )
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/3511/3511284.png')
      .setFooter({ text: 'Có thể đặt cược nhiều lần vào nhiều cửa khác nhau!' })
      .setTimestamp();
  };

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bc_bau').setLabel('Bầu 🍐').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('bc_cua').setLabel('Cua 🦀').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('bc_tom').setLabel('Tôm 🦐').setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bc_ca').setLabel('Cá 🐟').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('bc_ga').setLabel('Gà 🐓').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('bc_nai').setLabel('Nai 🦌').setStyle(ButtonStyle.Success)
  );

  const gameMsg = await message.reply({ embeds: [renderEmbed(25)], components: [row1, row2] });
  store.activeBauCuaGames.set(gameMsg.id, { players: new Map() });

  const collector = gameMsg.createMessageComponentCollector({ time: 25000 });

  // 2. Xử lý khi người chơi bấm nút chọn Linh Vật
  collector.on('collect', async (interaction) => {
    const choice = interaction.customId.replace('bc_', '');
    const mascot = MASCOTS.find(m => m.id === choice);

    // Mở Modal nhập số tiền cược
    const modal = new ModalBuilder()
      .setCustomId(`modal_bc_${choice}_${interaction.id}`)
      .setTitle(`Đặt cược vào cửa ${mascot.name} ${mascot.emoji}`);

    const betInput = new TextInputBuilder()
      .setCustomId('bet_amount')
      .setLabel('Số tiền cược (Mcoin):')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('VD: 10000 hoặc allin')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(betInput));
    await interaction.showModal(modal);

    // Lắng nghe Modal Submit
    try {
      const submitted = await interaction.awaitModalSubmit({
        filter: i => i.customId === `modal_bc_${choice}_${interaction.id}`,
        time: 15000
      });

      const pId = submitted.user.id;
      const userBal = store.getBalance(guildId, pId);
      let rawAmount = submitted.fields.getTextInputValue('bet_amount').trim().toLowerCase();
      let bet = 0;

      if (rawAmount === 'allin') {
        bet = userBal;
      } else {
        bet = parseInt(rawAmount);
      }

      if (isNaN(bet) || bet <= 0) {
        return submitted.reply({ content: '❌ Số tiền cược không hợp lệ!', ephemeral: true });
      }

      if (userBal < bet) {
        return submitted.reply({ content: `❌ Số dư không đủ! Bạn chỉ có **${userBal.toLocaleString()} Mcoin**.`, ephemeral: true });
      }

      // Trừ tiền cược ngay lập tức
      store.addTungXu(guildId, pId, -bet);

      // Lưu thông tin đặt cược của người chơi
      const gameData = store.activeBauCuaGames.get(gameMsg.id);
      if (gameData) {
        if (!gameData.players.has(pId)) {
          gameData.players.set(pId, { username: submitted.user.username, bets: [] });
        }
        gameData.players.get(pId).bets.push({ choice, bet });
      }

      return submitted.reply({
        content: `✅ Bạn đã cược **${bet.toLocaleString()} Mcoin** vào cửa **${mascot.name} ${mascot.emoji}**!`,
        ephemeral: true
      });
    } catch (e) {
      // Hết thời gian nhập modal
    }
  });

  // 3. Kết thúc thời gian đặt cược & Mở thưởng
  collector.on('end', async () => {
    const gameData = store.activeBauCuaGames.get(gameMsg.id);
    store.activeBauCuaGames.delete(gameMsg.id);

    if (!gameData || gameData.players.size === 0) {
      return gameMsg.edit({ 
        content: '⏳ Hết giờ! Không có ai đặt cược, sòng Bầu Cua đã bị hủy.', 
        embeds: [], 
        components: [] 
      });
    }

    // Disable tất cả các nút bấm
    row1.components.forEach(btn => btn.setDisabled(true));
    row2.components.forEach(btn => btn.setDisabled(true));
    await gameMsg.edit({ components: [row1, row2] }).catch(() => {});

    // Hiệu ứng Animation Lắc Đĩa (3 giây)
    const shakeEmbed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('🎲 ĐANG LẮC ĐĨA BẦU CUA...')
      .setDescription('🔊 *Rắc rắc rắc... Đang mở bát!* 🔊\n\n🥣 **[ ❓ | ❓ | ❓ ]**')
      .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHp4ZG5jZzBqOHp4ZG5jZzBqOHp4ZG5jZzBqOHp4ZG5j/3o7TKsjRrfIPjei1uU/giphy.gif');

    const resultMsg = await message.channel.send({ embeds: [shakeEmbed] });

    // Tạo kết quả 3 xúc xắc
    const choices = ['bau', 'cua', 'tom', 'ca', 'ga', 'nai'];
    const results = [
      choices[Math.floor(Math.random() * choices.length)],
      choices[Math.floor(Math.random() * choices.length)],
      choices[Math.floor(Math.random() * choices.length)]
    ];

    setTimeout(async () => {
      const summary = [];

      // Logic xử lý Thắng / Thua / Buff / Bảo hiểm
      gameData.players.forEach((data, pId) => {
        const pDaily = store.getDailyData(guildId, pId);
        if (pDaily) pDaily.games++;

        let totalWin = 0;
        let totalLoss = 0;
        const betLines = [];

        data.bets.forEach(betEntry => {
          const matches = results.filter(r => r === betEntry.choice).length;
          const mascotObj = MASCOTS.find(m => m.id === betEntry.choice);
          const nameWithEmoji = `${mascotObj.name} ${mascotObj.emoji}`;

          if (matches > 0) {
            const reward = betEntry.bet * (matches + 1);
            totalWin += reward;
            betLines.push(`${nameWithEmoji} (+${reward.toLocaleString()})`);
          } else {
            totalLoss += betEntry.bet;
            betLines.push(`${nameWithEmoji} (-${betEntry.bet.toLocaleString()})`);
          }
        });

        // Buff nhân tiền thắng (x2/x3/x5)
        const multiplier = store.consumeBuffIfActive(guildId, pId);
        let buffTag = '';
        if (multiplier > 1 && totalWin > 0) {
          totalWin *= multiplier;
          buffTag = ` 🔥(x${multiplier})`;
        }

        let net = totalWin - totalLoss;
        let insuranceTag = '';

        // Bảo hiểm thua
        if (net < 0) {
          const refund = store.consumeInsuranceIfLoss(guildId, pId, -net);
          if (refund > 0) {
            store.addTungXu(guildId, pId, refund);
            net += refund;
            insuranceTag = ` 🛡️(hoàn ${refund.toLocaleString()})`;
          }
        }

        if (totalWin > 0) store.addTungXu(guildId, pId, totalWin);

        const netStr = net >= 0 ? `+${net.toLocaleString()}` : `${net.toLocaleString()}`;
        summary.push(`• **${data.username}**: ${betLines.join(', ')} ➔ **${netStr} Mcoin**${buffTag}${insuranceTag}`);
      });

      // Format hiển thị kết quả Linh Vật rực rỡ
      const formattedResults = results.map(r => {
        const m = MASCOTS.find(item => item.id === r);
        return `${m.emoji} **${m.name.toUpperCase()}**`;
      }).join(' • ');

      const resEmbed = new EmbedBuilder()
        .setColor('#00FFCC')
        .setTitle('🎉 KẾT QUẢ BẦU CUA 🎉')
        .setDescription(
          `🥣 **XÚC XẮC RA:**\n# ${formattedResults}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📊 **BẢNG VÀNG THẮNG THUA:**\n${summary.join('\n')}`
        )
        .setFooter({ text: 'Cảm ơn đã tham gia! Dùng .bc hoặc .baucua để chơi ván mới.' })
        .setTimestamp();

      await resultMsg.edit({ embeds: [resEmbed] });
    }, 3000);
  });
}

module.exports = { startBauCua };
