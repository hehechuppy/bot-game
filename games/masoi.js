// games/masoi.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const JOIN_TIME = 15000;
const MIN_PLAYERS = 3;
const WOLF_TIME = 20000;
const GUARD_TIME = 15000;
const DOCTOR_TIME = 15000;
const SEER_TIME = 15000;
const WITCH_TIME = 20000;
const HUNTER_TIME = 15000;
const DISCUSSION_TIME = 20000;
const VOTE_TIME = 20000;
const WIN_REWARD = 50000;

const ROLE_META = {
  soi:      { label: 'Sói 🐺', faction: 'soi', color: '#8B0000', icon: 'https://cdn-icons-png.flaticon.com/512/3504/3504313.png' },
  danlang: { label: 'Dân Làng 🧑‍🌾', faction: 'dan', color: '#2ECC71', icon: 'https://cdn-icons-png.flaticon.com/512/1995/1995515.png' },
  tientri: { label: 'Tiên Tri 🔮', faction: 'dan', color: '#9B59B6', icon: 'https://cdn-icons-png.flaticon.com/512/2097/2097276.png' },
  bacsi:   { label: 'Bác Sĩ 💊', faction: 'dan', color: '#2ECC71', icon: 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png' },
  thosan:  { label: 'Thợ Săn 🏹', faction: 'dan', color: '#E67E22', icon: 'https://cdn-icons-png.flaticon.com/512/3663/3663335.png' },
  phuthuy: { label: 'Phù Thủy 🧙', faction: 'dan', color: '#8E44AD', icon: 'https://cdn-icons-png.flaticon.com/512/1033/1033022.png' },
  baove:   { label: 'Bảo Vệ 🛡️', faction: 'dan', color: '#3498DB', icon: 'https://cdn-icons-png.flaticon.com/512/1067/1067357.png' }
};

const SPECIAL_ROLE_PRIORITY = ['tientri', 'bacsi', 'thosan', 'phuthuy', 'baove'];

function assignRoles(participantIds) {
  const shuffled = [...participantIds].sort(() => Math.random() - 0.5);
  const n = shuffled.length;
  const wolfCount = Math.max(1, Math.floor(n / 4));

  const roles = new Map();
  let idx = 0;
  for (let i = 0; i < wolfCount && idx < n; i++) { roles.set(shuffled[idx], 'soi'); idx++; }
  for (const r of SPECIAL_ROLE_PRIORITY) {
    if (idx >= n) break;
    roles.set(shuffled[idx], r);
    idx++;
  }
  while (idx < n) { roles.set(shuffled[idx], 'danlang'); idx++; }
  return roles;
}

function buildPlayerButtons(prefix, gameMsgId, gameData, targetIds) {
  const rows = [];
  let row = new ActionRowBuilder();
  let count = 0;
  for (const uid of targetIds.slice(0, 25)) {
    if (count === 5) { rows.push(row); row = new ActionRowBuilder(); count = 0; }
    const name = gameData.participants.get(uid) || 'Người chơi';
    row.addComponents(
      new ButtonBuilder().setCustomId(`${prefix}_${uid}_${gameMsgId}`).setLabel(name.slice(0, 80)).setStyle(ButtonStyle.Secondary)
    );
    count++;
  }
  if (count > 0) rows.push(row);
  return rows;
}

async function sendDM(client, userId, payload, fallbackChannel, username) {
  try {
    const user = await client.users.fetch(userId);
    await user.send(payload);
    return true;
  } catch (e) {
    if (fallbackChannel) {
      await fallbackChannel.send(`⚠️ Không thể gửi tin nhắn riêng cho **${username}** (có thể do đã tắt DM). Vui lòng bật DM từ thành viên server để chơi Ma Sói đầy đủ!`).catch(() => {});
    }
    return false;
  }
}

async function startMaSoi(client, message, store) {
  const guildId = message.guild.id;

  const joinEmbed = new EmbedBuilder()
    .setColor('#8B0000')
    .setTitle('🐺 SÒNG MA SÓI — CỬA NGHỈ MỜ ẢO 🌕')
    .setDescription(
      `*Đêm buông xuống trên ngôi làng mù sương... Thảm họa sắp xảy ra!*\n\n` +
      `📌 **Điều kiện:** Cần tối thiểu **${MIN_PLAYERS} người chơi**.\n` +
      `⏰ **Thời gian chờ:** <t:${Math.floor((Date.now() + JOIN_TIME) / 1000)}:R>\n\n` +
      `👥 **DANH SÁCH THAM GIA (0 người):**\n*Chưa có ai tham gia*`
    )
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/3504/3504313.png')
    .setFooter({ text: 'Bấm nút bên dưới để ghi danh tham gia trò chơi!' })
    .setTimestamp();

  const gameMsg = await message.reply({
    embeds: [joinEmbed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ms_join_pending').setLabel('🙋 Tham Gia Game').setStyle(ButtonStyle.Success)
    )]
  });

  store.activeMaSoiGames.set(gameMsg.id, {
    guildId,
    phase: 'joining',
    participants: new Map(),
    roles: new Map(),
    alive: new Set(),
    round: 0,
    wolfVotes: new Map(),
    guardTarget: null,
    prevGuardTarget: null,
    doctorTarget: null,
    seerActed: false,
    witchHealUsed: false,
    witchPoisonUsed: false,
    witchPoisonTarget: null,
    witchSavedVictim: false,
    witchActedTonight: false,
    wolfVictim: null,
    votes: new Map(),
    pendingHunterId: null,
    hunterRevengeTarget: null
  });

  await gameMsg.edit({
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ms_join_${gameMsg.id}`).setLabel('🙋 Tham Gia Game').setStyle(ButtonStyle.Success)
    )]
  });

  await new Promise(resolve => {
    const collector = gameMsg.createMessageComponentCollector({ time: JOIN_TIME });
    collector.on('end', resolve);
  });

  const gameData = store.activeMaSoiGames.get(gameMsg.id);
  if (!gameData) return;

  if (gameData.participants.size < MIN_PLAYERS) {
    store.activeMaSoiGames.delete(gameMsg.id);
    const cancelEmbed = new EmbedBuilder()
      .setColor('#7F8C8D')
      .setTitle('🐺 SÒNG MA SÓI ĐÃ HỦY')
      .setDescription(`❌ Không đủ người chơi (Cần tối thiểu **${MIN_PLAYERS} người**). Sòng đã bị dừng.`);
    return gameMsg.channel.send({ embeds: [cancelEmbed] });
  }

  gameData.roles = assignRoles([...gameData.participants.keys()]);
  gameData.alive = new Set(gameData.participants.keys());
  gameData.phase = 'night';

  for (const [uid, role] of gameData.roles.entries()) {
    const rMeta = ROLE_META[role];
    const roleDmEmbed = new EmbedBuilder()
      .setColor(rMeta.color)
      .setTitle(`🎭 VAI TRÒ CỦA BẠN: ${rMeta.label}`)
      .setThumbnail(rMeta.icon)
      .setDescription(
        `> **Phe:** ${rMeta.faction === 'soi' ? '🐺 MA SÓI' : '🧑‍🌾 DÂN LÀNG'}\n` +
        `Mọi hành động ban đêm (nếu có) sẽ được bot gửi riêng cho bạn tại đây. Hãy sẵn sàng!`
      );
    await sendDM(client, uid, { embeds: [roleDmEmbed] }, gameMsg.channel, gameData.participants.get(uid));
  }

  const startEmbed = new EmbedBuilder()
    .setColor('#8B0000')
    .setTitle('🌕 GAME MA SÓI - CHÍNH THỨC BẮT ĐẦU!')
    .setDescription('📜 **Vai trò đã được gửi bí mật qua tin nhắn riêng (DM)!**\n*Đêm đầu tiên chuẩn bị bắt đầu... Mọi người nhắm mắt lại!*')
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/1808/1808386.png');

  await gameMsg.channel.send({ embeds: [startEmbed] });

  await runGameLoop(gameMsg, store, client);
}

async function runGameLoop(gameMsg, store, client) {
  while (true) {
    const gameData = store.activeMaSoiGames.get(gameMsg.id);
    if (!gameData) return;

    gameData.round++;
    gameData.wolfVotes = new Map();
    gameData.doctorTarget = null;
    gameData.guardTarget = null;
    gameData.seerActed = false;
    gameData.witchActedTonight = false;
    gameData.witchPoisonTarget = null;

    await nightAnnounce(gameMsg, store);
    await wolfPhase(gameMsg, store, client);
    await guardPhase(gameMsg, store, client);
    await doctorPhase(gameMsg, store, client);
    await seerPhase(gameMsg, store, client);
    await witchPhase(gameMsg, store, client);
    const died = await resolveNight(gameMsg, store);

    for (const deadId of died) {
      await handleDeathTriggers(gameMsg, store, deadId);
    }

    if (await checkWinAndAnnounce(gameMsg, store)) return;

    await dayDiscussion(gameMsg, store);
    const lynched = await votePhase(gameMsg, store);
    if (lynched) {
      await handleDeathTriggers(gameMsg, store, lynched);
    }

    if (await checkWinAndAnnounce(gameMsg, store)) return;
  }
}

async function nightAnnounce(gameMsg, store) {
  const gameData = store.activeMaSoiGames.get(gameMsg.id);
  const embed = new EmbedBuilder()
    .setColor('#1A1A2E')
    .setTitle(`🌙 ĐÊM TỐI THỨ ${gameData.round} BẮT ĐẦU`)
    .setDescription(
      `*Màn đêm đen đặc bao phủ toàn bộ dân làng...*\n` +
      `🔮 Những người mang vai trò đặc biệt, hãy kiểm tra tin nhắn riêng (DM) để thực hiện nhiệm vụ!`
    )
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/1808/1808386.png');
  await gameMsg.channel.send({ embeds: [embed] });
  await new Promise(resolve => setTimeout(resolve, 3000));
}

async function wolfPhase(gameMsg, store, client) {
  const gameData = store.activeMaSoiGames.get(gameMsg.id);
  const aliveWolves = [...gameData.alive].filter(uid => gameData.roles.get(uid) === 'soi');
  gameData.wolfVictim = null;
  if (aliveWolves.length === 0) return;

  const announceEmbed = new EmbedBuilder()
    .setColor('#8B0000')
    .setTitle(`🐺 ĐÊM ${gameData.round} — SÓI ĐANG ĐI SĂN`)
    .setDescription(`*Đàn Sói đang bàn bạc bí mật để chọn con mồi...*\n⏱️ **Thời gian chờ:** <t:${Math.floor((Date.now() + WOLF_TIME) / 1000)}:R>`)
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/3504/3504313.png');
  await gameMsg.channel.send({ embeds: [announceEmbed] });

  const embed = new EmbedBuilder()
    .setColor('#8B0000')
    .setTitle(`🐺 ĐÊM ${gameData.round} — CHỌN NẠN NHÂN TRONG MÊM`)
    .setDescription(`Hãy chọn 1 người để cắn xé đêm nay! (Không thể tự chọn bản thân)`);

  for (const wolfId of aliveWolves) {
    const targets = [...gameData.alive].filter(uid => uid !== wolfId);
    const rows = buildPlayerButtons('ms_wolf', gameMsg.id, gameData, targets);
    await sendDM(client, wolfId, { embeds: [embed], components: rows }, gameMsg.channel, gameData.participants.get(wolfId));
  }

  await new Promise(resolve => setTimeout(resolve, WOLF_TIME));

  const tally = new Map();
  gameData.wolfVotes.forEach(targetId => tally.set(targetId, (tally.get(targetId) || 0) + 1));
  let bestCount = 0;
  let tied = [];
  tally.forEach((count, uid) => {
    if (count > bestCount) { bestCount = count; tied = [uid]; }
    else if (count === bestCount) { tied.push(uid); }
  });
  gameData.wolfVictim = tied.length > 0 ? tied[Math.floor(Math.random() * tied.length)] : null;
}

async function guardPhase(gameMsg, store, client) {
  const gameData = store.activeMaSoiGames.get(gameMsg.id);
  const guardId = [...gameData.alive].find(uid => gameData.roles.get(uid) === 'baove');
  gameData.guardTarget = null;
  if (!guardId) return;

  const targets = [...gameData.alive].filter(uid => uid !== guardId && uid !== gameData.prevGuardTarget);
  if (targets.length === 0) return;

  const announceEmbed = new EmbedBuilder()
    .setColor('#2980B9')
    .setTitle(`🛡️ ĐÊM ${gameData.round} — BẢO VỆ ĐANG HÀNH ĐỘNG`)
    .setDescription(`*Bảo Vệ đang đi tuần qua các ngôi nhà...*\n⏱️ **Thời gian chờ:** <t:${Math.floor((Date.now() + GUARD_TIME) / 1000)}:R>`)
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/1067/1067357.png');
  await gameMsg.channel.send({ embeds: [announceEmbed] });

  const embed = new EmbedBuilder()
    .setColor('#2980B9')
    .setTitle(`🛡️ ĐÊM ${gameData.round} — CHỌN NGƯỜI BẢO VỆ`)
    .setDescription(`Chọn 1 người để bảo vệ khỏi Sói đêm nay (Không được chọn trùng mục tiêu đêm trước).`);
  const rows = buildPlayerButtons('ms_guard', gameMsg.id, gameData, targets);
  await sendDM(client, guardId, { embeds: [embed], components: rows }, gameMsg.channel, gameData.participants.get(guardId));

  await new Promise(resolve => setTimeout(resolve, GUARD_TIME));

  if (gameData.guardTarget) {
    gameData.prevGuardTarget = gameData.guardTarget;
  }
}

async function doctorPhase(gameMsg, store, client) {
  const gameData = store.activeMaSoiGames.get(gameMsg.id);
  const doctorId = [...gameData.alive].find(uid => gameData.roles.get(uid) === 'bacsi');
  gameData.doctorTarget = null;
  if (!doctorId) return;

  const announceEmbed = new EmbedBuilder()
    .setColor('#2ECC71')
    .setTitle(`💊 ĐÊM ${gameData.round} — BÁC SĨ ĐANG HÀNH ĐỘNG`)
    .setDescription(`*Bác Sĩ đang chuẩn bị dược phẩm chữa trị...*\n⏱️ **Thời gian chờ:** <t:${Math.floor((Date.now() + DOCTOR_TIME) / 1000)}:R>`)
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/2966/2966327.png');
  await gameMsg.channel.send({ embeds: [announceEmbed] });

  const targets = [...gameData.alive];
  const embed = new EmbedBuilder()
    .setColor('#2ECC71')
    .setTitle(`💊 ĐÊM ${gameData.round} — CHỌN NGƯỜI CỨU MẠNG`)
    .setDescription(`Chọn 1 người chơi để chữa trị đêm nay (Có thể tự chữa cho mình).`);
  const rows = buildPlayerButtons('ms_doctor', gameMsg.id, gameData, targets);
  await sendDM(client, doctorId, { embeds: [embed], components: rows }, gameMsg.channel, gameData.participants.get(doctorId));

  await new Promise(resolve => setTimeout(resolve, DOCTOR_TIME));
}

async function seerPhase(gameMsg, store, client) {
  const gameData = store.activeMaSoiGames.get(gameMsg.id);
  const seerId = [...gameData.alive].find(uid => gameData.roles.get(uid) === 'tientri');
  gameData.seerActed = false;
  if (!seerId) return;

  const targets = [...gameData.alive].filter(uid => uid !== seerId);
  if (targets.length === 0) return;

  const announceEmbed = new EmbedBuilder()
    .setColor('#8E44AD')
    .setTitle(`🔮 ĐÊM ${gameData.round} — TIÊN TRI ĐANG HÀNH ĐỘNG`)
    .setDescription(`*Tiên Tri đang nhìn vào quả cầu pha lê soi chiếu sự thật...*\n⏱️ **Thời gian chờ:** <t:${Math.floor((Date.now() + SEER_TIME) / 1000)}:R>`)
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/2097/2097276.png');
  await gameMsg.channel.send({ embeds: [announceEmbed] });

  const embed = new EmbedBuilder()
    .setColor('#8E44AD')
    .setTitle(`🔮 ĐÊM ${gameData.round} — SOI VAI TRÒ`)
    .setDescription(`Chọn 1 người chơi để soi xem họ có phải là Ma Sói hay không!`);
  const rows = buildPlayerButtons('ms_seer', gameMsg.id, gameData, targets);
  await sendDM(client, seerId, { embeds: [embed], components: rows }, gameMsg.channel, gameData.participants.get(seerId));

  await new Promise(resolve => setTimeout(resolve, SEER_TIME));
}

async function witchPhase(gameMsg, store, client) {
  const gameData = store.activeMaSoiGames.get(gameMsg.id);
  const witchId = [...gameData.alive].find(uid => gameData.roles.get(uid) === 'phuthuy');
  gameData.witchActedTonight = false;
  if (!witchId) return;
  if (gameData.witchHealUsed && gameData.witchPoisonUsed) return;

  const announceEmbed = new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle(`🧙 ĐÊM ${gameData.round} — PHÙ THỦY ĐANG HÀNH ĐỘNG`)
    .setDescription(`*Phù Thủy đang cân nhắc hai bình thuốc huyền bí...*\n⏱️ **Thời gian chờ:** <t:${Math.floor((Date.now() + WITCH_TIME) / 1000)}:R>`)
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/1033/1033022.png');
  await gameMsg.channel.send({ embeds: [announceEmbed] });

  const victimName = gameData.wolfVictim ? gameData.participants.get(gameData.wolfVictim) : 'Không ai';
  const menuEmbed = new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle('🧙 QUYẾT ĐỊNH CỦA PHÙ THỦY')
    .setDescription(`🩸 Sói đã chọn tấn công: **${victimName}**\n\nHãy quyết định dùng Thuốc Cứu hay Thuốc Độc đêm nay.`);
  const menuRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ms_witchheal_${gameMsg.id}`).setLabel('💚 Cứu Nạn Nhân').setStyle(ButtonStyle.Success).setDisabled(gameData.witchHealUsed || !gameData.wolfVictim),
    new ButtonBuilder().setCustomId(`ms_witchpoisonmenu_${gameMsg.id}`).setLabel('☠️ Độc Sát 1 Người').setStyle(ButtonStyle.Danger).setDisabled(gameData.witchPoisonUsed),
    new ButtonBuilder().setCustomId(`ms_witchskip_${gameMsg.id}`).setLabel('➡️ Bỏ Qua Đêm Nay').setStyle(ButtonStyle.Secondary)
  );
  await sendDM(client, witchId, { embeds: [menuEmbed], components: [menuRow] }, gameMsg.channel, gameData.participants.get(witchId));

  await new Promise(resolve => setTimeout(resolve, WITCH_TIME));
}

async function resolveNight(gameMsg, store) {
  const gameData = store.activeMaSoiGames.get(gameMsg.id);
  const died = [];

  if (gameData.wolfVictim) {
    const protectedByGuard = gameData.guardTarget === gameData.wolfVictim;
    const protectedByDoctor = gameData.doctorTarget === gameData.wolfVictim;
    const savedByWitch = gameData.witchSavedVictim === true;
    if (!protectedByGuard && !protectedByDoctor && !savedByWitch) {
      gameData.alive.delete(gameData.wolfVictim);
      died.push(gameData.wolfVictim);
    }
  }

  if (gameData.witchPoisonTarget && gameData.alive.has(gameData.witchPoisonTarget)) {
    gameData.alive.delete(gameData.witchPoisonTarget);
    died.push(gameData.witchPoisonTarget);
  }

  gameData.witchSavedVictim = false;

  let desc;
  if (died.length === 0) {
    desc = '🕊️ **Một đêm hoàn toàn bình yên! Không có ai bị thương hay tử vong.**';
  } else {
    desc = '☠️ **Đêm qua là một đêm đẫm máu... Những nạn nhân sau đây đã ra đi:**\n\n' +
      died.map(id => `• **${gameData.participants.get(id)}** — Vai trò: **${ROLE_META[gameData.roles.get(id)].label}**`).join('\n');
  }

  const resEmbed = new EmbedBuilder()
    .setColor(died.length === 0 ? '#F1C40F' : '#E74C3C')
    .setTitle(`🌅 KẾT QUẢ ĐÊM THỨ ${gameData.round}`)
    .setDescription(desc)
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/869/869869.png')
    .setTimestamp();

  await gameMsg.channel.send({ embeds: [resEmbed] });

  return died;
}

async function handleDeathTriggers(gameMsg, store, deadId) {
  const gameData = store.activeMaSoiGames.get(gameMsg.id);
  if (!gameData) return;
  if (gameData.roles.get(deadId) !== 'thosan') return;

  const targets = [...gameData.alive];
  if (targets.length === 0) return;

  gameData.pendingHunterId = deadId;
  gameData.hunterRevengeTarget = null;

  const hunterEmbed = new EmbedBuilder()
    .setColor('#E67E22')
    .setTitle('🏹 PHÁT SÚNG BẢN NĂNG CỦA THỢ SĂN!')
    .setDescription(
      `🔥 **${gameData.participants.get(deadId)}** chính là **Thợ Săn**!\n` +
      `Trước khi trút hơi thở cuối cùng, Thợ Săn có **${HUNTER_TIME / 1000} giây** để bắn hạ 1 kẻ thù!`
    )
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/3663/3663335.png');

  const huntMsg = await gameMsg.channel.send({
    embeds: [hunterEmbed],
    components: buildPlayerButtons('ms_hunter', gameMsg.id, gameData, targets)
  });

  await new Promise(resolve => {
    const collector = huntMsg.createMessageComponentCollector({ time: HUNTER_TIME });
    collector.on('end', resolve);
  });

  gameData.pendingHunterId = null;
  const revengeTarget = gameData.hunterRevengeTarget;
  gameData.hunterRevengeTarget = null;

  if (revengeTarget && gameData.alive.has(revengeTarget)) {
    gameData.alive.delete(revengeTarget);
    const killEmbed = new EmbedBuilder()
      .setColor('#C0392B')
      .setTitle('💥 PHÁT SÚNG KẾT LIỄU!')
      .setDescription(`🏹 Thợ Săn đã bắn chết **${gameData.participants.get(revengeTarget)}** (${ROLE_META[gameData.roles.get(revengeTarget)].label})!`);
    await gameMsg.channel.send({ embeds: [killEmbed] });
    await handleDeathTriggers(gameMsg, store, revengeTarget);
  }
}

async function checkWinAndAnnounce(gameMsg, store) {
  const gameData = store.activeMaSoiGames.get(gameMsg.id);
  if (!gameData) return true;

  const aliveWolves = [...gameData.alive].filter(uid => gameData.roles.get(uid) === 'soi').length;
  const aliveOthers = gameData.alive.size - aliveWolves;

  let winningFaction = null;
  if (aliveWolves === 0) winningFaction = 'dan';
  else if (aliveWolves >= aliveOthers) winningFaction = 'soi';

  if (!winningFaction) return false;

  const guildId = gameData.guildId;
  const winners = [...gameData.participants.keys()].filter(uid => ROLE_META[gameData.roles.get(uid)].faction === winningFaction);
  
  // ✅ Cập nhật truyền guildId vào addTungXu
  winners.forEach(uid => store.addTungXu(guildId, uid, WIN_REWARD));

  const roleReveal = [...gameData.participants.entries()].map(([uid, name]) => {
    const role = gameData.roles.get(uid);
    const status = gameData.alive.has(uid) ? '🟢 **Sống**' : '💀 **Đã Chết**';
    return `• **${name}** — ${ROLE_META[role].label} (${status})`;
  }).join('\n');

  const winEmbed = new EmbedBuilder()
    .setColor(winningFaction === 'soi' ? '#8B0000' : '#2ECC71')
    .setTitle(winningFaction === 'soi' ? '🏆 PHE MA SÓI THẮNG TOÀN DIỆN! 🐺' : '🏆 PHE DÂN LÀNG CHIẾN THẮNG RỰC RỠ! 🧑‍🌾')
    .setDescription(
      `🎉 Mỗi người thắng cuộc nhận thưởng: **+${WIN_REWARD.toLocaleString()} Mcoin**!\n\n` +
      `📜 **BẢNG VÀNG VAI TRÒ TOÀN BỘ NGƯỜI CHƠI:**\n${roleReveal}`
    )
    .setThumbnail(winningFaction === 'soi' ? 'https://cdn-icons-png.flaticon.com/512/3504/3504313.png' : 'https://cdn-icons-png.flaticon.com/512/1995/1995515.png')
    .setTimestamp();

  await gameMsg.channel.send({ embeds: [winEmbed] });
  store.activeMaSoiGames.delete(gameMsg.id);
  return true;
}

async function dayDiscussion(gameMsg, store) {
  const discussEmbed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle('💬 BAN NGÀY — THẢO LUẬN TÌM SÓI')
    .setDescription(`Mọi người có **${DISCUSSION_TIME / 1000} giây** (<t:${Math.floor((Date.now() + DISCUSSION_TIME) / 1000)}:R>) để trao đổi, tranh luận và suy đoán ai là Ma Sói!`)
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/1256/1256650.png');

  await gameMsg.channel.send({ embeds: [discussEmbed] });
  await new Promise(resolve => setTimeout(resolve, DISCUSSION_TIME));
}

async function votePhase(gameMsg, store) {
  const gameData = store.activeMaSoiGames.get(gameMsg.id);
  gameData.votes = new Map();

  const targets = [...gameData.alive];
  const voteEmbed = new EmbedBuilder()
    .setColor('#C0392B')
    .setTitle('⚖️ BAN NGÀY — BỎ PHIẾU TREO CỔ')
    .setDescription(`Tất cả người chơi còn sống hãy bấm nút bầu chọn 1 người nghi vấn nhất!\n⏱️ **Thời gian cược phiếu:** <t:${Math.floor((Date.now() + VOTE_TIME) / 1000)}:R>`)
    .setFooter({ text: 'Mỗi người chỉ có 1 lượt vote duy nhất!' });

  const voteMsg = await gameMsg.channel.send({
    embeds: [voteEmbed],
    components: buildPlayerButtons('ms_vote', gameMsg.id, gameData, targets)
  });

  await new Promise(resolve => {
    const collector = voteMsg.createMessageComponentCollector({ time: VOTE_TIME });
    collector.on('end', resolve);
  });

  const tally = new Map();
  gameData.votes.forEach(targetId => tally.set(targetId, (tally.get(targetId) || 0) + 1));
  let bestCount = 0;
  let tied = [];
  tally.forEach((count, uid) => {
    if (count > bestCount) { bestCount = count; tied = [uid]; }
    else if (count === bestCount) { tied.push(uid); }
  });

  if (tied.length === 0) {
    const noVoteEmbed = new EmbedBuilder()
      .setColor('#95A5A6')
      .setTitle('🗳️ KẾT QUẢ BỎ PHIẾU TREO CỔ')
      .setDescription('🕊️ Không có ai bị treo cổ hôm nay do không ghi nhận lượt phiếu nào!');
    await gameMsg.channel.send({ embeds: [noVoteEmbed] });
    return null;
  }

  const lynchedId = tied[Math.floor(Math.random() * tied.length)];
  gameData.alive.delete(lynchedId);

  const lynchedEmbed = new EmbedBuilder()
    .setColor('#C0392B')
    .setTitle('⚖️ KẾT QUẢ BỎ PHIẾU TREO CỔ')
    .setDescription(`🔥 Dân làng đã quyết định đưa **${gameData.participants.get(lynchedId)}** lên giàn treo cổ!\n🎭 Vai trò thật sự: **${ROLE_META[gameData.roles.get(lynchedId)].label}**`)
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/3663/3663335.png');

  await gameMsg.channel.send({ embeds: [lynchedEmbed] });

  return lynchedId;
}

module.exports = { startMaSoi, assignRoles, ROLE_META, MIN_PLAYERS, WIN_REWARD };
