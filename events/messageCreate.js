// events/messageCreate.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const store = require('../store');
const { createLeaderboardImage } = require('../utils/canvas');
const { startBauCua } = require('../games/baucua');
const { startTungXu } = require('../games/tungxu');
const { startDoanBom } = require('../games/doanbom');
const { startMaSoi } = require('../games/masoi');

module.exports = {
  name: 'messageCreate',
  async execute(client, message) {
    if (message.author.bot) return;
    const userId = message.author.id;
    const dData = store.getDailyData(userId);
    if (!dData.claimedMsg && dData.messages < 20) dData.messages++;

    if (!message.content.startsWith('.')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (['help', 'shelp'].includes(command)) {
      const helpEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🤖 TRUNG TÂM HƯỚNG DẪN')
        .setThumbnail(message.author.displayAvatarURL())
        .addFields(
          { name: '💰 Kinh Tế', value: '`.tien` • `.diemdanh` • `.daily` • `.code` • `.nhapcode` • `.donate`', inline: false },
          { name: '🛒 Cửa Hàng', value: '`.shop` • `.mua <id>` • `.sd <id>` • `.box` • `.unbox [số]`', inline: false },
          { name: '🎰 Trò Chơi', value: '`.tungxu` (`.tx`) • `.baucua` (`.bc`) • `.doanbom` (`.bom`) • `.masoi` (`.ms`)', inline: false },
          { name: '🏆 Bảng Xếp Hạng', value: '`.xh`', inline: false },
          { name: '💵 Cày Mcoin', value: '**Treo voice** → Nhận Mcoin tự động', inline: false },
        )
        .setFooter({ text: 'Sử dụng .help để xem hướng dẫn', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
      return message.reply({ embeds: [helpEmbed] });
    }

    if (command === 'xh') {
      if (store.economyMap.size === 0) return message.reply('📊 Bảng xếp hạng trống!');
      const sorted = Array.from(store.economyMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
      const buffer = await createLeaderboardImage(sorted, client);
      return message.reply({ files: [new AttachmentBuilder(buffer, { name: 'xh.png' })] });
    }

    if (command === 'code') {
      let desc = '';
      const now = Date.now();
      for (const [code, data] of store.customCodesMap.entries()) {
        if (data.expiresAt && now > data.expiresAt) continue;
        const timeStr = data.expiresAt ? ` (Hết hạn: <t:${Math.floor(data.expiresAt / 1000)}:R>)` : ' (Vĩnh viễn)';
        desc += `🎟️ \`${code}\` → **+${data.reward.toLocaleString()} Mcoin**${timeStr}\n`;
      }
      const codeEmbed = new EmbedBuilder()
        .setColor('#00ffcc')
        .setTitle('🎁 DANH SÁCH MÃ CODE')
        .setDescription(desc || '❌ Hiện không có mã code nào khả dụng.')
        .setFooter({ text: 'Dùng .nhapcode <mã> để sử dụng' })
        .setTimestamp();
      return message.reply({ embeds: [codeEmbed] });
    }

    if (command === 'nhapcode') {
      if (!args[0]) return message.reply('❌ Vui lòng nhập mã code!. .nhapcode <mã>');
      const codeInput = args[0].toLowerCase();
      if (!store.customCodesMap.has(codeInput)) return message.reply('❌ Mã code không tồn tại!');
      const codeData = store.customCodesMap.get(codeInput);
      if (codeData.expiresAt && Date.now() > codeData.expiresAt) {
        store.customCodesMap.delete(codeInput);
        return message.reply('❌ Mã code này đã hết hạn sử dụng!');
      }
      if (!store.usedCodesMap.has(message.author.id)) store.usedCodesMap.set(message.author.id, new Set());
      if (store.usedCodesMap.get(message.author.id).has(codeInput)) return message.reply('❌ Bạn đã sử dụng mã code này rồi!');
      store.usedCodesMap.get(message.author.id).add(codeInput);
      store.addTungXu(message.author.id, codeData.reward);
      return message.reply(`🎁 Nhận mã code thành công!\n💰 +${codeData.reward.toLocaleString()} Mcoin`);
    }

    // --- .donate: thu phí 10% ---
    if (['donate', 'chuyenxu'].includes(command)) {
      const targetUser = message.mentions.users.first() || client.users.cache.get(args[0]);
      const amount = parseInt(args[1]);
      if (!targetUser) return message.reply('❌ Vui lòng tag người bạn muốn tặng xu! (VD: `.donate @User 500`)');
      if (targetUser.id === userId) return message.reply('❌ Bạn không thể tự tặng xu cho chính mình!');
      if (isNaN(amount) || amount <= 0) return message.reply('❌ Vui lòng nhập số tiền hợp lệ lớn hơn 0!');
      const senderBal = store.economyMap.get(userId) || 0;
      if (senderBal < amount) return message.reply(`❌ Bạn không đủ số dư!\n💰 Số dư: **${senderBal.toLocaleString()} Mcoin**`);

      const fee = Math.floor(amount * 0.1);
      const received = amount - fee;

      store.economyMap.set(userId, senderBal - amount);
      const receiverBal = store.economyMap.get(targetUser.id) || 0;
      store.economyMap.set(targetUser.id, receiverBal + received);

      const donateEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('💸 Chuyển Xu Thành Công')
        .addFields(
          { name: '👤 Người gửi', value: `${message.author.username}`, inline: true },
          { name: '📨 Người nhận', value: `${targetUser.username}`, inline: true },
          { name: '💰 Số tiền chuyển', value: `**${amount.toLocaleString()}** Mcoin`, inline: true },
          { name: '💸 Phí (10%)', value: `**${fee.toLocaleString()}** Mcoin`, inline: true },
          { name: '✅ Người nhận được', value: `**${received.toLocaleString()}** Mcoin`, inline: true }
        )
        .setFooter({ text: 'Chuyển xu không thể hoàn lại' })
        .setTimestamp();

      return message.reply({ embeds: [donateEmbed] });
    }

    // ================= SHOP / VẬT PHẨM =================
    if (command === 'shop') {
      const desc = store.SHOP_ITEMS.map(item => {
        const dailyText = item.dailyLimit ? `\n⏳ Giới hạn: ${item.dailyLimit}/ngày` : '';
        return `**#${item.id} — ${item.name}**\n${item.description}${dailyText}\n💰 **${item.price.toLocaleString()}** Mcoin\n`;
      }).join('\n');
      
      const shopEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🛒 CỬA HÀNG VẬT PHẨM')
        .setDescription(desc)
        .setFooter({ text: 'Dùng .mua <id> để mua | .sd <id> để dùng | .box/.unbox cho Lucky Box' })
        .setTimestamp();
      return message.reply({ embeds: [shopEmbed] });
    }

    if (command === 'mua') {
      const itemId = parseInt(args[0]);
      const item = store.SHOP_ITEMS.find(i => i.id === itemId);
      if (!item) return message.reply('❌ Không tìm thấy vật phẩm với ID này! Dùng `.shop` để xem danh sách.');

      // Check giới hạn mua hằng ngày cho box
      if (item.type === 'box' && item.dailyLimit) {
        if (!store.canBuyItemToday(userId, itemId)) {
          return message.reply(`❌ Bạn đã mua hết lượt **${item.name}** hôm nay!\n⏳ Giới hạn: ${item.dailyLimit} cái/ngày`);
        }
      }

      const bal = store.economyMap.get(userId) || 0;
      if (bal < item.price) {
        return message.reply(`❌ Bạn không đủ Mcoin!\n💰 Cần: **${item.price.toLocaleString()}** | Có: **${bal.toLocaleString()}**`);
      }

      store.economyMap.set(userId, bal - item.price);
      store.addToInventory(userId, item.id, 1);

      // Record item buy nếu có giới hạn
      if (item.dailyLimit) {
        store.recordItemBuy(userId, itemId);
      }

      if (item.type === 'box') {
        const remaining = item.dailyLimit - (store.getDailyData(userId).itemUses[itemId] || 0);
        return message.reply(`✅ Đã mua **${item.name}**!\n📦 Dùng \`.box\` để xem, \`.unbox\` để mở.\n⏳ Còn lại: **${remaining}/${item.dailyLimit}** cái hôm nay`);
      }
      return message.reply(`✅ Đã mua **${item.name}**!\n⚡ Dùng \`.sd ${item.id}\` để kích hoạt.`);
    }

    if (command === 'sd') {
      const itemId = parseInt(args[0]);
      const item = store.SHOP_ITEMS.find(i => i.id === itemId);
      if (!item) return message.reply('❌ Không tìm thấy vật phẩm với ID này!');

      if (item.type === 'box') {
        return message.reply('📦 Lucky Box không dùng `.sd` — hãy dùng `.unbox` để mở hộp!');
      }

      if (!store.canUseItemToday(userId, itemId)) {
        return message.reply(`❌ Bạn đã dùng hết lượt **${item.name}** hôm nay!\n⏳ Giới hạn: ${item.dailyLimit} lần/ngày`);
      }

      const inv = store.getInventory(userId);
      const qty = inv.get(itemId) || 0;
      if (qty <= 0) return message.reply('❌ Bạn chưa sở hữu vật phẩm này!\n💳 Dùng `.mua <id>` để mua trước.');

      store.removeFromInventory(userId, itemId, 1);
      store.recordItemUse(userId, itemId);

      if (item.type === 'winmultiplier') {
        const buff = store.activateWinBuff(userId, item.id, item.multiplier, item.uses);
        return message.reply(`✨ **${item.name}** đã kích hoạt!\n🎯 Hiệu ứng: x${item.multiplier} tiền thắng\n📊 Còn lại: **${buff.usesLeft}** lượt chơi`);
      }

      if (item.type === 'insurance') {
        const total = store.activateInsurance(userId, item.uses);
        return message.reply(`🛡️ **${item.name}** đã kích hoạt!\n💰 Sẽ hoàn lại tiền nếu thua ở ván tiếp theo\n📊 Bảo hiểm còn lại: **${total}** lượt`);
      }

      if (item.type === 'voicetime') {
        const expiresAt = store.activateVoiceBuff(userId, item.durationMs);
        setTimeout(async () => {
          if ((store.activeVoiceBuffsMap.get(userId) || 0) <= Date.now()) {
            store.activeVoiceBuffsMap.delete(userId);
            try {
              const user = await client.users.fetch(userId);
              await user.send(`⏰ Hiệu ứng **${item.name}** của bạn đã hết hạn!`);
            } catch (e) { /* DM tắt, bỏ qua */ }
          }
        }, item.durationMs);
        return message.reply(`✨ **${item.name}** đã kích hoạt!\n📈 Nhân đôi Mcoin trong voice\n⏱️ Hết hạn: <t:${Math.floor(expiresAt / 1000)}:R>`);
      }

      return message.reply('❌ Không thể kích hoạt vật phẩm này.');
    }

    if (command === 'box') {
      const count = store.getBoxCount(userId, 6);
      if (count > 0) {
        const boxEmbed = new EmbedBuilder()
          .setColor('#9C27B0')
          .setTitle('📦 Kho Lucky Box')
          .setDescription(`Bạn đang có **${count}** Lucky Box chưa mở!`)
          .addFields(
            { name: '🔓 Mở tất cả', value: '`.unbox`', inline: true },
            { name: '🔓 Mở một phần', value: '`.unbox <số>`', inline: true }
          )
          .setFooter({ text: 'Mở hộp để nhận Mcoin!' })
          .setTimestamp();
        return message.reply({ embeds: [boxEmbed] });
      }
      return message.reply('📭 Bạn chưa có Lucky Box nào!\n💳 Mua tại `.shop` (ID 6)');
    }

    if (command === 'unbox') {
      const owned = store.getBoxCount(userId, 6);
      if (owned <= 0) return message.reply('📭 Bạn chưa có Lucky Box nào để mở!');

      const requested = args[0] ? parseInt(args[0]) : owned;
      if (isNaN(requested) || requested <= 0) return message.reply('❌ Số lượng không hợp lệ!');

      const result = store.openBoxes(userId, 6, requested);
      if (!result.success) return message.reply('❌ Có lỗi khi mở hộp!');

      const listStr = result.rewards.slice(0, 10).map((r, i) => {
        const sign = r >= 0 ? '✅ +' : '❌ ';
        return `${sign}${r.toLocaleString()} Mcoin`;
      }).join('\n');
      const totalSign = result.total >= 0 ? '✅ +' : '❌ ';
      const hideMsg = result.openCount > 10 ? `\n... và ${result.openCount - 10} hộp khác` : '';

      const unboxEmbed = new EmbedBuilder()
        .setColor('#FF9800')
        .setTitle('🎉 Mở Lucky Box')
        .setDescription(`**Đã mở ${result.openCount} hộp!**\n\n${listStr}${hideMsg}\n\n━━━━━━━━━━━━━━━\n${totalSign}**${Math.abs(result.total).toLocaleString()} Mcoin**`)
        .setFooter({ text: 'May mắn lần sau nha! 🍀' })
        .setTimestamp();

      return message.reply({ embeds: [unboxEmbed] });
    }

    if (['daily', 'dl'].includes(command)) {
      const userBal = store.economyMap.get(userId) || 0;
      const msgStatus = dData.messages >= 20 ? '✅ Hoàn thành' : `⏳ ${dData.messages}/20`;
      const gameStatus = dData.games >= 3 ? '✅ Hoàn thành' : `⏳ ${dData.games}/3`;
      const earnedStatus = dData.earned >= 2000 ? '✅ Hoàn thành' : `⏳ ${dData.earned.toLocaleString()}/2,000`;
      
      const canClaim = dData.messages >= 20 && dData.games >= 3 && dData.earned >= 2000 && !(dData.claimedMsg && dData.claimedGame && dData.claimedEarned);

      const dailyEmbed = new EmbedBuilder()
        .setColor('#4CAF50')
        .setTitle('🎁 NHIỆM VỤ HẰNG NGÀY (DAILY)')
        .setDescription(`**Hoàn thành nhiệm vụ để nhận thưởng!**`)
        .addFields(
          { name: '💬 Nhắn 20 tin', value: msgStatus, inline: false },
          { name: '🎲 Chơi 3 ván game', value: gameStatus, inline: false },
          { name: '💰 Kiếm 2,000 TungXu', value: earnedStatus, inline: false },
          { name: '💳 Số dư hiện tại', value: `**${userBal.toLocaleString()} Mcoin**`, inline: false }
        )
        .setFooter({ text: 'Nhận thưởng được reset hằng ngày lúc 00:00' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`claim_daily_${userId}`)
          .setLabel('🎁 Nhận Thưởng')
          .setStyle(ButtonStyle.Success)
          .setDisabled(!canClaim)
      );
      return message.reply({ embeds: [dailyEmbed], components: [row] });
    }

    if (['baucua','bc'].includes(command)) return startBauCua(client, message, store);
    if (['tungxu','tx'].includes(command)) return startTungXu(client, message, store);
    if (['doanbom','bom'].includes(command)) return startDoanBom(client, message, store);
    if (['masoi','ms'].includes(command)) return startMaSoi(client, message, store);

    if (command === 'tien' || command === 'sodu') {
      const bal = store.economyMap.get(userId) || 0;
      const balEmbed = new EmbedBuilder()
        .setColor('#2196F3')
        .setTitle('💰 Số Dư')
        .setDescription(`**${bal.toLocaleString()} Mcoin**`)
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({ text: 'Dùng .donate để chuyển xu cho bạn bè' })
        .setTimestamp();
      return message.reply({ embeds: [balEmbed] });
    }

    // --- .diemdanh: chuỗi 7 ngày ---
    if (['diemdanh','dd'].includes(command)) {
      const result = store.processDiemDanh(userId);
      if (!result.success) {
        return message.reply('❌ Đã điểm danh hôm nay rồi!\n⏰ Quay lại vào ngày mai để tiếp tục!');
      }
      
      const ddEmbed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('🎁 Điểm Danh Hằng Ngày')
        .addFields(
          { name: '📊 Ngày', value: `${result.streakDay}/7`, inline: true },
          { name: '💰 Phần thưởng', value: `+${result.reward.toLocaleString()} Mcoin`, inline: true },
          { name: result.bonusBox ? '🎉 Thưởng Hoàn Thành' : '⏳ Tiếp Theo', 
            value: result.bonusBox ? '🎁 +1 Lucky Box' : `Ngày ${result.streakDay + 1}`, 
            inline: false }
        )
        .setFooter({ text: result.bonusBox ? 'Chuỗi reset về ngày 1 - Tiếp tục để kiếm thêm!' : 'Điểm danh liên tục để nhận thưởng lớn!' })
        .setTimestamp();

      return message.reply({ embeds: [ddEmbed] });
    }
  },
};
