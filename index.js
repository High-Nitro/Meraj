import fs from "fs";
import fetch from "node-fetch";

// ====== تنظیمات ======
const TOKEN = "7346348218:AAGU8aUR-07GtJUZxw6JQ2X2Os9Jm_ZhGYU";
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;
const BALANCE_FILE = "balances.json";
const ADMIN_ID = 6823146420;

// ====== مدیریت داده ======
function loadBalances() {
  if (!fs.existsSync(BALANCE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(BALANCE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveBalances(balances) {
  fs.writeFileSync(BALANCE_FILE, JSON.stringify(balances, null, 2), "utf8");
}

function ensureUser(user) {
  const balances = loadBalances();
  const uid = String(user.id);
  if (!balances[uid]) {
    balances[uid] = {
      coins: 0,
      ref: null,
      name: user.first_name || "",
      username: user.username || "",
      country: null,
    };
    saveBalances(balances);
  }
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
  return balances[String(userId)]?.coins || 0;
}

function setRef(userId, refId) {
  const balances = loadBalances();
  const uid = String(userId);
  if (!balances[uid]) balances[uid] = { coins: 0, ref: refId };
  else if (!balances[uid].ref && refId !== userId) balances[uid].ref = refId;
  saveBalances(balances);
}

function updateCountry(userId, country) {
  const balances = loadBalances();
  const uid = String(userId);
  if (balances[uid]) {
    balances[uid].country = country;
    saveBalances(balances);
  }
}

// ====== تلگرام ======
async function sendMessage(chatId, text, keyboard = null, parseMode = "Markdown") {
  const payload = { chat_id: chatId, text, parse_mode: parseMode };
  if (keyboard) payload.reply_markup = JSON.stringify(keyboard);
  const res = await fetch(`${BASE_URL}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload),
  });
  return res.json();
}

async function getUpdates(offset = null) {
  let url = `${BASE_URL}/getUpdates?timeout=30`;
  if (offset) url += `&offset=${offset}`;
  const res = await fetch(url);
  return res.json();
}

// ====== منوها ======
const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "🎮 شروع بازی" }],
    [{ text: "👥 دعوت دوستان" }],
    [{ text: "👝 کیف پول" }],
    [{ text: "🛒 خرید فایل" }],
  ],
  resize_keyboard: true,
};

const BACK_KEYBOARD = { keyboard: [[{ text: "⬅️ بازگشت" }]], resize_keyboard: true };

// ====== خرید فایل ======
const ITEMS = {
  "📄 فایل آموزشی": { price: 50, link: "https://example.com/file1.zip" },
  "🎵 موسیقی ویژه": { price: 80, link: "https://example.com/music.mp3" },
  "🧰 ابزار خاص": { price: 120, link: "https://example.com/tool.rar" },
};

async function showShop(chatId, userId) {
  const bal = getBalance(userId);
  const text = `🛍️ فروشگاه فایل‌ها\nموجودی تو: *${bal}* 🥕\n\nانتخاب کن:`;
  const keyboard = {
    keyboard: [...Object.keys(ITEMS).map((i) => [{ text: i }]), [{ text: "⬅️ بازگشت" }]],
    resize_keyboard: true,
  };
  await sendMessage(chatId, text, keyboard);
}

async function handlePurchase(userId, chatId, itemName) {
  if (!ITEMS[itemName]) return sendMessage(chatId, "❌ چنین آیتمی وجود ندارد.", BACK_KEYBOARD);
  const bal = getBalance(userId);
  const item = ITEMS[itemName];
  if (bal < item.price)
    return sendMessage(
      chatId,
      `😞 موجودی کافی نیست.\nقیمت: ${item.price} 🥕\nموجودی فعلی: ${bal} 🥕`,
      BACK_KEYBOARD
    );
  addBalance(userId, -item.price);
  await sendMessage(chatId, `✅ خرید موفق!\n${itemName}\n📥 لینک دانلود:\n${item.link}`, BACK_KEYBOARD);
}

// ====== بازی ======
function gameResultText(result) {
  return result === 0 ? "💀 متأسفم! چیزی نصیبت نشد..." : `🎉 تبریک! ${result} 🥕 هویج گرفتی!`;
}

async function playGame(userId, chatId) {
  for (let i of [3, 2, 1]) {
    await sendMessage(chatId, `⏳ ${i} ...`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  const result = [0, 1, 3, 6][Math.floor(Math.random() * 4)];
  addBalance(userId, result);
  await sendMessage(chatId, gameResultText(result));
  if (result > 0) await sendMessage(chatId, `🏦 موجودی فعلی: *${getBalance(userId)}* 🥕`, MAIN_KEYBOARD);
}

// ====== رفرال ======
function referralLink(userId) {
  return `https://t.me/USERNAME_BOT?start=${userId}`; // ⚠️ اسم رباتتو بذار
}

async function handleReferral(userId, text) {
  if (text.startsWith("/start ")) {
    const refId = parseInt(text.split(" ")[1]);
    if (refId && refId !== userId) {
      setRef(userId, refId);
      addBalance(refId, 1);
      await sendMessage(refId, "🥕 یه دوست جدید دعوت کردی!\n+1 هویج بهت اضافه شد 🎉");
    }
  }
}

// ====== حلقه اصلی ======
async function main() {
  console.log("🥕 CarrotBot Node.js is running...");
  let offset = null;
  const userStates = {};

  while (true) {
    try {
      const updates = await getUpdates(offset);
      for (let upd of updates.result || []) {
        offset = upd.update_id + 1;
        if (!upd.message) continue;

        const msg = upd.message;
        const chatId = msg.chat.id;
        const user = msg.from;
        const userId = user.id;
        const text = (msg.text || "").trim();

        ensureUser(user);

        // کشور
        if (userStates[userId] === "country_input") {
          updateCountry(userId, text);
          await sendMessage(chatId, "✅ کشور ذخیره شد!", MAIN_KEYBOARD);
          delete userStates[userId];
          continue;
        }

        const balances = loadBalances();
        const udata = balances[String(userId)];

        if (!udata.country) {
          await sendMessage(chatId, "🌍 لطفاً کشور خود را وارد کن:");
          userStates[userId] = "country_input";
          continue;
        }

        // شروع
        if (text.startsWith("/start ")) {
          await handleReferral(userId, text);
          await sendMessage(chatId, "🌍 کشور شما قبلاً ذخیره شده است.", MAIN_KEYBOARD);
          continue;
        }

        if (text === "/start") {
          await sendMessage(chatId, "🌍 لطفاً کشور خود را وارد کن:");
          userStates[userId] = "country_input";
          continue;
        }

        // منو
        if (text === "🎮 شروع بازی") await playGame(userId, chatId);
        else if (text === "👝 کیف پول") await sendMessage(chatId, `💰 موجودی کیف‌پول: *${getBalance(userId)}* 🥕`, MAIN_KEYBOARD);
        else if (text === "👥 دعوت دوستان") await sendMessage(chatId, `👥 لینک دعوتت:\n${referralLink(userId)}\n\nهر کسی از طریق این لینک بیاد، ۱ 🥕 می‌گیری!`, BACK_KEYBOARD);
        else if (text === "🛒 خرید فایل") await showShop(chatId, userId);
        else if (ITEMS[text]) await handlePurchase(userId, chatId, text);
        else if (text === "⬅️ بازگشت") await sendMessage(chatId, "🔙 بازگشتی به منوی اصلی", MAIN_KEYBOARD);
        else await sendMessage(chatId, "🤔 متوجه نشدم، از منوی پایین استفاده کن 👇", MAIN_KEYBOARD);
      }
    } catch (e) {
      console.error("Error:", e);
      await new Promise((r) => setTimeout(r, 2000));
    }

    await new Promise((r) => setTimeout(r, 500));
  }
}

main();
