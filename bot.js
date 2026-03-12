const { Telegraf } = require('telegraf');

const BOT_TOKEN = '8326632164:AAF09hmeUOFHuAFxeUPOlCk0MEpfBs5sCVk';
const SUPER_ADMIN_ID = 7947576295; // Ваш ID

const bot = new Telegraf(BOT_TOKEN);

bot.command('giveadm', async (ctx) => {
    try {
        // Проверки
        if (ctx.chat.type === 'private') return ctx.reply('❌ Только в группах!');
        if (ctx.from.id !== SUPER_ADMIN_ID) return ctx.reply('❌ Нет прав!');

        // Проверка прав бота
        const botMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
        if (!botMember.status.includes('administrator')) {
            return ctx.reply('❌ Бот не админ!');
        }

        // Получаем ID из сообщения
        const ids = ctx.message.text
            .split('\n')
            .slice(1)
            .map(id => id.trim())
            .filter(id => id && /^\d+$/.test(id));

        if (ids.length === 0) {
            return ctx.reply('❌ Пример:\n/giveadm\n123456789\n987654321');
        }

        // Выдаем права каждому
        for (const userId of ids) {
            try {
                await ctx.telegram.promoteChatMember(ctx.chat.id, parseInt(userId), {
                    can_change_info: true,
                    can_delete_messages: true,
                    can_invite_users: true,
                    can_restrict_members: true,
                    can_pin_messages: true,
                    can_promote_members: false,
                    can_manage_chat: true
                });
            } catch (e) {
                // Игнорируем ошибки для простоты
            }
        }

        await ctx.reply(`✅ Права выданы ${ids.length} пользователям`);
        
    } catch (error) {
        ctx.reply('❌ Ошибка');
    }
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
