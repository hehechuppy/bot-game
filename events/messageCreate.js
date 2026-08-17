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
        .setColor('#0099ff')
        .setTitle('🤖 TRUNG TÂM HƯỚNG DẪN')
        .addFields(
          { name: '💰 Kinh Tế', value: '`.tien`, `.diemdanh`, `.daily`, `.code`, `.nhapcode`, `.donate`', inline: false },
          { name: '🛒 Cửa Hàng', value: '`.shop`, `.mua <id>`, `.sd <id>`, `.box`, `.unbox [số]`', inline: false },
          { name: '🎰 Trò Chơi', value: '`.tungxu` (.tx), `.baucua` (.bc), `.doanbom` (.bom), `.masoi` (.ms)', inline: false },
          { name: '🏆 Bảng Xếp Hạng', value: '`.xh`', inline: false },
          { name: '💵 cày mcoin', value: '`treo voice nhận mcoin`', inline: false },
        );
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
        const timeStr = data.expiresAt ? ` (Hết hạn: <t:${Math.floor(data.expiresAt / 1000)}:R>)` : '';
        desc += `• \`${code}\`: **+${data.reward.toLocaleString()} Mcoin**${timeStr}\n`;
      }
      const codeEmbed = new EmbedBuilder()
        .setColor('#00ffcc')
        .setTitle('🎟️ DANH SÁCH MÃ CODE HIỆN CÓ')
        .setDescription(desc || 'Hiện không có mã code nào khả dụng.');
      return message.reply({ embeds: [codeEmbed] });
    }

    if (command === 'nhapcode') {
      if (!args[0]) return message.reply('❌ Vui lòng nhập mã code!');
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
      return message.reply(`🎁 Nhận mã code thành công! Nhận được **+${codeData.reward.toLocaleString()} Mcoin**.`);
    }

    // --- .donate: thu phí 10% ---
    if (['donate', 'chuyenxu'].includes(command)) {
      const targetUser = message.mentions.users.first() || client.users.cache.get(args[0]);
      const amount = parseInt(args[1]);
      if (!targetUser) return message.reply('❌ Vui lòng tag người bạn muốn tặng xu! (VD: `.donate @User 500`)');
      if (targetUser.id === userId) return message.reply('❌ Bạn không thể tự tặng xu cho chính mình!');
      if (isNaN(amount) || amount <= 0) return message.reply('❌ Vui lòng nhập số tiền hợp lệ lớn hơn 0!');
      const senderBal = store.economyMap.get(userId) || 0;
      if (senderBal < amount) return message.reply(`❌ Bạn không đủ số dư! Số dư: **${senderBal.toLocaleString()} Mcoin**.`);

      const fee = Math.floor(amount * 0.1);
      const received = amount - fee;

      store.economyMap.set(userId, senderBal - amount);
      const receiverBal = store.economyMap.get(targetUser.id) || 0;
      store.economyMap.set(targetUser.id, receiverBal + received);

      return message.reply(`✅ Bạn đã chuyển **${amount.toLocaleString()} Mcoin** cho **${targetUser.username}**!\n💸 Phí giao dịch 10%: **${fee.toLocaleString()} Mcoin** — người nhận được **${received.toLocaleString()} Mcoin**.`);
    }

    // ================= SHOP / VẬT PHẨM =================
    if (command === 'shop') {
      const desc = store.SHOP_ITEMS.map(item =>
        `**#${item.id} — ${item.name}**\n${item.description}\n💰 Giá: **${item.price.toLocaleString()} Mcoin**\n`
      ).join('\n');
      const shopEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🛒 CỬA HÀNG VẬT PHẨM')
        .setDescription(desc + '\nDùng `.mua <id>` để mua, `.sd <id>` để kích hoạt (riêng Lucky Box dùng `.box`/`.unbox`).');
      return message.reply({ embeds: [shopEmbed] });
    }

    if (command === 'mua') {
      const itemId = parseInt(args[0]);
      const item = store.SHOP_ITEMS.find(i => i.id === itemId);
      if (!item) return message.reply('❌ Không tìm thấy vật phẩm với ID này! Dùng `.shop` để xem danh sách.');

      const bal = store.economyMap.get(userId) || 0;
      if (bal < item.price) {
        return message.reply(`❌ Bạn không đủ Mcoin! Cần **${item.price.toLocaleString()} Mcoin**, bạn có **${bal.toLocaleString()} Mcoin**.`);
      }

      store.economyMap.set(userId, bal - item.price);
      store.addToInventory(userId, item.id, 1);

      if (item.type === 'box') {
        return message.reply(`✅ Đã mua **${item.name}**! Dùng \`.box\` để xem, \`.unbox\` để mở.`);
      }
      return message.reply(`✅ Đã mua **${item.name}**! Dùng \`.sd ${item.id}\` để kích hoạt.`);
    }

    if (command === 'sd') {
      const itemId = parseInt(args[0]);
      const item = store.SHOP_ITEMS.find(i => i.id === itemId);
      if (!item) return message.reply('❌ Không tìm thấy vật phẩm với ID này!');

      if (item.type === 'box') {
        return message.reply('📦 Lucky Box không dùng `.sd` — hãy dùng `.unbox` để mở hộp!');
      }

      if (!store.canUseItemToday(userId, itemId)) {
        return message.reply(`❌ Bạn đã dùng hết lượt **${item.name}** hôm nay rồi! (Giới hạn: ${item.dailyLimit} lần/ngày)`);
      }

      const inv = store.getInventory(userId);
      const qty = inv.get(itemId) || 0;
      if (qty <= 0) return message.reply('❌ Bạn chưa sở hữu vật phẩm này! Dùng `.mua <id>` để mua trước.');

      store.removeFromInventory(userId, itemId, 1);
      store.recordItemUse(userId, itemId);

      if (item.type === 'winmultiplier') {
        const buff = store.activateWinBuff(userId, item.id, item.multiplier, item.uses);
        return message.reply(`✨ Đã kích hoạt **${item.name}**! Hiệu ứng x${item.multiplier} tiền thắng đang có hiệu lực trong **${buff.usesLeft} lượt** chơi tiếp theo (Bầu Cua / Tung Xu).`);
      }

      if (item.type === 'insurance') {
        const total = store.activateInsurance(userId, item.uses);
        return message.reply(`🛡️ Đã kích hoạt **${item.name}**! Bạn sẽ được hoàn lại tiền nếu thua ở ván tiếp theo (còn **${total}** lượt bảo hiểm).`);
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
        return message.reply(`✨ Đã kích hoạt **${item.name}**! Hiệu lực đến <t:${Math.floor(expiresAt / 1000)}:t> (<t:${Math.floor(expiresAt / 1000)}:R>).`);
      }

      return message.reply('❌ Không thể kích hoạt vật phẩm này.');
    }

    if (command === 'box') {
      const count = store.getBoxCount(userId, 6);
      return message.reply(count > 0
        ? `📦 Bạn đang có **${count}** Lucky Box chưa mở! Dùng \`.unbox\` để mở tất cả, hoặc \`.unbox <số>\` để mở 1 phần.`
        : '📭 Bạn chưa có Lucky Box nào! Mua tại `.shop` (ID 6).');
    }

    if (command === 'unbox') {
      const owned = store.getBoxCount(userId, 6);
      if (owned <= 0) return message.reply('📭 Bạn chưa có Lucky Box nào để mở!');

      const requested = args[0] ? parseInt(args[0]) : owned;
      if (isNaN(requested) || requested <= 0) return message.reply('❌ Số lượng không hợp lệ!');

      const result = store.openBoxes(userId, 6, requested);
      if (!result.success) return message.reply('❌ Có lỗi khi mở hộp!');

      const listStr = result.rewards.map((r, i) => {
        const sign = r >= 0 ? '+' : '';
        return `#${i + 1}: ${sign}${r.toLocaleString()} Mcoin`;
      }).join('\n');
      const totalSign = result.total >= 0 ? '+' : '';

      return message.reply(`🎉 Đã mở **${result.openCount}** Lucky Box!\n${listStr}\n\n💰 Tổng thay đổi: **${totalSign}${result.total.toLocaleString()} Mcoin**`);
    }

    if (['daily', 'dl'].includes(command)) {
      const userBal = store.economyMap.get(userId) || 0;
      const msgStatus = `${dData.messages}/20 ${dData.messages >= 20 ? '✅' : '⏳'}`;
      const gameStatus = `${dData.games}/3 ${dData.games >= 3 ? '✅' : '⏳'}`;
      const earnedStatus = `${dData.earned.toLocaleString()}/2,000 ${dData.earned >= 2000 ? '✅' : '⏳'}`;
      const dailyEmbed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('🎁 NHIỆM VỤ HẰNG NGÀY (DAILY)')
        .setDescription(`💬 **Nhắn 20 tin**\n${msgStatus}\n\n🎲 **Chơi 3 ván game**\n${gameStatus}\n\n💰 **Kiếm 2,000 TungXu**\n${earnedStatus}\n\nSố dư: **${userBal.toLocaleString()} Mcoin**`);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`claim_daily_${userId}`)
          .setLabel('Nhận Thưởng Daily')
          .setStyle(ButtonStyle.Success)
          .setDisabled(dData.messages < 20 || dData.games < 3 || dData.earned < 2000 || (dData.claimedMsg && dData.claimedGame && dData.claimedEarned))
      );
      return message.reply({ embeds: [dailyEmbed], components: [row] });
    }

    if (['baucua','bc'].includes(command)) return startBauCua(client, message, store);
    if (['tungxu','tx'].includes(command)) return startTungXu(client, message, store);
    if (['doanbom','bom'].includes(command)) return startDoanBom(client, message, store);
    if (['masoi','ms'].includes(command)) return startMaSoi(client, message, store);

    if (command === 'tien' || command === 'sodu') {
      const bal = store.economyMap.get(userId) || 0;
      return message.reply(`💰 Số dư của bạn: **${bal.toLocaleString()} Mcoin**`);
    }

    // --- .diemdanh: chuỗi 7 ngày ---
    if (['diemdanh','dd'].includes(command)) {
      const result = store.processDiemDanh(userId);
      if (!result.success) {
        return message.reply('❌ Đã điểm danh hôm nay rồi!');
      }
      let text = `🎁 Điểm danh ngày **${result.streakDay}/7**! Nhận **+${result.reward.toLocaleString()} Mcoin**!`;
      if (result.bonusBox) {
        text += `\n🎉 **Hoàn thành chuỗi 7 ngày!** Nhận thêm **1 Lucky Box**! Chuỗi sẽ tính lại từ ngày 1.`;
      } else {
        text += `\n(Điểm danh liên tục ngày mai để lên ngày ${result.streakDay + 1}, bỏ lỡ 1 ngày sẽ về lại ngày 1)`;
      }
      return message.reply(text);
    }
  },
};
