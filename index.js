const fs = require("fs");
const fetch = require("node-fetch");

// ======= تنظیمات =======
const TOKEN = "توکن_ربات_تو";
const ADMIN_ID = 6823146420;
const SUPPORT_ID = "@HavijSps";
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;
const BALANCE_FILE = "balances.json";
const CARD_NUMBER = "6219-8618-2900-7888";

// ======= داده‌ها =======
function loadBalances() {
  if (!fs.existsSync(BALANCE_FILE)) return {};
  return JSON.parse(fs.readFileSync(BALANCE_FILE, "utf-8"));
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
      name: user.first_name || "",
      pendingPayment: false
    };
    saveBalances(balances);
  }
  return balances[uid];
}

// ======= تلگرام =======
async function sendMessage(chat_id, text, keyboard) {
  const payload = { chat_id, text, parse_mode: "Markdown" };
  if (keyboard) payload.reply_markup = JSON.stringify(keyboard);
  await fetch(`${BASE_URL}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

// ======= منوها =======
const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "🛒 خرید وایرگارد" }],
    [{ text: "💳 شارژ کیف پول" }],
    [{ text: "👤 اطلاعات کاربری" }],
    [{ text: "📞 پشتیبانی" }]
  ],
  resize_keyboard: true
};

const BACK_KEYBOARD = {
  keyboard: [[{ text: "⬅️ بازگشت" }]],
  resize_keyboard: true
};

// ======= وایرگارد =======
const WIREGUARD_ITEMS = [
  { title: "1 ماهه", volume: "36 گیگ", user: "1 کاربره", price: 95000 },
  { title: "2 ماهه", volume: "70 گیگ", user: "1 کاربره", price: 140000 }
];

// ======= تابع خرید وایرگارد =======
async function buyWireguard(user_id, chat_id, choiceIndex) {
  const balances = loadBalances();
  const user = balances[user_id];
  const item = WIREGUARD_ITEMS[choiceIndex];

  if (user.coins < item.price) {
    await sendMessage(chat_id, `💰 موجودی کافی نیست.\nقیمت: ${item.price} تومان\nموجودی فعلی: ${user.coins} تومان\nلطفا کیف پول خود را شارژ کنید.`, BACK_KEYBOARD);
    return;
  }

  user.coins -= item.price;
  saveBalances(balances);

  await sendMessage(ADMIN_ID, `💳 خرید وایرگارد:\nکاربر: ${user.name} (${user_id})\nپلن: ${item.title}\nلطفا فایل را ارسال کنید.`);
  await sendMessage(chat_id, `✅ خرید ثبت شد! لطفا منتظر ارسال فایل از ادمین باشید.`);
}

// ======= شارژ کیف پول =======
async function startPayment(user_id, chat_id) {
  const balances = loadBalances();
  const user = balances[user_id];
  user.pendingPayment = true;
  saveBalances(balances);
  await sendMessage(chat_id, `💳 برای شارژ کیف پول، مبلغ را کارت به کارت کنید به:\n${CARD_NUMBER}\nسپس عکس رسید را ارسال کنید.`);
}

// ======= اطلاعات کاربری =======
async function showProfile(user_id, chat_id) {
  const balances = loadBalances();
  const user = balances[user_id];
  await sendMessage(chat_id, `👤 اطلاعات شما:\nنام: ${user.name}\nیوزرنیم: @${user.username}\n💰 موجودی: ${user.coins} تومان`);
}

// ======= دریافت پیام‌ها =======
async function getUpdates(offset = 0) {
  const res = await fetch(`${BASE_URL}/getUpdates?timeout=30&offset=${offset}`);
  return res.json();
}

// ======= حلقه اصلی =======
async function main() {
  console.log("CarrotBot running...");
  let offset = 0;
  const userStates = {}; // وضعیت‌ها

  while (true) {
    try {
      const data = await getUpdates(offset);
      for (const upd of data.result) {
        offset = upd.update_id + 1;
        if (!upd.message) continue;
        const msg = upd.message;
        const chat_id = msg.chat.id;
        const user = msg.from;
        const user_id = String(user.id);
        const text = msg.text || "";

        const udata = ensureUser(user);

        // منوی اصلی
        if (text === "/start") {
          await sendMessage(chat_id, "🥕 خوش آمدی! منوی اصلی:", MAIN_KEYBOARD);
          continue;
        }

        // منوی خرید وایرگارد
        if (text === "🛒 خرید وایرگارد") {
          let msgText = "💳 خرید وایرگارد:\n\n";
          WIREGUARD_ITEMS.forEach((i, idx) => {
            msgText += `${idx + 1}. زمان: ${i.title}\n   حجم: ${i.volume}\n   تعداد کاربر: ${i.user}\n   قیمت: ${i.price} تومان\n\n`;
          });
          msgText += "برای خرید، شماره گزینه را وارد کنید:";
          await sendMessage(chat_id, msgText, BACK_KEYBOARD);
          userStates[user_id] = "buyWireguard";
          continue;
        }

        if (userStates[user_id] === "buyWireguard") {
          const choice = parseInt(text);
          if (isNaN(choice) || choice < 1 || choice > WIREGUARD_ITEMS.length) {
            await sendMessage(chat_id, "لطفا عدد معتبر وارد کنید", BACK_KEYBOARD);
            continue;
          }
          await buyWireguard(user_id, chat_id, choice - 1);
          delete userStates[user_id];
          continue;
        }

        // شارژ کیف پول
        if (text === "💳 شارژ کیف پول") {
          await startPayment(user_id, chat_id);
          continue;
        }

        if (udata.pendingPayment && msg.photo) {
          await sendMessage(ADMIN_ID, `💰 کاربر ${udata.name} (${user_id}) رسید شارژ را ارسال کرد.`);
          udata.pendingPayment = false;
          saveBalances(loadBalances());
          await sendMessage(chat_id, "✅ رسید دریافت شد، منتظر شارژ کیف پول باشید.");
          continue;
        }

        // اطلاعات کاربری
        if (text === "👤 اطلاعات کاربری") {
          await showProfile(user_id, chat_id);
          continue;
        }

        // پشتیبانی
        if (text === "📞 پشتیبانی") {
          await sendMessage(chat_id, `📞 پشتیبانی: ${SUPPORT_ID}`);
          continue;
        }

        // بازگشت
        if (text === "⬅️ بازگشت") {
          await sendMessage(chat_id, "بازگشتی به منوی اصلی:", MAIN_KEYBOARD);
          delete userStates[user_id];
          continue;
        }

        // پیش‌فرض
        await sendMessage(chat_id, "🤔 متوجه نشدم! از منوی پایین استفاده کنید.", MAIN_KEYBOARD);
      }
    } catch (e) {
      console.error(e);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

main();
