if (command === 'shop') {
  const desc = store.SHOP_ITEMS.map(item =>
    `**#${item.id} — ${item.name}**\n${item.description}\n💰 Giá: **${item.price.toLocaleString()} Mcoin**\n\n`
  ).join('');
  const shopEmbed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🛒 CỬA HÀNG VẬT PHẨM')
    .setDescription(desc + 'Dùng `.mua <id>` để mua, `.sd <id>` để kích hoạt vật phẩm đã mua.');
  return message.reply({ embeds: [shopEmbed] });
}

if (command === 'mua') {
  const itemId = parseInt(args[0]);
  const item = store.SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return message.reply('❌ Không tìm thấy vật phẩm với ID này! Dùng `.shop` để xem danh sách.');

  const bal = store.economyMap.get(userId) || 0;
  if (bal < item.price) {
    return message.reply(`❌ Bạn không đủ Mcoin! Cần **${item.price.toLocaleString()} Mcoin**, bạn có **${bal.toLocaleString()} Mcoin**.`);
  }

  store.economyMap.set(userId, bal - item.price);
  store.addToInventory(userId, item.id, 1);
  return message.reply(`✅ Đã mua **${item.name}**! Dùng \`.sd ${item.id}\` để kích hoạt.`);
}

if (command === 'sd') {
  const itemId = parseInt(args[0]);
  const result = store.useItem(userId, itemId);
  if (!result.success) {
    if (result.reason === 'not_found') return message.reply('❌ Không tìm thấy vật phẩm với ID này!');
    if (result.reason === 'no_item') return message.reply('❌ Bạn chưa sở hữu vật phẩm này! Dùng `.mua <id>` để mua trước.');
  }
  return message.reply(`✨ Đã kích hoạt **${result.item.name}**! Hiệu ứng x${result.item.multiplier} tiền thắng đang có hiệu lực trong **${result.buff.usesLeft} lượt** chơi tiếp theo (Bầu Cua / Tung Xu).`);
}
