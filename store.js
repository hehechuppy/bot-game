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
        name: 'X3 Tiền',
        description: 'Khi thắng ở Bầu Cua/Tung Xu, tiền thưởng nhân 3. Mỗi ván (thắng hoặc thua) đều trừ 1 lượt.',
        price: 1000000,
        uses: 5,
        multiplier: 3
    }
];

const inventoryMap = new Map();   // userId -> Map<itemId, soLuong>
const activeBuffsMap = new Map(); // userId -> { itemId, usesLeft, multiplier }

function addToInventory(userId, itemId, amount) {
    if (!inventoryMap.has(userId)) inventoryMap.set(userId, new Map());
    const inv = inventoryMap.get(userId);
    inv.set(itemId, (inv.get(itemId) || 0) + amount);
}

function getInventory(userId) {
    return inventoryMap.get(userId) || new Map();
}

function useItem(userId, itemId) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return { success: false, reason: 'not_found' };

    const inv = inventoryMap.get(userId);
    const qty = inv ? (inv.get(itemId) || 0) : 0;
    if (qty <= 0) return { success: false, reason: 'no_item' };

    inv.set(itemId, qty - 1);
    if (inv.get(itemId) <= 0) inv.delete(itemId);

    const existing = activeBuffsMap.get(userId);
    if (existing && existing.itemId === itemId) {
        existing.usesLeft += item.uses;
    } else {
        activeBuffsMap.set(userId, { itemId: item.id, usesLeft: item.uses, multiplier: item.multiplier });
    }

    return { success: true, item, buff: activeBuffsMap.get(userId) };
}

function consumeBuffIfActive(userId) {
    const buff = activeBuffsMap.get(userId);
    if (!buff) return 1;

    buff.usesLeft -= 1;
    const multiplier = buff.multiplier;
    if (buff.usesLeft <= 0) {
        activeBuffsMap.delete(userId);
    }
    return multiplier;
}

function getActiveBuff(userId) {
    return activeBuffsMap.get(userId) || null;
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
            lastDiemDanh: null
        };
        dailyDataMap.set(userId, data);
    }
    return data;
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
    addToInventory,
    getInventory,
    useItem,
    consumeBuffIfActive,
    getActiveBuff,
    getDailyData,
    addTungXu,
    addLeaderboardScore,
    generateBackupData,
    backupChannelId
};
