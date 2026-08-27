// WITCH POISON
          if (action === 'witchpoison') {
            await interaction.deferUpdate();

            if (
              myRole !== 'phuthuy' ||
              gameData.witchActedTonight ||
              gameData.witchPoisonUsed
            ) {
              return await safeRespond(() =>
                interaction.editReply({
                  content: '❌ Không thể dùng lúc này!',
                  embeds: [],
                  components: []
                })
              );
            }

            const targetId = parts[2];
            gameData.witchPoisonTarget = targetId;
            gameData.witchPoisonUsed = true;
            gameData.witchActedTonight = true;

            return await safeRespond(() =>
              interaction.editReply({
                content: `☠️ Đã chọn đầu độc **${gameData.participants.get(targetId)}**!`,
                embeds: [],
                components: []
              })
            );
          }

          // WITCH SKIP
          if (action === 'witchskip') {
            await interaction.deferUpdate();

            if (myRole !== 'phuthuy' || gameData.witchActedTonight) {
              return await safeRespond(() =>
                interaction.editReply({
                  content: '❌ Không thể dùng lúc này!',
                  embeds: [],
                  components: []
                })
              );
            }

            gameData.witchActedTonight = true;

            return await safeRespond(() =>
              interaction.editReply({
                content: '⏭️ Bạn đã bỏ qua đêm nay.',
                embeds: [],
                components: []
              })
            );
          }
        }
      }
    } catch (error) {
      console.error('❌ Lỗi xử lý Interaction:', error);
    }
  }
};
