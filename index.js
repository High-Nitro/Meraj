import fs from "fs";
import fetch from "node-fetch";
import readline from "readline";

const TOKEN = "7346348218:AAGU8aUR-07GtJUZxw6JQ2X2Os9Jm_ZhGYU";
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;
const ADMIN_ID = "6823146420"; // عدد یا رشته
const BALANCE_FILE = "./balances.json";

// ---------- مدیریت داده ----------
function loadBalances() {
  if (!fs.existsSync(BALANCE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(BALANCE_FILE, "utf-8"));
  } catch (e) {
    return {};
  }
}

function saveBalances(balances) {
  fs.writeFileSync(BALANCE_FILE, JSON.stringify(balances, null, 2), "utf-8");
}

function ensureUser(user) {
  const balances = loadBalances();
  const uid = String(user.id);
  if (!balances[uid]) {
    balances[uid] = {
      coins: 0,
      username: user.username || "",
      first_name: user.first_name || ""
    };
    saveBalances(balances);
  }
  return balances[uid];
}

function addBalance(userId, amount) {
  const balances = loadBalances();
  const uid = String(userId);
  balances[uid] = balances[uid] || { coins: 0 };
  balances[uid].coins += amount;
  saveBalances(balances);
  return balances[uid].coins;
}

function getBalance(userId) {
  const balances = loadBalances();
  const uid = String(userId);
  return balances[uid]?.coins || 0;
}

// ---------- توابع تلگرام ----------
async function sendMessage(chatId, text, keyboard = null) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: "Markdown"
  };
  if (keyboard) payload.reply_markup = JSON.stringify(keyboard);
  const res = await fetch(`${BASE_URL}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

async function getUpdates(offset = 0) {
  const res = await fetch(`${BASE_URL}/getUpdates?timeout=30&offset=${offset}`);
  return await res.json();
}

// ---------- منوها ----------
const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "🛒 خرید وایرگارد" }],
    [{ text: "💳 شارژ کیف‌پول" }],
    [{ text: "👤 اطلاعات کاربری" }],
    [{ text: "📞 پشتیبانی" }]
  ],
  resize_keyboard: true
};

const BACK_KEYBOARD = { keyboard: [[{ text: "⬅️ بازگشت" }]], resize_keyboard: true };

// ---------- خرید وایرگارد ----------
const WIRED_ITEMS = {
  "1 ماهه | 36 گیگ | 1 کاربر": { price: 95000, info: "1 ماه | 36 گیگابایت | 1 کاربره" },
  "2 ماهه | 70 گیگ | 1 کاربر": { price: 140000, info: "2 ماه | 70 گیگابایت | 1 کاربره" }
};

async function showWireguard(chatId, userId) {
  const bal = getBalance(userId);
  let text = `🛒 خرید وایرگارد\nموجودی تو: *${bal}* تومان\n\nانتخاب کن:`;
  const keyboard = { keyboard: Object.keys(WIRED_ITEMS).map(i => [{ text: i }]).concat([[{ text: "⬅️ بازگشت" }]]), resize_keyboard: true };
  await sendMessage(chatId, text, keyboard);
}

async function handleWireguard(chatId, userId, itemName) {
  const item = WIRED_ITEMS[itemName];
  if (!item) return sendMessage(chatId, "❌ چنین آیتمی وجود ندارد.", BACK_KEYBOARD);
  const bal = getBalance(userId);
  if (bal < item.price) {
    return sendMessage(chatId, `💸 موجودی کافی نیست.\nقیمت: ${item.price} تومان\nموجودی: ${bal} تومان`, BACK_KEYBOARD);
  }
  addBalance(userId, -item.price);
  await sendMessage(chatId, `✅ خرید موفق!\n${item.info}\n📤 لطفاً پس از ارسال رسید، منتظر فایل از ادمین باشید.`, BACK_KEYBOARD);
  await sendMessage(ADMIN_ID, `🟢 کاربر ${userId} خرید وایرگارد انجام داد: ${item.info}`);
}

// ---------- شارژ کیف‌پول ----------
const CARD_NUMBER = "6219-8618-2900-7888";

async function chargeWallet(chatId) {
  await sendMessage(chatId, `💳 برای شارژ کیف‌پول، مبلغ را واریز کن به کارت:\n${CARD_NUMBER}\nو سپس رسید عکس بفرست.`);
}

async function handleReceipt(chatId, userId, photo) {
  await sendMessage(ADMIN_ID, `📸 کاربر ${userId} رسید ارسال کرد.`);
  await sendMessage(chatId, "✅ رسید دریافت شد، پس از شارژ توسط ادمین موجودی بروزرسانی می‌شود.");
}

// ---------- اطلاعات کاربری ----------
async function showUserInfo(chatId, userId) {
  const balances = loadBalances();
  const user = balances[String(userId)];
  if (!user) return;
  const text = `👤 اطلاعات کاربری\nنام: ${user.first_name}\nیوزرنیم: ${user.username}\nموجودی: ${user.coins} تومان`;
  await sendMessage(chatId, text, BACK_KEYBOARD);
}

// ---------- حلقه اصلی ----------
async function main() {
  console.log("CarrotBot starting...");
  let offset = 0;

  while (true) {
    try {
      const data = await getUpdates(offset);
      if (!data.result || !Array.isArray(data.result)) {
        console.error("⚠️ داده نامعتبر دریافت شد:", data);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      for (const upd of data.result) {
        offset = upd.update_id + 1;
        if (!upd.message) continue;

        const msg = upd.message;
        const chat_id = msg.chat.id;
        const user = msg.from;
        const userId = String(user.id);
        const text = msg.text || "";

        ensureUser(user);

        if (text === "/start") {
          await sendMessage(chat_id, "🥕 خوش آمدید! منوی اصلی:", MAIN_KEYBOARD);
          continue;
        }

        if (text === "🛒 خرید وایرگارد") {
          await showWireguard(chat_id, userId);
          continue;
        }

        if (WIRED_ITEMS[text]) {
          await handleWireguard(chat_id, userId, text);
          continue;
        }

        if (text === "💳 شارژ کیف‌پول") {
          await chargeWallet(chat_id);
          continue;
        }

        if (msg.photo) {
          await handleReceipt(chat_id, userId, msg.photo);
          continue;
        }

        if (text === "👤 اطلاعات کاربری") {
          await showUserInfo(chat_id, userId);
          continue;
        }

        if (text === "📞 پشتیبانی") {
          await sendMessage(chat_id, "📩 پشتیبانی: @HavijSps", BACK_KEYBOARD);
          continue;
        }

        if (text === "⬅️ بازگشت") {
          await sendMessage(chat_id, "🔙 بازگشتی به منوی اصلی", MAIN_KEYBOARD);
          continue;
        }

        await sendMessage(chat_id, "🤔 لطفاً از منوی پایین استفاده کنید.", MAIN_KEYBOARD);
      }
    } catch (e) {
      console.error(e);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

main();
