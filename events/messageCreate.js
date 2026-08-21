// ================= BẢNG XẾP HẠNG ECO (HÌNH ẢNH CANVAS) =================
    if (command === 'xh') {
      if (store.economyMap.size === 0) return message.reply('📊 Bảng xếp hạng Mcoin hiện đang trống!');
      
      const sorted = Array.from(store.economyMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const buffer = await createLeaderboardImage(sorted, client);
      
      const leaderboardEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 BẢNG XẾP HẠNG ĐẠI PHÚ VỒNG (TOP MCOIN)')
        .setDescription('Danh sách 10 đại gia sở hữu nhiều **Mcoin** nhất máy chủ!')
        .setImage('attachment://xh.png')
        .setFooter({ text: 'Cố gắng cày game và treo voice để lên Top nhé!', iconURL: message.guild.iconURL() })
        .setTimestamp();

      return message.reply({
        embeds: [leaderboardEmbed],
        files: [new AttachmentBuilder(buffer, { name: 'xh.png' })]
      });
    }

    // ================= XHVOICE: BẢNG XẾP HẠNG VOICE HOÀN THIỆN =================
    if (command === 'xhvoice') {
      const top10 = store.getVoiceLeaderboard(10);
      if (top10.length === 0) {
        return message.reply('📊 Chưa có thành viên nào tham gia treo voice tuần này!');
      }

      const getMedal = (rank) => {
        if (rank === 1) return '🥇 **[TOP 1]**';
        if (rank === 2) return '🥈 **[TOP 2]**';
        if (rank === 3) return '🥉 **[TOP 3]**';
        return `🔹 **[#${rank}]**`;
      };

      const getRewardBadge = (rank) => {
        if (rank === 1) return '🏆 Thưởng: `50,000 Mcoin` + `2x Lucky Box`';
        if (rank === 2) return '🎁 Thưởng: `25,000 Mcoin` + `1x Lucky Box`';
        if (rank === 3) return '💰 Thưởng: `10,000 Mcoin`';
        return '🪙 Thưởng: `367 Mcoin`';
      };

      // Tách Top 3 và Top 4-10 để trang trí đẹp hơn
      let top3Text = '';
      let restText = '';

      for (let i = 0; i < top10.length; i++) {
        const [uid, seconds] = top10[i];
        const rank = i + 1;
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const timeFormatted = `**${hours}** giờ **${mins}** phút`;

        if (rank <= 3) {
          top3Text += `${getMedal(rank)} <@${uid}>\n⏱️ Thời gian: ${timeFormatted}\n${getRewardBadge(rank)}\n\n`;
        } else {
          restText += `${getMedal(rank)} <@${uid}> — ⏱️ ${hours}h${mins}m | ${getRewardBadge(rank)}\n`;
        }
      }

      const nextResetMs = store.voiceWeekStart + 7 * 24 * 60 * 60 * 1000;
      const resetAt = Math.floor(nextResetMs / 1000);

      const voiceEmbed = new EmbedBuilder()
        .setColor('#00E5FF')
        .setTitle('🎙️ BẢNG XẾP HẠNG THỜI GIAN VOICE TUẦN')
        .setDescription(
          `⏰ **Tự động làm mới:** <t:${resetAt}:F> (<t:${resetAt}:R>)\n` +
          `✨ *Treo Voice ở các channel để tích lũy thời gian nhận quà hằng tuần!*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        )
        .addFields(
          { name: '👑 TOP PHONG NHA (DANH DỰ)', value: top3Text || 'Chưa có', inline: false }
        );

      if (restText) {
        voiceEmbed.addFields({ name: '⭐ CÁC VỊ TRÍ TIẾP THEO', value: restText, inline: false });
      }

      voiceEmbed
        .setFooter({ text: 'Hệ thống tự động phát thưởng vào 00:00 UTC Thứ 2', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      return message.reply({ embeds: [voiceEmbed] });
    }
