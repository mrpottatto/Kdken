const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

// ==================== КОНФИГУРАЦИЯ ====================
const BOT_TOKEN = '8326632164:AAF09hmeUOFHuAFxeUPOlCk0MEpfBs5sCVk';

// Конфигурация для спама
const SPAM_CONFIG = {
    chatId: '-1003507363015', // ID чата для спама
    text: 'СЬЕБАЛИСЬ ВАС РЕЙДЯТ КИВИШКИ @kiwishkii', // Текст для спама
    intervalMs: 1000 // Интервал между сообщениями (мс)
};

// Конфигурация для бана
const BAN_CONFIG = {
    chatId: '-1003507363015', // ID чата, где бот будет банить пользователей
    userList: [
        '7999786511',
        '8181140975',
        '6294439507',
        '815236637',
        '7850568376',
        '5959137938',
        '8498787907',
        '5462721514',
        '8557186305',
        '8071005755'
    ]
};

// ==================== ИНИЦИАЛИЗАЦИЯ БОТА ====================
const bot = new Telegraf(BOT_TOKEN);
const games = new Map(); // Для игры в слова

// Проблемные буквы, на которые нельзя начинать слова
const PROBLEM_LETTERS = ['ь', 'ъ', 'ы', 'й'];

// ==================== ИГРА В СЛОВА (slova.js) ====================
function getLastValidLetter(word) {
    if (!word || word.length === 0) return '';
    
    let lastLetter = word.slice(-1).toLowerCase();
    
    if (PROBLEM_LETTERS.includes(lastLetter) && word.length > 1) {
        const prevLetter = word.slice(-2, -1).toLowerCase();
        console.log(`Последняя буква "${lastLetter}" проблемная, используем предпоследнюю "${prevLetter}"`);
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

// ==================== КОМАНДЫ ИГРЫ В СЛОВА ====================
bot.start((ctx) => {
    ctx.reply(
        '🎮 Привет! Я бот для игры в слова.\n\n' +
        'Правила: называйте слово на последнюю букву предыдущего слова.\n' +
        '*Подсказка:* Если слово заканчивается на "ь", "ъ", "ы" или "й", ' +
        'используется предпоследняя буква.\n\n' +
        'Команды:\n' +
        '/start - показать это сообщение\n' +
        '/game - начать новую игру\n' +
        '/stop - закончить игру\n' +
        '/startspam - запустить спам\n' +
        '/stopspam - остановить спам\n' +
        '/ban - заблокировать пользователей из списка',
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

// ==================== КОМАНДЫ СПАМА ====================
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

// ==================== КОМАНДА БАНА ====================
bot.command('ban', async (ctx) => {
    try {
        // Проверяем, что команда вызвана в нужном чате
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

// ==================== ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ (ИГРА) ====================
bot.on('text', (ctx) => {
    const chatId = ctx.chat.id;
    const game = games.get(chatId);
    
    if (!game) return;
    if (ctx.message.text.startsWith('/')) return;
    
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