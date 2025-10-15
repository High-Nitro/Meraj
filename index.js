import fs from "fs";
import fetch from "node-fetch";
import FormData from "form-data";

// ========== تنظیمات ==========
const TOKEN = "7346348218:AAGU8aUR-07GtJUZxw6JQ2X2Os9Jm_ZhGYU";
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;
const ADMIN_ID = 6823146420; // ادمین اصلی
const BALANCE_FILE = "balances.json";
const ORDERS_FILE = "orders.json";

// شماره کارت برای شارژ کیف پول
const CARD_NUMBER = "6219-8618-2900-7888";

// پلن‌های وایرگارد
const WIREGUARD_PLANS = [
  { name: "1 ماهه", volume: "36 گیگابایت", users: 1, price: 95000 },
  { name: "2 ماهه", volume: "70 گیگابایت", users: 1, price: 140000 }
];

// ========== مدیریت داده ==========
function loadBalances() {
  if (!fs.existsSync(BALANCE_FILE)) return {};
  return JSON.parse(fs.readFileSync(BALANCE_FILE, "utf-8"));
}

function saveBalances(balances) {
  fs.writeFileSync(BALANCE_FILE, JSON.stringify(balances, null, 2));
}

function loadOrders() {
  if (!fs.existsSync(ORDERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf-8"));
}

function saveOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function ensureUser(user) {
  const balances = loadBalances();
  const uid = String(user.id);
  if (!balances[uid]) {
    balances[uid] = {
      coins: 0,
      name: user.first_name || "",
      username: user.username || "",
      purchases: []
    };
    saveBalances(balances);
  }
}

// ========== توابع تلگرام ==========
async function sendMessage(chat_id, text, reply_markup = null) {
  const payload = { chat_id, text, parse_mode: "Markdown" };
  if (reply_markup) payload.reply_markup = JSON.stringify(reply_markup);
  const res = await fetch(`${BASE_URL}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function sendPhoto(chat_id, photoPath, caption = "") {
  const form = new FormData();
  form.append("chat_id", chat_id);
  form.append("photo", fs.createReadStream(photoPath));
  form.append("caption", caption);
  const res = await fetch(`${BASE_URL}/sendPhoto`, { method: "POST", body: form });
  return res.json();
}

async function getUpdates(offset = null) {
  const url = new URL(`${BASE_URL}/getUpdates`);
  url.searchParams.append("timeout", 30);
  if (offset) url.searchParams.append("offset", offset);
  const res = await fetch(url);
  const data = await res.json();
  return data.result || [];
}

// ========== منوها ==========
const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "🛒 خرید وایرگارد" }],
    [{ text: "💳 شارژ کیف‌پول" }],
    [{ text: "👤 اطلاعات کاربری" }],
    [{ text: "🆘 پشتیبانی" }]
  ],
  resize_keyboard: true
};

const BACK_KEYBOARD = { keyboard: [[{ text: "⬅️ بازگشت" }]], resize_keyboard: true };

// ========== عملکردها ==========
async function showWireguard(chat_id, user_id) {
  const balances = loadBalances();
  const user = balances[user_id];
  let text = "📦 پلن‌های وایرگارد:\n\n";
  WIREGUARD_PLANS.forEach((p, i) => {
    text += `${i + 1}. ${p.name} | حجم: ${p.volume} | کاربران: ${p.users} | قیمت: ${p.price} تومان\n`;
  });
  text += "\nعدد پلن را وارد کنید:";
  await sendMessage(chat_id, text);
}

async function handlePurchase(user_id, planIndex, chat_id) {
  const plan = WIREGUARD_PLANS[planIndex];
  const balances = loadBalances();
  const user = balances[user_id];

  if (!user) return;

  if (user.coins < plan.price) {
    await sendMessage(chat_id, `💰 موجودی کافی نیست! شماره کارت برای پرداخت:\n${CARD_NUMBER}`);
    return;
  }

  user.coins -= plan.price;
  const orders = loadOrders();
  orders.push({ user_id, plan: plan.name, status: "منتظر فایل" });
  saveOrders(orders);
  saveBalances(balances);

  await sendMessage(chat_id, `✅ خرید با موفقیت ثبت شد! لطفاً منتظر ارسال فایل توسط ادمین بمانید.`);
  await sendMessage(ADMIN_ID, `🛒 کاربر ${user.name} (${user.username}) خرید انجام داد: ${plan.name}`);
}

async function handleAdminAdd(user_id, amount, chat_id) {
  const balances = loadBalances();
  if (!balances[user_id]) return;
  balances[user_id].coins += amount;
  saveBalances(balances);
  await sendMessage(chat_id, `✅ کیف‌پول کاربر شارژ شد.`);
}

// ارسال فایل توسط ادمین
async function handleAdminFile(target_id, filePath) {
  await sendPhoto(target_id, filePath, "📥 فایل خریداری شده شما");
}

// ========== حلقه اصلی ==========
async function main() {
  let offset = null;
  const states = {};

  console.log("🥕 CarrotBot running...");

  while (true) {
    try {
      const updates = await getUpdates(offset);

      for (const upd of updates) {
        offset = upd.update_id + 1;
        if (!upd.message) continue;

        const msg = upd.message;
        const chat_id = msg.chat.id;
        const user_id = msg.from.id;
        const text = msg.text || "";

        ensureUser(msg.from);

        // کاربر
        if (text === "/start") {
          await sendMessage(chat_id, "🥕 به مزرعه هویج خوش آمدید!", MAIN_KEYBOARD);
          continue;
        }

        if (text === "👤 اطلاعات کاربری") {
          const balances = loadBalances();
          const user = balances[user_id];
          await sendMessage(chat_id, `👤 نام: ${user.name}\n💰 موجودی: ${user.coins} تومان`);
          continue;
        }

        if (text === "🆘 پشتیبانی") {
          await sendMessage(chat_id, "🆘 پشتیبانی: @HavijSps");
          continue;
        }

        if (text === "💳 شارژ کیف‌پول") {
          await sendMessage(chat_id, `💳 لطفاً رسید پرداخت را ارسال کنید.`);
          states[user_id] = "awaiting_receipt";
          continue;
        }

        if (text === "🛒 خرید وایرگارد") {
          await showWireguard(chat_id, user_id);
          states[user_id] = "choosing_plan";
          continue;
        }

        // انتخاب پلن وایرگارد
        if (states[user_id] === "choosing_plan") {
          const planIndex = parseInt(text) - 1;
          if (!isNaN(planIndex) && WIREGUARD_PLANS[planIndex]) {
            await handlePurchase(user_id, planIndex, chat_id);
          } else {
            await sendMessage(chat_id, "لطفاً عدد صحیح را وارد کنید.");
          }
          delete states[user_id];
          continue;
        }

        // دریافت عکس رسید
        if (msg.photo && states[user_id] === "awaiting_receipt") {
          const file_id = msg.photo[msg.photo.length - 1].file_id;
          await fetch(`${BASE_URL}/getFile?file_id=${file_id}`)
            .then(res => res.json())
            .then(async data => {
              const file_path = data.result.file_path;
              const url = `https://api.telegram.org/file/bot${TOKEN}/${file_path}`;
              // دانلود و ذخیره عکس
              const fileName = `receipts/${user_id}_${Date.now()}.jpg`;
              const response = await fetch(url);
              const buffer = await response.arrayBuffer();
              fs.writeFileSync(fileName, Buffer.from(buffer));
              await sendMessage(chat_id, "✅ رسید شما دریافت شد و به ادمین ارسال شد.");
              await sendPhoto(ADMIN_ID, fileName, `رسید کاربر ${user_id}`);
            });
          delete states[user_id];
          continue;
        }

        // دستورات ادمین
        if (user_id === ADMIN_ID && text.startsWith("/add")) {
          const parts = text.split(" ");
          const target = parts[1].replace("@", "");
          const amount = parseInt(parts[2]);
          const balances = loadBalances();
          const target_user = Object.keys(balances).find(
            uid => balances[uid].username === target || uid === target
          );
          if (target_user) await handleAdminAdd(target_user, amount, chat_id);
          continue;
        }

        if (user_id === ADMIN_ID && text.startsWith("/file")) {
          const parts = text.split(" ");
          const target = parts[1].replace("@", "");
          states["admin_file_target"] = Object.keys(loadBalances()).find(
            uid => loadBalances()[uid].username === target || uid === target
          );
          await sendMessage(chat_id, `📁 لطفاً فایل را ارسال کنید.`);
          continue;
        }

        // دریافت فایل برای کاربر از ادمین
        if (msg.document && states["admin_file_target"] && user_id === ADMIN_ID) {
          const file_id = msg.document.file_id;
          await fetch(`${BASE_URL}/getFile?file_id=${file_id}`)
            .then(res => res.json())
            .then(async data => {
              const file_path = data.result.file_path;
              const url = `https://api.telegram.org/file/bot${TOKEN}/${file_path}`;
              const fileName = `files/${states["admin_file_target"]}_${Date.now()}_${msg.document.file_name}`;
              const response = await fetch(url);
              const buffer = await response.arrayBuffer();
              fs.writeFileSync(fileName, Buffer.from(buffer));
              await sendPhoto(states["admin_file_target"], fileName, "📥 فایل خریداری شده شما");
              await sendMessage(chat_id, "✅ فایل ارسال شد!");
              delete states["admin_file_target"];
            });
          continue;
        }

        await sendMessage(chat_id, "🤔 متوجه نشدم، از منو استفاده کنید.", MAIN_KEYBOARD);
      }
    } catch (e) {
      console.error(e);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

main();
