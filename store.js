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
let backupChannelId = '1492795870012379147';

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
    getDailyData,
    addTungXu,
    addLeaderboardScore,
    generateBackupData,
    backupChannelId
};