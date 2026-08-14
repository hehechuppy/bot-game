// games/masoi.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const JOIN_TIME = 45000;
const MIN_PLAYERS = 7;
const WOLF_TIME = 20000;
const GUARD_TIME = 15000;
const DOCTOR_TIME = 15000;
const SEER_TIME = 15000;
const WITCH_TIME = 20000;
const HUNTER_TIME = 15000;
const DISCUSSION_TIME = 20000;
const VOTE_TIME = 20000;
const WIN_REWARD = 3000;

const ROLE_META = {
  soi:     { label: 'Sói 🐺', faction: 'soi' },
  danlang: { label: 'Dân Làng 🧑‍🌾', faction: 'dan' },
  tientri: { label: 'Tiên Tri 🔮', faction: 'dan' },
  bacsi:   { label: 'Bác Sĩ 💊', faction: 'dan' },
  thosan:  { label: 'Thợ Săn 🏹', faction: 'dan' },
  phuthuy: { label: 'Phù Thủy 🧙', faction: 'dan' },
  baove:   { label: 'Bảo Vệ 🛡️', faction: 'dan' }
};

function assignRoles(participantIds) {
  const shuffled = [...participantIds].sort(() => Math.random() - 0.5);
  const n = shuffled.length;
  const wolfCount = Math.max(1, Math.floor(n / 4));
  const specialRoles = ['tientri', 'bacsi', 'thosan', 'phuthuy', 'baove'];

  const roles = new Map();
  let idx = 0;
  for (let i = 0; i < wolfCount; i++) { roles.set(shuffled[idx], 'soi'); idx++; }
  for (const r of specialRoles) { roles.set(shuffled[idx], r); idx++; }
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

async function startMaSoi(client, message, store) {
  const joinEmbed = new EmbedBuilder()
    .setColor('#8B0000')
    .setTitle('🐺 GAME MA SÓI 🌕')
    .setDescription(`Bấm nút bên dưới để tham gia! Cần tối thiểu ${MIN_PLAYERS} người.\n\n👥 Đã tham gia: **0** người\nChưa có ai tham gia`);

  const gameMsg = await message.reply({
    embeds: [joinEmbed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ms_join_pending').setLabel('🙋 Tham gia').setStyle(ButtonStyle.Success)
    )]
  });

  store.activeMaSoiGames.set(gameMsg.id, {
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
      new ButtonBuilder().setCustomId(`ms_join_${gameMsg.id}`).setLabel('🙋 Tham gia').setStyle(ButtonStyle.Success)
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
    return gameMsg.edit({
      content: `❌ Không đủ người chơi (cần tối thiểu ${MIN_PLAYERS} người), đã hủy game.`,
      embeds: [],
      components: []
    });
  }

  gameData.roles = assignRoles([...gameData.participants.keys()]);
  gameData.alive = new Set(gameData.participants.keys());
  gameData.phase = 'night';

  // Thông báo vai trò riêng cho từng người qua DM (nếu bot không DM được thì bỏ qua, không chặn game)
  for (const [uid, role] of gameData.roles.entries()) {
    try {
      const user = await client.users.fetch(uid);
      await user.send(`🐺 **GAME MA SÓI** - Vai trò của bạn là: **${ROLE_META[role].label}**`);
    } catch (e) {
      // Người dùng tắt DM -> bỏ qua, không ảnh hưởng luồng game
    }
  }

  await gameMsg.edit({
    embeds: [new EmbedBuilder().setColor('#8B0000').setTitle('🐺 GAME MA SÓI - BẮT ĐẦU!').setDescription('Vai trò đã được chia xong (đã gửi qua tin nhắn riêng nếu có thể)! Đêm đầu tiên bắt đầu...')],
    components: []
  });

  await runGameLoop(gameMsg, store);
}

async function runGameLoop(gameMsg, store) {
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
    await wolfPhase(gameMsg, store);
    await guardPhase(gameMsg, store);
    await doctorPhase(gameMsg, store);
    await seerPhase(gameMsg, store);
    await witchPhase(gameMsg, store);
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
  await gameMsg.edit({
    embeds: [new EmbedBuilder().setColor('#000033').setTitle(`🌙 ĐÊM ${gameData.round} BẮT ĐẦU`).setDescription('Trời tối dần... mọi người nhắm mắt lại...')],
    components: []
  });
  await new Promise(resolve => setTimeout(resolve, 3000));
}

async function wolfPhase(gameMsg, store) {
  const gameData = store.activeMaSoiGames.get(gameMsg.id);
  const aliveWolves = [...gameData.alive].filter(uid => gameData.roles.get(uid) === 'soi');
  gameData.wolfVictim = null;
  if (aliveWolves.length === 0) return;

  const targets = [...gameData.alive];
  const embed = new EmbedBuilder()
    .setColor('#8B0000')
    .setTitle(`🐺 ĐÊM ${gameData.round} - SÓI CHỌN NẠN NHÂN`)
    .setDescription(`Chỉ **Sói** mới bấm được nút bên dưới. Có ${WOLF_TIME / 1000} giây để chọn.`);
  await gameMsg.edit({ embeds: [embed], components: buildPlayerButtons('ms_wolf', gameMsg.id, gameData, targets) });

  await new Promise(resolve => {
    const collector = gameMsg.createMessageComponentCollector({ time: WOLF_TIME });
    collector.on('end', resolve);
  });

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

async function guardPhase(gameMsg, store) {
  const gameData = store.activeMaSoiGames.get(gameMsg.id);
  const guardId = [...gameData.alive].find(uid => gameData.roles.get(uid) === 'baove');
  gameData.guardTarget = null;
  if (!guardId) return;

  const targets = [...gameData.alive].filter(uid => uid !== guardId && uid !== gameData.prevGuardTarget);
  if (targets.length === 0) return;

  const embed = new EmbedBuilder()
    .setColor('#4444FF')
    .setTitle(`🛡️ ĐÊM ${gameData.round} - BẢO VỆ CHỌN NGƯỜI BẢO VỆ`)
    .setDescription(`Chỉ **Bảo Vệ** mới bấm được. Không thể chọn trùng người đêm trước. Có ${GUARD_TIME / 1000} giây.`);
  await gameMsg.edit({ embeds: [embed], components: buildPlayerButtons('ms_guard', gameMsg.id, gameData, targets) });

  await new Promise(resolve => {
    const collector = gameMsg.createMessageComponentCollector({ time: GUARD_TIME });
    collector.on('end', resolve);
  });

  if (gameData.guardTarget) {
    gameData.prevGuardTarget = gameData.guardTarget;
  }
}

async function doctorPhase(gameMsg, store) {
  const gameData = store.activeMaSoiGames.get(gameMsg.id);
  const doctorId = [...gameData.alive].find(uid => gameData.roles.get(uid) === 'bacsi');
  gameData.doctorTarget = null;
  if (!doctorId) return;

  const targets = [...gameData.alive];
  const embed = new EmbedBuilder()
    .setColor('#22CC22')
    .setTitle(`💊 ĐÊM ${gameData.round} - BÁC SĨ CHỌN NGƯỜI CỨU`)
    .setDescription(`Chỉ **Bác Sĩ** mới bấm được (có thể tự cứu mình). Có ${DOCTOR_TIME / 1000} giây.`);
  await gameMsg.edit({ embeds: [embed], components: buildPlayerButtons('ms_doctor', gameMsg.id, gameData, targets) });

  await new Promise(resolve => {
    const collector = gameMsg.createMessageComponentCollector({ time: DOCTOR_TIME });
    collector.on('end', resolve);
  });
}

async function seerPhase(gameMsg, store) {
  const gameData = store.activeMaSoiGames.get(gameMsg.id);
  const seerId = [...gameData.alive].find(uid => gameData.roles.get(uid) === 'tientri');
  gameData.seerActed = false;
  if (!seerId) return;

  const targets = [...gameData.alive].filter(uid => uid !== seerId);
  if (targets.length === 0) return;

  const embed = new EmbedBuilder()
    .setColor('#CC66FF')
    .setTitle(`🔮 ĐÊM ${gameData.round} - TIÊN TRI SOI VAI TRÒ`)
    .setDescription(`Chỉ **Tiên Tri** mới bấm được, kết quả chỉ mình bạn thấy. Có ${SEER_TIME / 1000} giây.`);
  await gameMsg.edit({ embeds: [embed], components: buildPlayerButtons('ms_seer', gameMsg.id, gameData, targets) });

  await new Promise(resolve => {
    const collector = gameMsg.createMessageComponentCollector({ time: SEER_TIME });
    collector.on('end', resolve);
  });
}

async function witchPhase(gameMsg, store) {
  const gameData = store.activeMaSoiGames.get(gameMsg.id);
  const witchId = [...gameData.alive].find(uid => gameData.roles.get(uid) === 'phuthuy');
  gameData.witchActedTonight = false;
  if (!witchId) return;
  if (gameData.witchHealUsed && gameData.witchPoisonUsed) return;

  const victimName = gameData.wolfVictim ? gameData.participants.get(gameData.wolfVictim) : 'Không ai';
  const embed = new EmbedBuilder()
    .setColor('#9933CC')
    .setTitle(`🧙 ĐÊM ${gameData.round} - PHÙ THỦY HÀNH ĐỘNG`)
    .setDescription(`Sói đã chọn giết: **${victimName}**\nChỉ **Phù Thủy** mới bấm được. Có ${WITCH_TIME / 1000} giây.`);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ms_witchmenu_${gameMsg.id}`).setLabel('🧙 Xem & Hành Động').setStyle(ButtonStyle.Primary)
  );
  await gameMsg.edit({ embeds: [embed], components: [row] });

  await new Promise(resolve => {
    const collector = gameMsg.createMessageComponentCollector({ time: WITCH_TIME });
    collector.on('end', resolve);
  });
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
    desc = '☀️ Trời sáng rồi... may mắn thay, đêm qua không có ai thiệt mạng!';
  } else {
    desc = '☀️ Trời sáng rồi... đêm qua đã có người ra đi:\n' +
      died.map(id => `☠️ **${gameData.participants.get(id)}** (${ROLE_META[gameData.roles.get(id)].label})`).join('\n');
  }

  await gameMsg.edit({
    embeds: [new EmbedBuilder().setColor('#FFAA00').setTitle(`🌅 KẾT QUẢ ĐÊM ${gameData.round}`).setDescription(desc)],
    components: []
  });

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

  await gameMsg.edit({
    embeds: [new EmbedBuilder().setColor('#FF6600').setTitle('🏹 THỢ SĂN TRẢ THÙ!').setDescription(`**${gameData.participants.get(deadId)}** là Thợ Săn! Có ${HUNTER_TIME / 1000} giây để bắn hạ 1 người trước khi ngã xuống.`)],
    components: buildPlayerButtons('ms_hunter', gameMsg.id, gameData, targets)
  });

  await new Promise(resolve => {
    const collector = gameMsg.createMessageComponentCollector({ time: HUNTER_TIME });
    collector.on('end', resolve);
  });

  gameData.pendingHunterId = null;
  const revengeTarget = gameData.hunterRevengeTarget;
  gameData.hunterRevengeTarget = null;

  if (revengeTarget && gameData.alive.has(revengeTarget)) {
    gameData.alive.delete(revengeTarget);
    await gameMsg.edit({
      embeds: [new EmbedBuilder().setColor('#FF0000').setTitle('🏹 PHÁT SÚNG CUỐI CÙNG').setDescription(`💥 **${gameData.participants.get(revengeTarget)}** đã bị Thợ Săn bắn hạ!`)],
      components: []
    });
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

  const winners = [...gameData.participants.keys()].filter(uid => ROLE_META[gameData.roles.get(uid)].faction === winningFaction);
  winners.forEach(uid => store.addTungXu(uid, WIN_REWARD));

  const roleReveal = [...gameData.participants.entries()].map(([uid, name]) => {
    const role = gameData.roles.get(uid);
    const status = gameData.alive.has(uid) ? '🟢 Sống' : '⚫ Đã chết';
    return `• **${name}** - ${ROLE_META[role].label} (${status})`;
  }).join('\n');

  const winEmbed = new EmbedBuilder()
    .setColor(winningFaction === 'soi' ? '#8B0000' : '#22CC22')
    .setTitle(winningFaction === 'soi' ? '🐺 PHE SÓI CHIẾN THẮNG!' : '🧑‍🌾 PHE DÂN LÀNG CHIẾN THẮNG!')
    .setDescription(`Mỗi người thắng cuộc nhận **+${WIN_REWARD.toLocaleString()} Mcoin**!\n\n📋 **Vai trò của mọi người:**\n${roleReveal}`);

  await gameMsg.channel.send({ embeds: [winEmbed] });
  store.activeMaSoiGames.delete(gameMsg.id);
  return true;
}

async function dayDiscussion(gameMsg, store) {
  await gameMsg.edit({
    embeds: [new EmbedBuilder().setColor('#FFCC00').setTitle('💬 THẢO LUẬN').setDescription(`Mọi người có ${DISCUSSION_TIME / 1000} giây để thảo luận trước khi vote treo cổ!`)],
    components: []
  });
  await new Promise(resolve => setTimeout(resolve, DISCUSSION_TIME));
}

async function votePhase(gameMsg, store) {
  const gameData = store.activeMaSoiGames.get(gameMsg.id);
  gameData.votes = new Map();

  const targets = [...gameData.alive];
  await gameMsg.edit({
    embeds: [new EmbedBuilder().setColor('#CC0000').setTitle('🗳️ BỎ PHIẾU TREO CỔ').setDescription(`Mọi người còn sống hãy vote 1 người để treo cổ! Có ${VOTE_TIME / 1000} giây.`)],
    components: buildPlayerButtons('ms_vote', gameMsg.id, gameData, targets)
  });

  await new Promise(resolve => {
    const collector = gameMsg.createMessageComponentCollector({ time: VOTE_TIME });
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
    await gameMsg.edit({
      embeds: [new EmbedBuilder().setColor('#888888').setTitle('🗳️ KẾT QUẢ BỎ PHIẾU').setDescription('Không ai bị treo cổ (không có phiếu nào)!')],
      components: []
    });
    return null;
  }

  const lynchedId = tied[Math.floor(Math.random() * tied.length)];
  gameData.alive.delete(lynchedId);

  await gameMsg.edit({
    embeds: [new EmbedBuilder().setColor('#CC0000').setTitle('🗳️ KẾT QUẢ BỎ PHIẾU').setDescription(`💀 **${gameData.participants.get(lynchedId)}** (${ROLE_META[gameData.roles.get(lynchedId)].label}) đã bị treo cổ!`)],
    components: []
  });

  return lynchedId;
}

module.exports = { startMaSoi, assignRoles, ROLE_META, MIN_PLAYERS };
