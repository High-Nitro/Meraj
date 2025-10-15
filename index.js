const fs = require("fs");
const fetch = require("node-fetch");
// ======= تنظیمات =======
const TOKEN = "7346348218:AAGU8aUR-07GtJUZxw6JQ2X2Os9Jm_ZhGYU";
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;

const ADMIN_ID = 6823146420;
const SUPPORT_USERNAME = "@HavijSps";
const CARD_NUMBER = "6219-8618-2900-7888";

const DATA_FILE = "users.json";

// ======= مدیریت داده =======
function loadUsers() {
  if (!fs.existsSync(DATA_FILE)) return {};
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

function saveUsers(users) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), "utf-8");
}

function ensureUser(user) {
  const users = loadUsers();
  const uid = user.id.toString();
  if (!users[uid]) {
    users[uid] = {
      id: uid,
      first_name: user.first_name || "",
      username: user.username || "",
      country: null,
      balance: 0
    };
    saveUsers(users);
  }
}

// ======= تلگرام =======
async function sendMessage(chat_id, text, keyboard = null, parse_mode = "Markdown") {
  const payload = { chat_id, text, parse_mode };
  if (keyboard) payload.reply_markup = JSON.stringify(keyboard);
  const res = await fetch(`${BASE_URL}/sendMessage`, { method: "POST", body: new URLSearchParams(payload) });
  return res.json();
}

async function sendPhoto(chat_id, photo, caption = "") {
  const form = new FormData();
  form.append("chat_id", chat_id);
  form.append("photo", fs.createReadStream(photo));
  if (caption) form.append("caption", caption);
  await fetch(`${BASE_URL}/sendPhoto`, { method: "POST", body: form });
}

async function getUpdates(offset = null, timeout = 30) {
  let url = `${BASE_URL}/getUpdates?timeout=${timeout}`;
  if (offset) url += `&offset=${offset}`;
  const res = await fetch(url);
  return res.json();
}

// ======= کیبوردها =======
const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "🛒 خرید وایرگارد" }],
    [{ text: "💳 شارژ کیف‌پول" }],
    [{ text: "🧑‍💻 اطلاعات کاربری" }],
    [{ text: "📞 پشتیبانی" }]
  ],
  resize_keyboard: true
};

const BACK_KEYBOARD = {
  keyboard: [[{ text: "⬅️ بازگشت" }]],
  resize_keyboard: true
};

// ======= وایرگارد =======
const WIRED_PLANS = [
  { name: "1 ماهه 1 کاربره", time: "1 ماه", volume: "36 گیگابایت", users: 1, price: 95000 },
  { name: "2 ماهه 1 کاربره", time: "2 ماه", volume: "70 گیگابایت", users: 1, price: 140000 }
];

// ======= حلقه اصلی =======
async function main() {
  console.log("CarrotBot starting...");
  let offset = null;

  while (true) {
    try {
      const updates = await getUpdates(offset, 30);
      for (const upd of updates.result) {
        offset = upd.update_id + 1;
        if (!upd.message) continue;

        const msg = upd.message;
        const chat_id = msg.chat.id;
        const user = msg.from;
        const text = msg.text?.trim();

        ensureUser(user);
        const users = loadUsers();
        const udata = users[user.id];

        // === کشور ثبت نشده ===
        if (!udata.country) {
          sendMessage(chat_id, "🌍 لطفاً نام کشور خود را وارد کنید:");
          continue;
        }

        // === فرمان /start ===
        if (text === "/start") {
          sendMessage(chat_id, `🥕 سلام ${user.first_name}!\nیکی از گزینه‌های زیر را انتخاب کنید:`, MAIN_KEYBOARD);
          continue;
        }

        // === اطلاعات کاربری ===
        if (text === "🧑‍💻 اطلاعات کاربری") {
          const info = `🧑‍💻 *اطلاعات کاربری*\n\nنام: ${udata.first_name}\nیوزرنیم: @${udata.username}\nکشور: ${udata.country}\n💰 موجودی کیف‌پول: *${udata.balance}* تومان`;
          sendMessage(chat_id, info, MAIN_KEYBOARD);
          continue;
        }

        // === پشتیبانی ===
        if (text === "📞 پشتیبانی") {
          sendMessage(chat_id, `برای پشتیبانی به این آیدی پیام دهید: ${SUPPORT_USERNAME}`, MAIN_KEYBOARD);
          continue;
        }

        // === خرید وایرگارد ===
        if (text === "🛒 خرید وایرگارد") {
          let msgText = "🛒 *خرید وایرگارد*\n\n";
          WIRED_PLANS.forEach((plan, idx) => {
            msgText += `${idx + 1}. زمان: ${plan.time}\n   حجم: ${plan.volume}\n   تعداد کاربر: ${plan.users}\n   قیمت: ${plan.price.toLocaleString()} تومان\n\n`;
          });
          msgText += "عدد طرح مورد نظر را وارد کنید یا ⬅️ بازگشت برای برگشت";
          sendMessage(chat_id, msgText, BACK_KEYBOARD);
          udata.state = "buy_wg";
          saveUsers(users);
          continue;
        }

        if (udata.state === "buy_wg") {
          const choice = parseInt(text);
          if (isNaN(choice) || choice < 1 || choice > WIRED_PLANS.length) {
            sendMessage(chat_id, "لطفاً عدد طرح مورد نظر را وارد کنید یا ⬅️ بازگشت.", BACK_KEYBOARD);
            continue;
          }
          const plan = WIRED_PLANS[choice - 1];
          if (udata.balance >= plan.price) {
            udata.balance -= plan.price;
            sendMessage(chat_id, `✅ خرید موفق!\n💳 مبلغ از کیف‌پول کسر شد: ${plan.price.toLocaleString()} تومان\n📩 منتظر ارسال فایل توسط ادمین باشید.`, MAIN_KEYBOARD);
            sendMessage(ADMIN_ID, `💰 خرید وایرگارد:\nکاربر: @${udata.username}\nکشور: ${udata.country}\nطرح: ${plan.name}\nقیمت: ${plan.price.toLocaleString()} تومان`);
          } else {
            sendMessage(chat_id, `⚠️ موجودی کافی نیست. لطفاً کیف‌پول خود را شارژ کنید.\nشماره کارت: ${CARD_NUMBER}`, MAIN_KEYBOARD);
            sendMessage(ADMIN_ID, `⚠️ کاربر @${udata.username} طرح ${plan.name} را انتخاب کرد اما موجودی کافی ندارد.`);
          }
          udata.state = null;
          saveUsers(users);
          continue;
        }

        // === شارژ کیف‌پول ===
        if (text === "💳 شارژ کیف‌پول") {
          sendMessage(chat_id, `💳 برای شارژ کیف‌پول، مبلغ را واریز کنید.\nشماره کارت: ${CARD_NUMBER}\nسپس عکس رسید را ارسال کنید.`, BACK_KEYBOARD);
          udata.state = "await_receipt";
          saveUsers(users);
          continue;
        }

        // === عکس رسید ===
        if (udata.state === "await_receipt" && msg.photo) {
          const file_id = msg.photo[msg.photo.length - 1].file_id;
          const fileRes = await fetch(`${BASE_URL}/getFile?file_id=${file_id}`);
          const fileData = await fileRes.json();
          const file_path = fileData.result.file_path;
          const file_url = `https://api.telegram.org/file/bot${TOKEN}/${file_path}`;
          sendMessage(chat_id, "✅ رسید دریافت شد، پس از بررسی موجودی شما شارژ می‌شود.", MAIN_KEYBOARD);
          sendMessage(ADMIN_ID, `📥 کاربر @${udata.username} رسید واریز را ارسال کرد: ${file_url}`);
          udata.state = null;
          saveUsers(users);
          continue;
        }

        // === بازگشت ===
        if (text === "⬅️ بازگشت") {
          sendMessage(chat_id, "🔙 بازگشتی به منوی اصلی", MAIN_KEYBOARD);
          udata.state = null;
          saveUsers(users);
          continue;
        }

        // === پنل ادمین ===
        if (user.id === ADMIN_ID && text.startsWith("/add")) {
          const parts = text.split(" ");
          if (parts.length !== 3) {
            sendMessage(chat_id, "فرمت: /add @username مبلغ");
            continue;
          }
          const uname = parts[1].replace("@", "");
          const amount = parseInt(parts[2]);
          const usersList = loadUsers();
          const target = Object.values(usersList).find(u => u.username === uname);
          if (!target) {
            sendMessage(chat_id, "کاربر پیدا نشد!");
            continue;
          }
          target.balance += amount;
          saveUsers(usersList);
          sendMessage(chat_id, `✅ کیف‌پول @${uname} به مبلغ ${amount.toLocaleString()} تومان شارژ شد.`);
          sendMessage(target.id, `💳 کیف‌پول شما به مبلغ ${amount.toLocaleString()} تومان شارژ شد توسط ادمین.`);
          continue;
        }

        // === پیش‌فرض ===
        sendMessage(chat_id, "🤔 متوجه نشدم، از منوی پایین استفاده کن 👇", MAIN_KEYBOARD);
      }
    } catch (e) {
      console.log("Error:", e);
    }

    await new Promise(r => setTimeout(r, 500));
  }
}

main();
