// events/messageCreate.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');

const store = require('../store');

const { startBauCua } = require('../games/baucua');

const { startTungXu } = require('../games/tungxu');

const { startDoanBom } = require('../games/doanbom');

const { startMaSoi } = require('../games/masoi');

const { startNoituGame, handleNoituMessage, activeGames } = require('../games/noitu');

const { startCaoNut } = require('../games/caonut');



module.exports = {

  name: 'messageCreate',

  async execute(client, message) {

    if (message.author.bot) return;

    const userId = message.author.id;

    const dData = store.getDailyData(userId);

    if (!dData.claimedMsg && dData.messages < 20) dData.messages++;



    // ================= KIỂM TRA GAME NỐI TỪ ĐANG CHẠY =================

    if (!message.content.startsWith('.')) {

      if (activeGames.has(message.channelId)) {

        await handleNoituMessage(client, message, store, message.content);

      }

      return;

    }



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

          { name: '🎰 Trò Chơi', value: '`.tungxu` (`.tx`) • `.baucua` (`.bc`) • `.doanbom` (`.bom`) • `.masoi` (`.ms`) • `.noitu` (`.nt`) • `.caonut` (`.cn`)', inline: false },

          { name: '🏆 Bảng Xếp Hạng', value: '`.xh` • `.xhvoice`', inline: false },

          { name: '💼 Kho Đồ Đã Mua', value: '`.kho`', inline: false },

          { name: '💵 Cày Mcoin', value: '**Treo voice** → Nhận Mcoin tự động', inline: false },

          { name: '❗ Luật Server SHADOW GLADE', value: '`cấm bug,buff tiền`', inline: false },

        )

        .setFooter({ text: 'Sử dụng .help để xem hướng dẫn', iconURL: client.user.displayAvatarURL() })

        .setTimestamp();

      return message.reply({ embeds: [helpEmbed] });

    }



    // ================= XH: BẢNG XẾP HẠNG MCOIN =================

    if (command === 'xh') {

      if (store.economyMap.size === 0) return message.reply('📊 Bảng xếp hạng Mcoin hiện tại đang trống!');



      const sorted = Array.from(store.economyMap.entries())

        .sort((a, b) => b[1] - a[1])

        .slice(0, 10);



      const medals = ['🥇', '🥈', '🥉'];

      let desc = '';



      for (let i = 0; i < sorted.length; i++) {

        const [uid, balance] = sorted[i];

        const rank = i + 1;



        let user;

        try {

          user = await client.users.fetch(uid);

        } catch (e) {

          user = null;

        }



        const name = user ? (user.displayName || user.username) : `User_${uid.slice(-4)}`;

        const formattedMoney = balance.toLocaleString('vi-VN');



        if (rank <= 3) {

          desc += `${medals[i]} **${name}** — \`${formattedMoney} Mcoin\`\n\n`;

        } else {

          desc += `**#${rank}** **${name}** — \`${formattedMoney} Mcoin\`\n\n`;

        }

      }



      const xhEmbed = new EmbedBuilder()

        .setColor('#FFD700')

        .setTitle('🏆 BẢNG XẾP HẠNG PHÚ HỘ MCOIN 🏆')

        .setDescription(desc.trim())

        .setThumbnail(message.guild ? message.guild.iconURL({ dynamic: true }) : client.user.displayAvatarURL())

        .setFooter({

          text: `Yêu cầu bởi ${message.author.username}`,

          iconURL: message.author.displayAvatarURL({ dynamic: true })

        })

        .setTimestamp();



      return message.reply({ embeds: [xhEmbed] });

    }



    // ================= XHVOICE: BẢNG XẾP HẠNG VOICE =================

    if (command === 'xhvoice') {

      const top10 = store.getVoiceLeaderboard(10);

      if (top10.length === 0) {

        return message.reply('📊 Chưa có ai treo voice tuần này!');

      }



      const rewardText = (rank) => {

        if (rank === 1) return '💰 50,000 Mcoin + 🎁 2 Lucky Box';

        if (rank === 2) return '💰 25,000 Mcoin + 🎁 1 Lucky Box';

        if (rank === 3) return '💰 10,000 Mcoin';

        return '💰 367 Mcoin';

      };



      let desc = '';

      for (let i = 0; i < top10.length; i++) {

        const [uid, seconds] = top10[i];

        const rank = i + 1;

        const hours = Math.floor(seconds / 3600);

        const mins = Math.floor((seconds % 3600) / 60);

        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**#${rank}**`;

        desc += `${medal} <@${uid}> — ⏱️ ${hours}h${mins}m\n${rewardText(rank)}\n\n`;

      }



      const nextResetMs = store.voiceWeekStart + 7 * 24 * 60 * 60 * 1000;

      const resetAt = Math.floor(nextResetMs / 1000);



      const voiceEmbed = new EmbedBuilder()

        .setColor('#00BFFF')

        .setTitle('🎙️ BẢNG XẾP HẠNG THỜI GIAN VOICE (TUẦN NÀY)')

        .setDescription(desc)

        .setFooter({ text: 'Top 1-10 sẽ nhận thưởng tự động khi reset tuần (Thứ 2 00:00 UTC)' })

        .setTimestamp(nextResetMs);



      return message.reply({

        embeds: [voiceEmbed],

        content: `⏰ Bảng xếp hạng sẽ reset và phát thưởng vào <t:${resetAt}:F> (<t:${resetAt}:R>)`,

      });

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

      if (!args[0]) return message.reply('❌ Vui lòng nhập mã code! .nhapcode <code>');

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



    // ================= CỬA HÀNG VẬT PHẨM (THIẾT KẾ MỚI) =================

    if (command === 'shop') {

      const userBalance = store.economyMap.get(userId) || 0;



      // Type icons giúp phân loại trực quan

      const TYPE_ICONS = {

        voicetime: '🎙️',

        winmultiplier: '⚡',

        insurance: '🛡️',

        box: '🎁'

      };



      const desc = store.SHOP_ITEMS.map((item) => {

        const icon = TYPE_ICONS[item.type] || '📦';

        const boughtToday = dData.itemBuys[item.id] || 0;



        let limitText = '';

        if (item.dailyLimit !== null) {

          const remaining = Math.max(0, item.dailyLimit - boughtToday);

          limitText = `\n⏳ **Giới hạn:** \`${boughtToday}/${item.dailyLimit}\`/ngày (Còn \`${remaining}\` lần)`;

        }



        return [

          `${icon} **[ #${item.id} ]  ${item.name.toUpperCase()}**`,

          `> ${item.description}`,

          `💰 **Giá:** \`${item.price.toLocaleString()}\` Mcoin${limitText}`,

          `───────────────────`

        ].join('\n');

      }).join('\n\n');



      const shopEmbed = new EmbedBuilder()

        .setColor('#FFD700')

        .setTitle('🛒  CỬA HÀNG VẬT PHẨM')

        .setDescription(`👤 **Tài khoản:** ${message.author}\n💰 **Số dư:** \`${userBalance.toLocaleString()}\` Mcoin\n\n${desc}`)

        .setThumbnail(client.user.displayAvatarURL())

        .setFooter({ 

          text: '💡 Dùng .mua <ID> để mua | .sd <ID> để dùng | .box / .unbox cho Lucky Box',

          iconURL: message.author.displayAvatarURL()

        })

        .setTimestamp();



      return message.reply({ embeds: [shopEmbed] });

    }



    if (command === 'mua') {

      const itemId = parseInt(args[0]);

      const item = store.SHOP_ITEMS.find(i => i.id === itemId);

      if (!item) return message.reply('❌ Không tìm thấy vật phẩm với ID này! Dùng `.shop` để xem danh sách.');



      if (item.dailyLimit) {

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



      if (item.dailyLimit) {

        store.recordItemBuy(userId, itemId);

      }



      if (item.type === 'box') {

        const remaining = item.dailyLimit - (store.getDailyData(userId).itemBuys[itemId] || 0);

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



    if (command === 'kho') {

      const inv = store.getInventory(userId);

      if (inv.size === 0) {

        return message.reply('📭 Kho của bạn trống rỗng!\n💳 Mua vật phẩm tại `.shop`');

      }



      const dData = store.getDailyData(userId);

      let desc = '';



      for (const [itemId, quantity] of inv) {

        const item = store.SHOP_ITEMS.find(i => i.id === parseInt(itemId));

        if (!item) continue;



        const used = dData.itemUses[itemId] || 0;

        const dailyText = item.dailyLimit

          ? `\n⏳ Đã dùng: ${used}/${item.dailyLimit} (hôm nay)`

          : '';



        desc += `**#${item.id} — ${item.name}**\n`;

        desc += `📦 Số lượng: **${quantity}**${dailyText}\n\n`;

      }



      const khoEmbed = new EmbedBuilder()

        .setColor('#FF9800')

        .setTitle('🎒 KHO VẬT PHẨM')

        .setDescription(desc || '📭 Kho trống!')

        .setThumbnail(message.author.displayAvatarURL())

        .setFooter({ text: 'Dùng .sd <id> để kích hoạt vật phẩm' })

        .setTimestamp();



      return message.reply({ embeds: [khoEmbed] });

    }



    if (command === 'unbox') {

      const owned = store.getBoxCount(userId, 6);

      if (owned <= 0) return message.reply('📭 Bạn chưa có Lucky Box nào để mở!');



      const requested = args[0] ? parseInt(args[0]) : owned;

      if (isNaN(requested) || requested <= 0) return message.reply('❌ Số lượng không hợp lệ!');



      const result = store.openBoxes(userId, 6, requested);

      if (!result.success) return message.reply('❌ Có lỗi khi mở hộp!');



      const listStr = result.rewards.slice(0, 10).map((r) => {

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

    if (['caonut','cn'].includes(command)) {
      const betAmount = parseInt(args[0]);
      if (isNaN(betAmount) || betAmount <= 0) {
        return message.reply('❌ Cú pháp: `.caonut <tiền cược>` hay `.cn <tiền cược>`\nVD: `.caonut 10000`');
      }
      return startCaoNut(client, message, store, betAmount);
    }



    // ================= GAME NOITU - NỐI TỪ =================

    if (['noitu', 'nt'].includes(command)) {

      return startNoituGame(client, message, store);

    }



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
