// ================================================================
// ĐOẠN NÀY CẦN DÁN VÀO FILE store.js CỦA BẠN (mình không có sẵn
// nội dung đầy đủ của store.js nên không thể gộp trực tiếp).
//
// Cách làm:
// 1. Dán khối code bên dưới vào GẦN CUỐI store.js, ngay TRƯỚC dòng
//    "module.exports = { ... }"
// 2. Thêm 5 tên hàm/biến mới (voiceTimeMap, addVoiceTime,
//    getVoiceLeaderboard, getNextResetTimestamp,
//    checkAndResetVoiceWeek) vào bên trong module.exports hiện có,
//    giữ nguyên toàn bộ các export cũ.
// ================================================================

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

// Gọi hàm này định kỳ (ready.js gọi mỗi 30 giây). Tự phát hiện sang
// tuần mới -> phát thưởng top 1-10 + reset bảng xếp hạng.
async function checkAndResetVoiceWeek() {
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

  return winners; // trả về danh sách để bot thông báo trong ready.js
}

// ================================================================
// LƯU Ý QUAN TRỌNG:
// - Đoạn trên gọi addTungXu(...) và addToInventory(...) — đây là
//   2 hàm mình thấy bạn ĐÃ CÓ SẴN trong store.js (dùng ở
//   messageCreate.js). Nếu tên hàm thực tế trong store.js của bạn
//   khác đi, hãy đổi lại tên cho khớp.
// - Nếu bot restart, voiceTimeMap sẽ mất dữ liệu (đang lưu trong
//   RAM). Nếu bạn muốn lưu vào backup cùng với các Map khác (như
//   economyMap), nói mình biết cấu trúc backup hiện tại để mình
//   bổ sung.
// ================================================================
