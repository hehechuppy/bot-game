// ========== CẬP NHẬT STORE.JS - Thêm vào file store.js ==========

// Thêm vào phần Map/Object declarations
const voiceTimeMap = new Map(); // userId -> { dateKey: seconds, ... }

// ========== HÀM: CỘNG THỜI GIAN VOICE ==========
function addVoiceTime(userId, seconds) {
  const today = getStartOfCurrentDay();
  
  if (!voiceTimeMap.has(userId)) {
    voiceTimeMap.set(userId, {});
  }
  
  const userVoiceData = voiceTimeMap.get(userId);
  const dateKey = today.toString();
  
  userVoiceData[dateKey] = (userVoiceData[dateKey] || 0) + seconds;
}

// ========== HÀM: LẤY BẢNG XẾP HẠNG VOICE (CÓ XỬ LÝ CÙNG PHÚT) ==========
function getVoiceLeaderboard(limit = 10) {
  const today = getStartOfCurrentDay();
  const dateKey = today.toString();
  
  // Tất cả user có voice time hôm nay
  const allVoiceData = [];
  for (const [userId, data] of voiceTimeMap.entries()) {
    const seconds = data[dateKey] || 0;
    if (seconds > 0) {
      allVoiceData.push([userId, seconds]);
    }
  }
  
  if (allVoiceData.length === 0) return [];
  
  // CÁCH XỬ LÝ: Nếu cùng phút sẽ đứng cùng top nhau
  // Chia thành các "phút" (60 giây một nhóm)
  const grouped = {};
  for (const [userId, seconds] of allVoiceData) {
    const minute = Math.floor(seconds / 60); // Nhóm theo phút
    if (!grouped[minute]) grouped[minute] = [];
    grouped[minute].push([userId, seconds]);
  }
  
  // Sort các nhóm theo phút (giảm dần) và flatten
  const sorted = Object.entries(grouped)
    .sort((a, b) => b[0] - a[0]) // Sort nhóm theo phút
    .flatMap(([, users]) => {
      // Trong mỗi nhóm, sort theo giây (nếu muốn chi tiết hơn)
      return users.sort((a, b) => b[1] - a[1]);
    });
  
  return sorted.slice(0, limit);
}

// ========== HÀM: KIỂM TRA VÀ RESET VOICE HÀNG NGÀY + PHÁT THƯỞNG ==========
async function checkAndResetVoiceDay() {
  const today = getStartOfCurrentDay();
  const dateKey = today.toString();
  
  // Lấy top 10 voice hôm nay
  const top10 = getVoiceLeaderboard(10);
  
  if (top10.length === 0) {
    // Không có ai, chỉ reset
    voiceTimeMap.clear();
    return null;
  }
  
  // Chuẩn bị thưởng (x2)
  // ⚠️ LƯU Ý: rewardTiers được định nghĩa ở đây
  // Nếu muốn thay đổi thưởng, chỉnh sửa dòng dưới
  const rewardTiers = [
    { mcoin: 300000, box: 2 }, // Top 1: 300k + 3 hộp
    { mcoin: 200000, box: 1 },  // Top 2: 200k + 2 hộp
    { mcoin: 100000, box: 0 },  // Top 3: 100k + 1 hộp
    { mcoin: 36000, box: 0 }    // Top 4-10: 36k mỗi người
  ];
  
  const winners = [];
  
  for (let i = 0; i < top10.length; i++) {
    const [userId, seconds] = top10[i];
    const rewardData = rewardTiers[i] || rewardTiers[3];
    
    // Thêm thưởng
    addTungXu(userId, rewardData.mcoin);
    if (rewardData.box > 0) {
      addToInventory(userId, 6, rewardData.box); // ID 6 = Lucky Box
    }
    
    winners.push({
      rank: i + 1,
      userId: userId,
      seconds: seconds,
      mcoin: rewardData.mcoin,
      box: rewardData.box
    });
  }
  
  // Reset bảng voice cho ngày tiếp theo
  voiceTimeMap.clear();
  
  return { winners, reset: true };
}

// ========== EXPORT: Thêm vào module.exports ==========
module.exports = {
  // ... các export cũ ...
  voiceTimeMap,
  addVoiceTime,
  getVoiceLeaderboard,
  checkAndResetVoiceDay,
};
