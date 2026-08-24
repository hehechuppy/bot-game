// === ĐÔI VỚI store.js ===
// Thay thế hàm checkAndResetVoiceWeek() bằng checkAndResetVoiceDaily()

function checkAndResetVoiceDaily() {
    const now = Date.now();
    const todayStart = store.getStartOfCurrentDay();
    const nextDayStart = todayStart + 24 * 60 * 60 * 1000;

    // Nếu chưa sang ngày mới, return
    if (now < nextDayStart) return null;

    // Sang ngày mới - lấy top 10 người có thời gian voice cao nhất
    const sorted = Array.from(voiceLeaderboardMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const winners = [];
    for (let rank = 0; rank < sorted.length; rank++) {
        const [userId, seconds] = sorted[rank];
        let mcoin = 0, box = 0;

        if (rank === 0) { mcoin = 50000; box = 2; }      // #1: 50K + 2 box
        else if (rank === 1) { mcoin = 25000; box = 1; } // #2: 25K + 1 box
        else if (rank === 2) { mcoin = 10000; }          // #3: 10K
        else { mcoin = 367; }                             // #4-10: 367 Mcoin

        // Cộng tiền & box vào kho
        store.addTungXu(userId, mcoin);
        if (box > 0) {
            store.addToInventory(userId, 6, box); // ID 6 = Lucky Box
        }

        winners.push({ userId, seconds, mcoin, box, rank: rank + 1 });
    }

    // Reset bảng voice cho ngày mới
    voiceLeaderboardMap.clear();
    voiceDayStart = todayStart + 24 * 60 * 60 * 1000; // Cập nhật ngày bắt đầu

    return winners;
}

// ===== CŨNG THÊM VÀO module.exports =====
// Thay thế export cũ:
// generateBackupData,
// checkAndResetVoiceWeek,

// Thành:
// generateBackupData,
// checkAndResetVoiceDaily,  // ← ĐỔI DÒNG NÀY
