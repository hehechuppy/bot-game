const economyMap = new Map();
const dailyDataMap = new Map();
const usedCodesMap = new Map();
const customCodesMap = new Map([
    ['tanthu', { reward: 1000, expiresAt: null }],
    ['shadowglade', { reward: 1000, expiresAt: null }]
]);
const leaderboardMap = new Map();
const activeBauCuaGames = new Map();
const activeTungXuGames = new Map();
const activeDoanBomGames = new Map();
const activeMaSoiGames = new Map();
let backupChannelId = '1492795870012379147';

// ================= SHOP / VẬT PHẨM =================
const SHOP_ITEMS = [
    {
        id: 1,
        type: 'winmultiplier',
        name: 'X3 Mcoin',
        description: 'Khi thắng ở Bầu Cua/Tung Xu, tiền thưởng nhân 3. Mỗi ván (thắng hoặc thua) đều trừ 1 lượt. (2 lượt)',
        price: 1500000,
        uses: 2,
        multiplier: 3,
        dailyLimit: 1
    },
    {
        id: 2,
        type: 'voicetime',
        name: 'X2 Voice',
        description: 'Nhân đôi Mcoin kiếm được khi ở trong kênh voice, có hiệu lực trong 4 giờ. Bot sẽ nhắn tin riêng báo khi hết hạn.',
        price: 360000,
        durationMs: 4 * 60 * 60 * 1000,
        dailyLimit: null
    },
    {
        id: 3,
        type: 'winmultiplier',
        name: 'X2 Tiền',
        description: 'Khi thắng ở Bầu Cua/Tung Xu, tiền thưởng nhân 2. Mỗi ván (thắng hoặc thua) đều trừ 1 lượt. (5 lượt)',
        price: 1000000,
        uses: 5,
        multiplier: 2,
        dailyLimit: 5
    },
    {
        id: 4,
        type: 'insurance',
        name: 'Bảo Hiểm Thua',
        description: 'Nếu thua ở Bầu Cua/Tung Xu, được hoàn lại toàn bộ tiền đã thua (1 lần).',
        price: 1000000,
        uses: 1,
        dailyLimit: 1
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

// Tỷ lệ Lucky Box - KHÔNG hiển thị cho người dùng ở bất kỳ đâu
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

const inventoryMap = new Map();   // userId -> Map<itemId, soLuong>
const activeBuffsMap = new Map(); // userId -> { itemId, usesLeft, multiplier }
const activeInsuranceMap = new Map(); // userId -> soLuotBaoHiemConLai
const activeVoiceBuffsMap = new Map(); // userId -> thoiDiemHetHan (timestamp ms)
const streakMap = new Map(); // userId -> { streakDay: 0-7, lastCheckInDate }

const DIEMDANH_REWARDS = [50000, 50000, 100000, 50000, 100000, 100000, 300000]; // ngày 1..7

function addToInventory(userId, itemId, amount) {
    if (!inventoryMap.has(userId)) inventoryMap.set(userId, new Map());
    const inv = inventoryMap.get(userId);
    inv.set(itemId, (inv.get(itemId) || 0) + amount);
}

function getInventory(userId) {
    return inventoryMap.get(userId) || new Map();
}

function removeFromInventory(userId, itemId, amount) {
    const inv = inventoryMap.get(userId);
    if (!inv) return false;
    const qty = inv.get(itemId) || 0;
    if (qty < amount) return false;
    inv.set(itemId, qty - amount);
    if (inv.get(itemId) <= 0) inv.delete(itemId);
    return true;
}

function getBoxCount(userId, itemId) {
    const inv = inventoryMap.get(userId);
    return inv ? (inv.get(itemId) || 0) : 0;
}

function openBoxes(userId, itemId, count) {
    const item = SHOP_ITEMS.find(i => i.id === itemId && i.type === 'box');
    if (!item) return { success: false, reason: 'not_found' };
    const owned = getBoxCount(userId, itemId);
    if (owned <= 0) return { success: false, reason: 'no_item' };
    const openCount = Math.min(count, owned);
    removeFromInventory(userId, itemId, openCount);

    const rewards = [];
    let totalApplied = 0;
    for (let i = 0; i < openCount; i++) {
        const amount = rollBoxReward();
        const before = economyMap.get(userId) || 0;
        const after = Math.max(0, before + amount); // không để số dư âm
        const actualDelta = after - before;
        economyMap.set(userId, after);
        rewards.push(actualDelta);
        totalApplied += actualDelta;
    }

    return { success: true, item, openCount, rewards, total: totalApplied };
}

function activateWinBuff(userId, itemId, multiplier, uses) {
    const existing = activeBuffsMap.get(userId);
    if (existing && existing.itemId === itemId) {
        existing.usesLeft += uses;
    } else {
        activeBuffsMap.set(userId, { itemId, usesLeft: uses, multiplier });
    }
    return activeBuffsMap.get(userId);
}

// Gọi đúng 1 lần mỗi ván (Bầu Cua/Tung Xu) cho mỗi người chơi, BẤT KỂ thắng hay thua.
function consumeBuffIfActive(userId) {
    const buff = activeBuffsMap.get(userId);
    if (!buff) return 1;
    buff.usesLeft -= 1;
    const multiplier = buff.multiplier;
    if (buff.usesLeft <= 0) activeBuffsMap.delete(userId);
    return multiplier;
}

function getActiveBuff(userId) {
    return activeBuffsMap.get(userId) || null;
}

function activateInsurance(userId, uses) {
    const current = activeInsuranceMap.get(userId) || 0;
    activeInsuranceMap.set(userId, current + uses);
    return activeInsuranceMap.get(userId);
}

// Chỉ tiêu lượt bảo hiểm khi THUA (lossAmount > 0). Trả về số tiền cần hoàn lại (0 nếu không áp dụng).
function consumeInsuranceIfLoss(userId, lossAmount) {
    if (lossAmount <= 0) return 0;
    const uses = activeInsuranceMap.get(userId) || 0;
    if (uses <= 0) return 0;
    const remaining = uses - 1;
    if (remaining <= 0) activeInsuranceMap.delete(userId); else activeInsuranceMap.set(userId, remaining);
    return lossAmount;
}

function activateVoiceBuff(userId, durationMs) {
    const now = Date.now();
    const current = activeVoiceBuffsMap.get(userId) || 0;
    const base = Math.max(current, now); // nếu đang có hiệu lực thì cộng dồn thêm giờ, không ghi đè ngắn hơn
    const newExpiry = base + durationMs;
    activeVoiceBuffsMap.set(userId, newExpiry);
    return newExpiry;
}

function getVoiceMultiplier(userId) {
    const expiresAt = activeVoiceBuffsMap.get(userId);
    if (!expiresAt) return 1;
    if (expiresAt <= Date.now()) {
        activeVoiceBuffsMap.delete(userId);
        return 1;
    }
    return 2;
}

function getDailyData(userId) {
    const today = new Date().toDateString();
    let data = dailyDataMap.get(userId);
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
            itemUses: {} // itemId -> số lần đã dùng .sd hôm nay (dùng cho giới hạn/ngày)
        };
        dailyDataMap.set(userId, data);
    }
    return data;
}

function canUseItemToday(userId, itemId) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item || item.dailyLimit == null) return true;
    const dData = getDailyData(userId);
    const used = dData.itemUses[itemId] || 0;
    return used < item.dailyLimit;
}

function recordItemUse(userId, itemId) {
    const dData = getDailyData(userId);
    dData.itemUses[itemId] = (dData.itemUses[itemId] || 0) + 1;
}

function canBuyItemToday(userId, itemId) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item || item.dailyLimit == null) return true;
    const dData = getDailyData(userId);
    const bought = dData.itemUses[itemId] || 0;
    return bought < item.dailyLimit;
}

function recordItemBuy(userId, itemId) {
    const dData = getDailyData(userId);
    dData.itemUses[itemId] = (dData.itemUses[itemId] || 0) + 1;
}

function addTungXu(userId, amount) {
    const current = economyMap.get(userId) || 0;
    economyMap.set(userId, current + amount);
    if (amount > 0) {
        const dData = getDailyData(userId);
        if (!dData.claimedEarned) {
            dData.earned += amount;
        }
    }
    return amount;
}

function addLeaderboardScore(userId, betAmount) {
    const current = leaderboardMap.get(userId) || 0;
    leaderboardMap.set(userId, current + betAmount);
}

// ================= CHUỖI ĐIỂM DANH 7 NGÀY =================
function processDiemDanh(userId) {
    const todayStr = new Date().toDateString();
    let streak = streakMap.get(userId);
    if (!streak) {
        streak = { streakDay: 0, lastCheckInDate: null };
        streakMap.set(userId, streak);
    }

    if (streak.lastCheckInDate === todayStr) {
        return { success: false, reason: 'already_checked_in' };
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    if (streak.lastCheckInDate === yesterdayStr) {
        streak.streakDay += 1; // điểm danh liên tiếp -> tiến thêm 1 ngày
    } else {
        streak.streakDay = 1; // bỏ lỡ 1 ngày (hoặc lần đầu) -> reset về ngày 1
    }
    if (streak.streakDay > 7) streak.streakDay = 1;

    const dayIndex = streak.streakDay - 1;
    const reward = DIEMDANH_REWARDS[dayIndex];
    addTungXu(userId, reward);

    let bonusBox = false;
    if (streak.streakDay === 7) {
        addToInventory(userId, 6, 1); // tặng thêm 1 Lucky Box
        bonusBox = true;
        streak.streakDay = 0; // đủ 7 ngày -> reset chuỗi, lần điểm danh liên tiếp tiếp theo sẽ tính lại từ ngày 1
    }

    streak.lastCheckInDate = todayStr;

    return { success: true, streakDay: dayIndex + 1, reward, bonusBox };
}

function generateBackupData() {
    return JSON.stringify({
        economy: Array.from(economyMap.entries()),
        dailyData: Array.from(dailyDataMap.entries()),
        usedCodes: Array.from(usedCodesMap.entries(), ([k, v]) => [k, Array.from(v)]),
        customCodes: Array.from(customCodesMap.entries()),
        leaderboard: Array.from(leaderboardMap.entries()),
        backupChannelId
    }, null, 2);
}

// ================= VOICE TIME LEADERBOARD (RESET HÀNG TUẦN) =================
const voiceTimeMap = new Map(); // userId -> số giây đã ở trong voice tuần này

function getWeekStart(ts) {
  const d = new Date(ts);
  const day = d.getUTCDay(); // 0 = CN, 1 = T2 ... 6 = T7
  const diff = day === 0 ? 6 : day - 1; // số ngày lùi về Thứ 2
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - diff);
  return d.getTime();
}

let voiceWeekStart = getWeekStart(Date.now());

function addVoiceTime(userId, seconds) {
  voiceTimeMap.set(userId, (voiceTimeMap.get(userId) || 0) + seconds);
}

function getVoiceLeaderboard(limit = 10) {
  return Array.from(voiceTimeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function getNextResetTimestamp() {
  return voiceWeekStart + 7 * 24 * 60 * 60 * 1000;
}

const VOICE_TOP3_REWARDS = [
  { mcoin: 50000, box: 2 }, // top 1
  { mcoin: 25000, box: 1 }, // top 2
  { mcoin: 10000, box: 0 }, // top 3
];
const VOICE_TOP4_10_REWARD = 367;

// Gọi hàm này định kỳ (vd mỗi phút). Tự phát hiện sang tuần mới -> phát thưởng + reset.
async function checkAndResetVoiceWeek(client) {
  const currentWeekStart = getWeekStart(Date.now());
  if (currentWeekStart === voiceWeekStart) return null; // chưa sang tuần mới, không làm gì

  const top10 = getVoiceLeaderboard(10);
  const winners = [];

  for (let i = 0; i < top10.length; i++) {
    const [userId, seconds] = top10[i];
    const rank = i + 1;
    let mcoin = 0, box = 0;

    if (rank <= 3) {
      mcoin = VOICE_TOP3_REWARDS[rank - 1].mcoin;
      box = VOICE_TOP3_REWARDS[rank - 1].box;
    } else {
      mcoin = VOICE_TOP4_10_REWARD;
    }

    if (mcoin > 0) addTungXu(userId, mcoin);
    if (box > 0) addToInventory(userId, 6, box);

    winners.push({ userId, rank, mcoin, box, seconds });
  }

  voiceTimeMap.clear();
  voiceWeekStart = currentWeekStart;

  return winners; // trả về danh sách để bot có thể thông báo
}

module.exports = {
    economyMap,
    dailyDataMap,
    usedCodesMap,
    customCodesMap,
    leaderboardMap,
    activeBauCuaGames,
    activeTungXuGames,
    activeDoanBomGames,
    activeMaSoiGames,
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
    addLeaderboardScore,
    generateBackupData,
    backupChannelId
};
