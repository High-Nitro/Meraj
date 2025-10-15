// index.js
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import path from "path";

// ====== تنظیمات ======
const TOKEN = "7346348218:AAGU8aUR-07GtJUZxw6JQ2X2Os9Jm_ZhGYU";
const ADMIN_ID = 6823146420; // ایدی ادمین
const CARD_NUMBER = "6219-8618-2900-7888";

const bot = new TelegramBot(TOKEN, { polling: true });
const BALANCE_FILE = "./balances.json";

// ====== مدیریت داده ======
let balances = {};
if (fs.existsSync(BALANCE_FILE)) {
    balances = JSON.parse(fs.readFileSync(BALANCE_FILE, "utf-8"));
}

function saveBalances() {
    fs.writeFileSync(BALANCE_FILE, JSON.stringify(balances, null, 2));
}

function ensureUser(user) {
    const uid = String(user.id);
    if (!balances[uid]) {
        balances[uid] = {
            coins: 0,
            username: user.username || "",
            first_name: user.first_name || "",
        };
        saveBalances();
    }
}

function addBalance(userId, amount) {
    const uid = String(userId);
    ensureUser({ id: uid });
    balances[uid].coins += amount;
    saveBalances();
    return balances[uid].coins;
}

function getBalance(userId) {
    const uid = String(userId);
    ensureUser({ id: uid });
    return balances[uid].coins;
}

// ====== منوها ======
const MAIN_KEYBOARD = {
    reply_markup: {
        keyboard: [
            [{ text: "🛒 خرید وایرگارد" }],
            [{ text: "💳 شارژ کیف‌پول" }],
            [{ text: "👤 اطلاعات کاربری" }],
            [{ text: "📞 پشتیبانی" }]
        ],
        resize_keyboard: true
    }
};

const BACK_KEYBOARD = {
    reply_markup: {
        keyboard: [[{ text: "⬅️ بازگشت" }]],
        resize_keyboard: true
    }
};

// ====== وایرگارد ======
const WIRED_ITEMS = {
    "1ماه - 36گیگ - 1 کاربره - 95هزار تومان": 95000,
    "2ماه - 70گیگ - 1 کاربره - 140هزار تومان": 140000
};

// ====== پیام‌ها ======
const WELCOME_TEXT = "🥕 سلام! من CarrotBot هستم.\nیک گزینه انتخاب کن 👇";

// ====== دستور start ======
bot.onText(/\/start/, (msg) => {
    ensureUser(msg.from);
    bot.sendMessage(msg.chat.id, WELCOME_TEXT, MAIN_KEYBOARD);
});

// ====== منو ======
bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from.id;

    ensureUser(msg.from);

    // بازگشت
    if (text === "⬅️ بازگشت") {
        bot.sendMessage(chatId, "بازگشتی به منوی اصلی 🔙", MAIN_KEYBOARD);
        return;
    }

    // خرید وایرگارد
    if (text === "🛒 خرید وایرگارد") {
        let keyboard = { reply_markup: { keyboard: [], resize_keyboard: true } };
        for (let item in WIRED_ITEMS) {
            keyboard.reply_markup.keyboard.push([{ text: item }]);
        }
        keyboard.reply_markup.keyboard.push([{ text: "⬅️ بازگشت" }]);
        bot.sendMessage(chatId, `🛒 فروشگاه وایرگارد\nموجودی شما: ${getBalance(userId)} تومان\nانتخاب کنید:`, keyboard);
        return;
    }

    // خرید وایرگارد انتخابی
    if (WIRED_ITEMS[text]) {
        const price = WIRED_ITEMS[text];
        const balance = getBalance(userId);
        if (balance >= price) {
            addBalance(userId, -price);
            bot.sendMessage(chatId, `✅ خرید موفق!\n${text}\nلطفاً منتظر ارسال فایل توسط ادمین باشید.`);
            bot.sendMessage(ADMIN_ID, `کاربر @${msg.from.username || msg.from.first_name} خرید کرد:\n${text}`);
        } else {
            bot.sendMessage(chatId, `❌ موجودی کافی نیست.\nموجودی شما: ${balance} تومان\nلطفاً کیف‌پول خود را شارژ کنید. شماره کارت: ${CARD_NUMBER}`, BACK_KEYBOARD);
        }
        return;
    }

    // شارژ کیف‌پول
    if (text === "💳 شارژ کیف‌پول") {
        bot.sendMessage(chatId, `💳 برای شارژ کیف‌پول، شماره کارت را واریز کنید: ${CARD_NUMBER}\nسپس عکس رسید را ارسال کنید.`, BACK_KEYBOARD);
        return;
    }

    // ارسال عکس رسید
    if (msg.photo) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        bot.sendPhoto(ADMIN_ID, fileId, { caption: `💳 رسید واریز از کاربر @${msg.from.username || msg.from.first_name}` });
        bot.sendMessage(chatId, "✅ رسید شما برای بررسی به ادمین ارسال شد.");
        return;
    }

    // اطلاعات کاربری
    if (text === "👤 اطلاعات کاربری") {
        const balance = getBalance(userId);
        bot.sendMessage(chatId, `👤 اطلاعات شما:\nنام: ${msg.from.first_name}\nآی‌دی عددی: ${userId}\nموجودی کیف‌پول: ${balance} تومان`, BACK_KEYBOARD);
        return;
    }

    // پشتیبانی
    if (text === "📞 پشتیبانی") {
        bot.sendMessage(chatId, "📞 پشتیبانی: @HavijSps", BACK_KEYBOARD);
        return;
    }

    // دستور ادمین add
    if (text.startsWith("/add")) {
        if (userId != ADMIN_ID) {
            bot.sendMessage(chatId, "❌ شما ادمین نیستید!");
            return;
        }
        const parts = text.split(" ");
        if (parts.length != 3) {
            bot.sendMessage(chatId, "❌ دستور اشتباه است. مثال: /add @username 50000");
            return;
        }
        const username = parts[1].replace("@", "");
        const amount = parseInt(parts[2]);
        let userFound = false;
        for (let uid in balances) {
            if (balances[uid].username === username) {
                addBalance(uid, amount);
                bot.sendMessage(chatId, `✅ کیف‌پول کاربر @${username} به اندازه ${amount} تومان شارژ شد.`);
                userFound = true;
                break;
            }
        }
        if (!userFound) bot.sendMessage(chatId, "❌ کاربر پیدا نشد.");
        return;
    }

    bot.sendMessage(chatId, "🤔 متوجه نشدم، از منوی پایین استفاده کن 👇", MAIN_KEYBOARD);
});
