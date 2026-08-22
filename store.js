// ================= SHOP / VẬT PHẨM =================
const SHOP_ITEMS = [
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
