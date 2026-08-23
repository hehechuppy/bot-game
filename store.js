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
const activeCaoNutGames = new Map();
let backupChannelId = '1492795870012379147';

// ================= VOICE LEADERBOARD (RESET HÀNG NGÀY) =================
const voiceLeaderboardMap = new Map(); // userId -> { totalSeconds: number, startDay: timestamp }
let voiceDayStart = new Date().setHours(0, 0, 0, 0); // timestamp bắt đầu ngày hiện tại

// ================= SHOP / VẬT PHẨM =================
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
        uses: 5,
        multiplier: 2,
        dailyLimit: 5
    },
    {
        id: 3,
        type: 'insurance',
        name: 'Bảo Hiểm Thua',
        description: 'Nếu thua ở Bầu Cua/Tung Xu, được hoàn lại 75% số tiền đã thua (1 lần).',
        price: 1000000,
        uses: 1,
        refundPercent: 0.75,
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
    return Math.floor(lossAmount * 0.75); // Hoàn lại 75%
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
            itemBuys: {},   // itemId -> số lần đã mua hôm nay
            itemUses: {}    // itemId -> số lần đã dùng .sd hôm nay
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
    const bought = dData.itemBuys[itemId] || 0;
    return bought < item.dailyLimit;
}

function recordItemBuy(userId, itemId) {
    const dData = getDailyData(userId);
    dData.itemBuys[itemId] = (dData.itemBuys[itemId] || 0) + 1;
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
        addToInventory(userId, 6, 1); // tặng thêm 1 Lucky Box (id 6)
        bonusBox = true;
        streak.streakDay = 0; // đủ 7 ngày -> reset chuỗi, lần điểm danh liên tiếp tiếp theo sẽ tính lại từ ngày 1
    }

    streak.lastCheckInDate = todayStr;

    return { success: true, streakDay: dayIndex + 1, reward, bonusBox };
}

// ================= VOICE LEADERBOARD FUNCTIONS =================

// Mỗi 60 giây, gọi hàm này để cộng thời gian voice
function addVoiceTime(userId, seconds) {
    if (!voiceLeaderboardMap.has(userId)) {
        voiceLeaderboardMap.set(userId, { totalSeconds: 0, startDay: voiceDayStart });
    }
    const data = voiceLeaderboardMap.get(userId);
    data.totalSeconds += seconds;
}

// Lấy top N người có thời gian voice nhiều nhất (hôm nay)
function getVoiceLeaderboard(topN = 50) {
    const sorted = Array.from(voiceLeaderboardMap.entries())
        .filter(([_, data]) => data.startDay === voiceDayStart) // chỉ lấy hôm nay
        .sort((a, b) => b[1].totalSeconds - a[1].totalSeconds)
        .slice(0, topN)
        .map(([userId, data], index) => [userId, data.totalSeconds]);
    
    return sorted;
}

// Tính timestamp reset ngày mai (00:00 AM ngày hôm sau)
function getNextResetTimestamp() {
    const now = new Date();
    const nextReset = new Date(now);
    nextReset.setDate(nextReset.getDate() + 1);
    nextReset.setHours(0, 0, 0, 0);
    
    return nextReset.getTime();
}

// Kiểm tra xem đã sang ngày mới chưa, nếu có thì:
// 1. Phát thưởng top 1-10
// 2. Reset bảng xếp hạng
// 3. Trả về mảng người thắng (để gửi embed)
async function checkAndResetVoiceDay() {
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    
    // Chưa sang ngày mới
    if (voiceDayStart >= todayStart) {
        return null;
    }
    
    // Đã sang ngày mới - lấy top 10 hôm qua
    const top10 = getVoiceLeaderboard(10);
    
    if (top10.length === 0) {
        // Không có ai treo voice hôm qua
        voiceDayStart = todayStart;
        return null;
    }
    
    const rewardStructure = {
        1: { mcoin: 50000, box: 2 },
        2: { mcoin: 25000, box: 1 },
        3: { mcoin: 10000, box: 0 },
        // 4-10: 367 Mcoin
    };
    
    const winners = [];
    
    for (let i = 0; i < top10.length; i++) {
        const [userId, seconds] = top10[i];
        const rank = i + 1;
        
        let reward = rewardStructure[rank] || { mcoin: 367, box: 0 };
        
        // Cấp thưởng Mcoin
        addTungXu(userId, reward.mcoin);
        
        // Cấp thưởng Lucky Box nếu có
        if (reward.box > 0) {
            addToInventory(userId, 6, reward.box); // itemId 6 = Lucky Box
        }
        
        winners.push({
            rank,
            userId,
            seconds,
            mcoin: reward.mcoin,
            box: reward.box
        });
    }
    
    // Reset bảng xếp hạng cho ngày mới
    voiceLeaderboardMap.clear();
    voiceDayStart = todayStart;
    
    return winners;
}

function generateBackupData() {
    return JSON.stringify({
        economy: Array.from(economyMap.entries()),
        dailyData: Array.from(dailyDataMap.entries()),
        usedCodes: Array.from(usedCodesMap.entries(), ([k, v]) => [k, Array.from(v)]),
        customCodes: Array.from(customCodesMap.entries()),
        leaderboard: Array.from(leaderboardMap.entries()),
        voiceLeaderboard: Array.from(voiceLeaderboardMap.entries()),
        voiceDayStart,
        backupChannelId
    }, null, 2);
}

module.exports = {
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
    addLeaderboardScore,
    addVoiceTime,
    getVoiceLeaderboard,
    checkAndResetVoiceDay,
    getNextResetTimestamp,
    generateBackupData,
    backupChannelId
};
