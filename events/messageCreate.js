// === THAY THẾ TRONG messageCreate.js ===
// Tìm khối lệnh xhvoice và thay thế toàn bộ bằng đoạn này

if (command === 'xhvoice') {
  const top10 = store.getVoiceLeaderboard(10);
  if (top10.length === 0) {
    return message.reply('📊 Chưa có ai treo voice hôm nay!');
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

  // Mốc thời gian ngày mai 00:00:00 UTC (thời điểm reset)
  const nextResetMs = store.getStartOfCurrentDay() + 24 * 60 * 60 * 1000;
  const resetAt = Math.floor(nextResetMs / 1000);

  const voiceEmbed = new EmbedBuilder()
    .setColor('#00BFFF')
    .setTitle('🎙️ BẢNG XẾP HẠNG THỜI GIAN VOICE (HÔM NAY)')
    .setDescription(desc)
    .setFooter({ text: 'Top 1-10 sẽ nhận thưởng tự động khi reset ngày (00:00 UTC)' })
    .setTimestamp(nextResetMs);

  return message.reply({
    embeds: [voiceEmbed],
    content: `⏰ Bảng xếp hạng sẽ reset và phát thưởng vào <t:${resetAt}:F> (<t:${resetAt}:R>)`,
  });
}
