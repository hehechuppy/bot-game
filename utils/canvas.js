const { createCanvas } = require('canvas');

async function createLeaderboardImage(sorted, client) {
    const canvas = createCanvas(800, 500);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1e1f22';
    ctx.fillRect(0, 0, 800, 500);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 BẢNG XẾP HẠNG SỐ DƯ MCOIN 🏆', 400, 50);

    let startY = 120;
    for (let i = 0; i < sorted.length; i++) {
        const [uId, balance] = sorted[i];
        let userObj = client.users.cache.get(uId);
        let username = userObj ? userObj.username : `User ID: ${uId}`;

        ctx.fillStyle = i === 0 ? '#FFD700' : (i === 1 ? '#C0C0C0' : (i === 2 ? '#CD7F32' : '#ffffff'));
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Top ${i + 1}.`, 60, startY);
        ctx.fillText(username, 150, startY);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#57F287';
        ctx.fillText(`${balance.toLocaleString()} Mcoin`, 740, startY);

        startY += 35;
    }
    return canvas.toBuffer();
}

module.exports = { createLeaderboardImage };