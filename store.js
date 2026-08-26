const { EmbedBuilder } = require('discord.js');

// ================= HELPER: TẠO KEY THEO SERVER =================
// Mọi map dữ liệu (tiền, kho, streak, daily...) đều dùng key dạng "guildId_userId"
// để tách riêng dữ liệu giữa các server khác nhau.
function gKey(guildId, userId) {
    if (!guildId) throw new Error('gKey() thiếu guildId - phải truyền message.guild.id hoặc interaction.guild.id');
    return `${guildId}_${userId}`;
}

const economyMap = new Map(); // "guildId_userId" -> soTien
const dailyDataMap = new Map(); // "guildId_userId" -> data
const usedCodesMap = new Map(); // "guildId_userId" -> Set(code)
const customCodesMap = new Map([
    ['tanthu', { reward: 1000, expiresAt: null }],
    ['shadowglade', { reward: 1000, expiresAt: null }]
]); // Mã code vẫn dùng chung cho tất cả server (có thể tách riêng nếu muốn)
const leaderboardMap = new Map(); // "guildId_userId" -> diem
const activeBauCuaGames = new Map();
const activeTungXuGames = new Map();
const activeDoanBomGames = new Map();
const activeMaSoiGames = new Map();
const activeCaoNutGames = new Map();
let backupChannelId = '1492795870012379147';

// ================= VOICE LEADERBOARD (RESET HÀNG NGÀY, THEO TỪNG SERVER) =================
const voiceLeaderboardMap = new Map(); // "guildId_userId" -> { totalSeconds, startDay }

function getStartOfCurrentDay() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
}

let voiceDayStart = getStartOfCurrentDay();

// ================= SHOP / VẬT PHẨM (dùng chung cấu hình, không cần tách theo server) =================
const SHOP_ITEMS = [
    {
        id: 1,
        type: 'voicetime',
        name: 'X2 Voice',
        description: 'Nhân đôi Mcoin kiếm được khi ở trong kênh voice, có hiệu lực trong 4 giờ. Bot sẽ nhắn tin riêng báo khi hết hạn.',
        price: 360000,
        durationMs: 4 * 60 * 60 * 1000,
        dailyLimit: null
    },
    {
        id: 2,
        type: 'winmultiplier',
        name: 'X2 Tiền',
        description: 'Khi thắng ở Bầu Cua/Tung Xu, tiền thưởng nhân 2. Mỗi ván (thắng hoặc thua) đều trừ 1 lượt. (5 lượt)',
        price: 1000000,
        uses: 2,
        multiplier: 2,
        dailyLimit: 2
    },
    {
        id: 3,
        type: 'insurance',
        name: 'Bảo Hiểm Thua',
        description: 'Nếu thua ở Bầu Cua/Tung Xu, được hoàn lại 75% số tiền đã thua (1 lần).',
        price: 1000000,
        uses: 1,
        dailyLimit: 2
    },
    {
        id: 6,
        type: 'box',
        name: 'Lucky Box',
        description: 'Hộp may mắn bí ẩn — chỉ biết kết quả sau khi mở! Dùng `.box` để xem, `.unbox` để mở.',
        price: 300000,
        dailyLimit: 5
    }
];

const BOX_TIERS = [
    { chance: 0.50, min: -2000000, max: 500000 },
    { chance: 0.20, min: 36, max: 36 },
    { chance: 0.20, min: 500000, max: 1000000 },
    { chance: 0.09, min: 1000000, max: 2000000 },
    { chance: 0.01, min: 2000000, max: 3000000 }
];

function rollBoxReward() {
    const r = Math.random();
    let cumulative = 0;
    for (const tier of BOX_TIERS) {
        cumulative += tier.chance;
        if (r < cumulative) {
            return Math.floor(Math.random() * (tier.max - tier.min + 1)) + tier.min;
        }
    }
    const last = BOX_TIERS[BOX_TIERS.length - 1];
    return Math.floor(Math.random() * (last.max - last.min + 1)) + last.min;
}

const inventoryMap = new Map();       // "guildId_userId" -> Map<itemId, soLuong>
const activeBuffsMap = new Map();     // "guildId_userId" -> { itemId, usesLeft, multiplier }
const activeInsuranceMap = new Map(); // "guildId_userId" -> soLuotBaoHiemConLai
const activeVoiceBuffsMap = new Map();// "guildId_userId" -> thoiDiemHetHan (timestamp ms)
const streakMap = new Map();          // "guildId_userId" -> { streakDay, lastCheckInDate }

const DIEMDANH_REWARDS = [50000, 50000, 100000, 50000, 100000, 100000, 300000];

// ================= INVENTORY =================
function addToInventory(guildId, userId, itemId, amount) {
    const key = gKey(guildId, userId);
    if (!inventoryMap.has(key)) inventoryMap.set(key, new Map());
    const inv = inventoryMap.get(key);
    inv.set(itemId, (inv.get(itemId) || 0) + amount);
}

function getInventory(guildId, userId) {
    return inventoryMap.get(gKey(guildId, userId)) || new Map();
}

function removeFromInventory(guildId, userId, itemId, amount) {
    const key = gKey(guildId, userId);
    const inv = inventoryMap.get(key);
    if (!inv) return false;
    const qty = inv.get(itemId) || 0;
    if (qty < amount) return false;
    inv.set(itemId, qty - amount);
    if (inv.get(itemId) <= 0) inv.delete(itemId);
    return true;
}

function getBoxCount(guildId, userId, itemId) {
    const inv = inventoryMap.get(gKey(guildId, userId));
    return inv ? (inv.get(itemId) || 0) : 0;
}

function openBoxes(guildId, userId, itemId, count) {
    const item = SHOP_ITEMS.find(i => i.id === itemId && i.type === 'box');
    if (!item) return { success: false, reason: 'not_found' };
    const owned = getBoxCount(guildId, userId, itemId);
    if (owned <= 0) return { success: false, reason: 'no_item' };
    const openCount = Math.min(count, owned);
    removeFromInventory(guildId, userId, itemId, openCount);

    const rewards = [];
    let totalApplied = 0;
    const key = gKey(guildId, userId);
    for (let i = 0; i < openCount; i++) {
        const amount = rollBoxReward();
        const before = economyMap.get(key) || 0;
        const after = Math.max(0, before + amount);
        const actualDelta = after - before;
        economyMap.set(key, after);
        rewards.push(actualDelta);
        totalApplied += actualDelta;
    }

    return { success: true, item, openCount, rewards, total: totalApplied };
}

// ================= BUFFS =================
function activateWinBuff(guildId, userId, itemId, multiplier, uses) {
    const key = gKey(guildId, userId);
    const existing = activeBuffsMap.get(key);
    if (existing && existing.itemId === itemId) {
        existing.usesLeft += uses;
    } else {
        activeBuffsMap.set(key, { itemId, usesLeft: uses, multiplier });
    }
    return activeBuffsMap.get(key);
}

function consumeBuffIfActive(guildId, userId) {
    const key = gKey(guildId, userId);
    const buff = activeBuffsMap.get(key);
    if (!buff) return 1;
    buff.usesLeft -= 1;
    const multiplier = buff.multiplier;
    if (buff.usesLeft <= 0) activeBuffsMap.delete(key);
    return multiplier;
}

function getActiveBuff(guildId, userId) {
    return activeBuffsMap.get(gKey(guildId, userId)) || null;
}

function activateInsurance(guildId, userId, uses) {
    const key = gKey(guildId, userId);
    const current = activeInsuranceMap.get(key) || 0;
    activeInsuranceMap.set(key, current + uses);
    return activeInsuranceMap.get(key);
}

function consumeInsuranceIfLoss(guildId, userId, lossAmount) {
    if (lossAmount <= 0) return 0;
    const key = gKey(guildId, userId);
    const uses = activeInsuranceMap.get(key) || 0;
    if (uses <= 0) return 0;
    const remaining = uses - 1;
    if (remaining <= 0) activeInsuranceMap.delete(key); else activeInsuranceMap.set(key, remaining);
    return Math.floor(lossAmount * 0.75); // Hoàn 75%
}

function activateVoiceBuff(guildId, userId, durationMs) {
    const key = gKey(guildId, userId);
    const now = Date.now();
    const current = activeVoiceBuffsMap.get(key) || 0;
    const base = Math.max(current, now);
    const newExpiry = base + durationMs;
    activeVoiceBuffsMap.set(key, newExpiry);
    return newExpiry;
}

function getVoiceMultiplier(guildId, userId) {
    const key = gKey(guildId, userId);
    const expiresAt = activeVoiceBuffsMap.get(key);
    if (!expiresAt) return 1;
    if (expiresAt <= Date.now()) {
        activeVoiceBuffsMap.delete(key);
        return 1;
    }
    return 2;
}

// ================= DAILY DATA =================
function getDailyData(guildId, userId) {
    const key = gKey(guildId, userId);
    const today = new Date().toDateString();
    let data = dailyDataMap.get(key);
    if (!data || data.date !== today) {
        data = {
            date: today,
            messages: 0,
            games: 0,
            earned: 0,
            claimedMsg: false,
            claimedGame: false,
            claimedEarned: false,
            lastDiemDanh: null,
            itemUses: {},
            itemBuys: {}
        };
        dailyDataMap.set(key, data);
    }
    return data;
}

function canUseItemToday(guildId, userId, itemId) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item || item.dailyLimit == null) return true;
    const dData = getDailyData(guildId, userId);
    const used = dData.itemUses[itemId] || 0;
    return used < item.dailyLimit;
}

function recordItemUse(guildId, userId, itemId) {
    const dData = getDailyData(guildId, userId);
    dData.itemUses[itemId] = (dData.itemUses[itemId] || 0) + 1;
}

function canBuyItemToday(guildId, userId, itemId) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item || item.dailyLimit == null) return true;
    const dData = getDailyData(guildId, userId);
    const bought = dData.itemBuys[itemId] || 0;
    return bought < item.dailyLimit;
}

function recordItemBuy(guildId, userId, itemId) {
    const dData = getDailyData(guildId, userId);
    dData.itemBuys[itemId] = (dData.itemBuys[itemId] || 0) + 1;
}

// ================= TIỀN =================
function addTungXu(guildId, userId, amount) {
    const key = gKey(guildId, userId);
    const current = economyMap.get(key) || 0;
    economyMap.set(key, current + amount);
    if (amount > 0) {
        const dData = getDailyData(guildId, userId);
        if (!dData.claimedEarned) {
            dData.earned += amount;
        }
    }
    return amount;
}

function getBalance(guildId, userId) {
    return economyMap.get(gKey(guildId, userId)) || 0;
}

function setBalance(guildId, userId, amount) {
    economyMap.set(gKey(guildId, userId), amount);
}

function addLeaderboardScore(guildId, userId, betAmount) {
    const key = gKey(guildId, userId);
    const current = leaderboardMap.get(key) || 0;
    leaderboardMap.set(key, current + betAmount);
}

// ================= CHUỖI ĐIỂM DANH 7 NGÀY =================
function processDiemDanh(guildId, userId) {
    const key = gKey(guildId, userId);
    const todayStr = new Date().toDateString();
    let streak = streakMap.get(key);
    if (!streak) {
        streak = { streakDay: 0, lastCheckInDate: null };
        streakMap.set(key, streak);
    }

    if (streak.lastCheckInDate === todayStr) {
        return { success: false, reason: 'already_checked_in' };
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    if (streak.lastCheckInDate === yesterdayStr) {
        streak.streakDay += 1;
    } else {
        streak.streakDay = 1;
    }
    if (streak.streakDay > 7) streak.streakDay = 1;

    const dayIndex = streak.streakDay - 1;
    const reward = DIEMDANH_REWARDS[dayIndex];
    addTungXu(guildId, userId, reward);

    let bonusBox = false;
    if (streak.streakDay === 7) {
        addToInventory(guildId, userId, 6, 1);
        bonusBox = true;
        streak.streakDay = 0;
    }

    streak.lastCheckInDate = todayStr;

    return { success: true, streakDay: dayIndex + 1, reward, bonusBox };
}

// ================= VOICE LEADERBOARD (THEO TỪNG SERVER) =================
function addVoiceTime(guildId, userId, seconds) {
    const key = gKey(guildId, userId);
    if (!voiceLeaderboardMap.has(key)) {
        voiceLeaderboardMap.set(key, { totalSeconds: 0, startDay: voiceDayStart, guildId, userId });
    }
    const data = voiceLeaderboardMap.get(key);
    data.totalSeconds += seconds;
}

// Lấy top N của MỘT server cụ thể (hôm nay)
function getVoiceLeaderboard(guildId, topN = 50) {
    const sorted = Array.from(voiceLeaderboardMap.entries())
        .filter(([_, data]) => data.startDay === voiceDayStart && data.guildId === guildId)
        .sort((a, b) => b[1].totalSeconds - a[1].totalSeconds)
        .slice(0, topN)
        .map(([_, data]) => [data.userId, data.totalSeconds]);

    return sorted;
}

// Reset + phát thưởng CHO TỪNG SERVER riêng biệt.
// Trả về Map<guildId, winners[]> để nơi gọi (ready.js) tự gửi thông báo vào đúng server.
async function checkAndResetVoiceDaily() {
    const currentDayStart = getStartOfCurrentDay();

    if (voiceDayStart >= currentDayStart) {
        return null; // Chưa sang ngày mới
    }

    // Gom danh sách guildId đang có dữ liệu voice hôm qua
    const guildIds = new Set();
    for (const [, data] of voiceLeaderboardMap) {
        if (data.startDay === voiceDayStart) guildIds.add(data.guildId);
    }

    const resultByGuild = new Map();

    const rewardStructure = {
        1: { mcoin: 50000, box: 2 },
        2: { mcoin: 25000, box: 1 },
        3: { mcoin: 10000, box: 0 },
    };

    for (const guildId of guildIds) {
        const top10 = getVoiceLeaderboard(guildId, 10);
        if (top10.length === 0) continue;

        const winners = [];
        for (let i = 0; i < top10.length; i++) {
            const [userId, seconds] = top10[i];
            const rank = i + 1;
            const reward = rewardStructure[rank] || { mcoin: 367, box: 0 };

            addTungXu(guildId, userId, reward.mcoin);
            if (reward.box > 0) addToInventory(guildId, userId, 6, reward.box);

            winners.push({ rank, userId, seconds, mcoin: reward.mcoin, box: reward.box });
        }
        resultByGuild.set(guildId, winners);
    }

    // Reset toàn bộ bảng voice cho ngày mới
    voiceLeaderboardMap.clear();
    voiceDayStart = currentDayStart;

    return resultByGuild; // Map<guildId, winners[]>
}

// ================= BACKUP / RESTORE =================
function generateBackupData() {
    return JSON.stringify({
        economy: Array.from(economyMap.entries()),
        dailyData: Array.from(dailyDataMap.entries()),
        usedCodes: Array.from(usedCodesMap.entries(), ([k, v]) => [k, Array.from(v)]),
        customCodes: Array.from(customCodesMap.entries()),
        leaderboard: Array.from(leaderboardMap.entries()),
        voiceLeaderboard: Array.from(voiceLeaderboardMap.entries()),
        streakMap: Array.from(streakMap.entries()),
        inventoryMap: Array.from(inventoryMap.entries(), ([k, v]) => [k, Array.from(v.entries())]),
        voiceDayStart,
        backupChannelId
    }, null, 2);
}

function restoreBackupData(backupJson) {
    try {
        const data = JSON.parse(backupJson);

        if (data.economy) {
            economyMap.clear();
            for (const [k, v] of data.economy) economyMap.set(k, v);
        }
        if (data.dailyData) {
            dailyDataMap.clear();
            for (const [k, v] of data.dailyData) dailyDataMap.set(k, v);
        }
        if (data.usedCodes) {
            usedCodesMap.clear();
            for (const [k, v] of data.usedCodes) usedCodesMap.set(k, new Set(v));
        }
        if (data.customCodes) {
            customCodesMap.clear();
            for (const [k, v] of data.customCodes) customCodesMap.set(k, v);
        }
        if (data.leaderboard) {
            leaderboardMap.clear();
            for (const [k, v] of data.leaderboard) leaderboardMap.set(k, v);
        }
        if (data.voiceLeaderboard) {
            voiceLeaderboardMap.clear();
            for (const [k, v] of data.voiceLeaderboard) voiceLeaderboardMap.set(k, v);
        }
        if (data.streakMap) {
            streakMap.clear();
            for (const [k, v] of data.streakMap) streakMap.set(k, v);
        }
        if (data.inventoryMap) {
            inventoryMap.clear();
            for (const [k, v] of data.inventoryMap) inventoryMap.set(k, new Map(v));
        }
        if (data.voiceDayStart) voiceDayStart = data.voiceDayStart;
        if (data.backupChannelId) backupChannelId = data.backupChannelId;

        return true;
    } catch (err) {
        console.error('Lỗi restore backup:', err);
        return false;
    }
}

module.exports = {
    gKey,
    economyMap,
    dailyDataMap,
    usedCodesMap,
    customCodesMap,
    leaderboardMap,
    voiceLeaderboardMap,
    activeBauCuaGames,
    activeTungXuGames,
    activeDoanBomGames,
    activeMaSoiGames,
    activeCaoNutGames,
    SHOP_ITEMS,
    inventoryMap,
    activeBuffsMap,
    activeInsuranceMap,
    activeVoiceBuffsMap,
    streakMap,
    addToInventory,
    getInventory,
    removeFromInventory,
    getBoxCount,
    openBoxes,
    activateWinBuff,
    consumeBuffIfActive,
    getActiveBuff,
    activateInsurance,
    consumeInsuranceIfLoss,
    activateVoiceBuff,
    getVoiceMultiplier,
    canUseItemToday,
    recordItemUse,
    canBuyItemToday,
    recordItemBuy,
    processDiemDanh,
    getDailyData,
    addTungXu,
    getBalance,
    setBalance,
    addLeaderboardScore,
    addVoiceTime,
    getVoiceLeaderboard,
    checkAndResetVoiceDaily,
    getStartOfCurrentDay,
    generateBackupData,
    restoreBackupData,
    backupChannelId,
    voiceDayStart
};
