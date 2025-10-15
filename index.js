import fs from "fs";
import fetch from "node-fetch";

// ===== تنظیمات =====
const TOKEN = "7346348218:AAGU8aUR-07GtJUZxw6JQ2X2Os9Jm_ZhGYU";
const ADMIN_ID = 6823146420;
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;

const BALANCE_FILE = "balances.json";
const ORDER_FILE = "orders.json";

// ===== مدیریت داده =====
function loadJSON(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}
function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

function ensureUser(user) {
  const balances = loadJSON(BALANCE_FILE);
  const uid = user.id.toString();
  if (!balances[uid]) {
    balances[uid] = {
      coins: 0,
      username: user.username || "",
      name: user.first_name || "",
    };
    saveJSON(BALANCE_FILE, balances);
  }
}

function addBalance(userId, amount) {
  const balances = loadJSON(BALANCE_FILE);
  const uid = userId.toString();
  balances[uid].coins = (balances[uid].coins || 0) + amount;
  saveJSON(BALANCE_FILE, balances);
  return balances[uid].coins;
}

function getBalance(userId) {
  const balances = loadJSON(BALANCE_FILE);
  return balances[userId.toString()]?.coins || 0;
}

// ===== تلگرام =====
async function sendMessage(chatId, text, reply_markup = null) {
  const payload = { chat_id: chatId, text };
  if (reply_markup) payload.reply_markup = JSON.stringify(reply_markup);
  await fetch(`${BASE_URL}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function sendDocument(chatId, filePath, caption = "") {
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("document", fs.createReadStream(filePath));
  if (caption) form.append("caption", caption);

  await fetch(`${BASE_URL}/sendDocument`, { method: "POST", body: form });
}

// ===== خرید وایرگارد =====
const WIRED_PACKS = [
  { id: 1, time: "1 ماه", volume: "36 گیگابایت", user: 1, price: 95000 },
  { id: 2, time: "2 ماه", volume: "70 گیگابایت", user: 1, price: 140000 },
];

function createOrder(userId, packId) {
  const orders = loadJSON(ORDER_FILE);
  const orderId = Date.now();
  orders[orderId] = { userId, packId, status: "pending", file: null };
  saveJSON(ORDER_FILE, orders);
  return orderId;
}

function getPendingOrder(userId) {
  const orders = loadJSON(ORDER_FILE);
  return Object.entries(orders).find(
    ([id, o]) => o.userId === userId && o.status === "pending"
  );
}

function completeOrder(orderId, filePath) {
  const orders = loadJSON(ORDER_FILE);
  orders[orderId].status = "completed";
  orders[orderId].file = filePath;
  saveJSON(ORDER_FILE, orders);
  return orders[orderId];
}

// ===== منو =====
const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "🛒 خرید وایرگارد" }],
    [{ text: "💳 شارژ کیف‌پول" }],
    [{ text: "👤 اطلاعات کاربری" }],
    [{ text: "📞 پشتیبانی" }],
  ],
  resize_keyboard: true,
};

const BACK_KEYBOARD = {
  keyboard: [[{ text: "⬅️ بازگشت" }]],
  resize_keyboard: true,
};

// ===== حلقه اصلی =====
let offset = 0;

async function main() {
  console.log("Bot started...");
  while (true) {
    try {
      const res = await fetch(`${BASE_URL}/getUpdates?timeout=30&offset=${offset}`);
      const data = await res.json();
      if (!Array.isArray(data.result)) continue;

      for (const upd of data.result) {
        offset = upd.update_id + 1;
        if (!upd.message) continue;

        const msg = upd.message;
        const chatId = msg.chat.id;
        const user = msg.from;
        const text = msg.text;

        ensureUser(user);

        if (text === "/start") {
          await sendMessage(chatId, "🥕 خوش آمدید!", MAIN_KEYBOARD);
          continue;
        }

        // خرید وایرگارد
        if (text === "🛒 خرید وایرگارد") {
          const bal = getBalance(user.id);
          let textMsg = `💳 موجودی شما: ${bal} تومان\n🛒 پکیج‌های وایرگارد:\n`;
          WIRED_PACKS.forEach(
            (p) =>
              (textMsg += `\nID: ${p.id} | زمان: ${p.time} | حجم: ${p.volume} | کاربر: ${p.user} | قیمت: ${p.price} تومان`)
          );
          textMsg += "\n\nلطفاً ID پکیج مورد نظر را ارسال کنید:";
          await sendMessage(chatId, textMsg, BACK_KEYBOARD);
          continue;
        }

        // دریافت ID پکیج
        const packId = parseInt(text);
        if (!isNaN(packId)) {
          const pack = WIRED_PACKS.find((p) => p.id === packId);
          if (!pack) {
            await sendMessage(chatId, "❌ پکیج نامعتبر است.", BACK_KEYBOARD);
            continue;
          }
          const bal = getBalance(user.id);
          if (bal < pack.price) {
            await sendMessage(
              chatId,
              `موجودی کافی نیست.\nقیمت: ${pack.price} تومان\nموجودی فعلی: ${bal} تومان\nلطفاً ابتدا کیف‌پول را شارژ کنید.`,
              BACK_KEYBOARD
            );
            continue;
          }
          addBalance(user.id, -pack.price);
          const orderId = createOrder(user.id, packId);
          await sendMessage(chatId, "✅ خرید موفق انجام شد! منتظر فایل از ادمین باشید.");

          // اطلاع ادمین
          await sendMessage(
            ADMIN_ID,
            `📥 کاربر @${user.username} خرید کرد.\nOrderID: ${orderId}\nPackID: ${packId}`
          );
          continue;
        }

        // ارسال فایل توسط ادمین
        if (text && text.startsWith("/file")) {
          if (user.id !== ADMIN_ID) continue;
          const parts = text.split(" ");
          if (parts.length < 2) continue;
          const username = parts[1].replace("@", "");

          // پیدا کردن order مربوطه
          const orders = loadJSON(ORDER_FILE);
          const orderEntry = Object.entries(orders).find(
            ([id, o]) => o.status === "pending" && loadJSON(BALANCE_FILE)[o.userId].username === username
          );
          if (!orderEntry) {
            await sendMessage(chatId, "❌ سفارش یافت نشد یا تمام شده.");
            continue;
          }
          const [orderId, order] = orderEntry;

          // ادمین فایل رو باید reply کنه، ما فایل path رو از reply دریافت می‌کنیم
          if (!msg.reply_to_message || !msg.reply_to_message.document) {
            await sendMessage(chatId, "لطفاً این دستور را به صورت reply روی فایل بفرستید.");
            continue;
          }

          const fileId = msg.reply_to_message.document.file_id;
          // ارسال فایل به کاربر
          await fetch(`${BASE_URL}/sendDocument`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: order.userId, document: fileId }),
          });

          // تکمیل سفارش
          completeOrder(orderId, fileId);
          await sendMessage(chatId, "✅ فایل ارسال شد!");
        }

        // اطلاعات کاربری
        if (text === "👤 اطلاعات کاربری") {
          const bal = getBalance(user.id);
          const u = loadJSON(BALANCE_FILE)[user.id];
          await sendMessage(
            chatId,
            `👤 کاربر: @${u.username}\nنام: ${u.name}\nموجودی: ${bal} تومان`
          );
          continue;
        }

        // شارژ کیف‌پول
        if (text === "💳 شارژ کیف‌پول") {
          await sendMessage(chatId, "📤 لطفاً رسید واریزی را ارسال کنید.");
          continue;
        }

        // پشتیبانی
        if (text === "📞 پشتیبانی") {
          await sendMessage(chatId, "پشتیبانی: @havijsps");
          continue;
        }

        if (text === "⬅️ بازگشت") {
          await sendMessage(chatId, "بازگشت به منو اصلی", MAIN_KEYBOARD);
          continue;
        }

        await sendMessage(chatId, "🤔 متوجه نشدم، از منو استفاده کنید.", MAIN_KEYBOARD);
      }
    } catch (err) {
      console.log("Error:", err);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

main();
