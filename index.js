import fs from "fs";
import fetch from "node-fetch";
import readline from "readline";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TOKEN = "7346348218:AAGU8aUR-07GtJUZxw6JQ2X2Os9Jm_ZhGYU";
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;
const ADMIN_ID = "6823146420"; // عدد یا رشته
const BALANCE_FILE = "./balances.json";
const PURCHASE_LOG_FILE = "./purchases.json";
const RECEIPT_LOG_FILE = "./receipts.json";

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

function loadPurchases() {
  if (!fs.existsSync(PURCHASE_LOG_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(PURCHASE_LOG_FILE, "utf-8"));
  } catch (e) {
    return [];
  }
}

function savePurchases(purchases) {
  fs.writeFileSync(PURCHASE_LOG_FILE, JSON.stringify(purchases, null, 2), "utf-8");
}

function loadReceipts() {
  if (!fs.existsSync(RECEIPT_LOG_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(RECEIPT_LOG_FILE, "utf-8"));
  } catch (e) {
    return [];
  }
}

function saveReceipts(receipts) {
  fs.writeFileSync(RECEIPT_LOG_FILE, JSON.stringify(receipts, null, 2), "utf-8");
}

function ensureUser(user) {
  const balances = loadBalances();
  const uid = String(user.id);
  if (!balances[uid]) {
    balances[uid] = {
      coins: 0,
      username: user.username || "",
      first_name: user.first_name || "",
      joined_date: new Date().toISOString()
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

function logPurchase(user, item, price) {
  const purchases = loadPurchases();
  purchases.push({
    userId: user.id,
    username: user.username || "",
    firstName: user.first_name || "",
    item: item,
    price: price,
    timestamp: new Date().toISOString()
  });
  savePurchases(purchases);
}

function logReceipt(user, fileId) {
  const receipts = loadReceipts();
  receipts.push({
    userId: user.id,
    username: user.username || "",
    firstName: user.first_name || "",
    fileId: fileId,
    timestamp: new Date().toISOString()
  });
  saveReceipts(receipts);
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

async function sendPhoto(chatId, photo, caption = "") {
  const payload = {
    chat_id: chatId,
    photo: photo,
    caption: caption,
    parse_mode: "Markdown"
  };
  
  const res = await fetch(`${BASE_URL}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

async function sendDocument(chatId, document, caption = "") {
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('document', document);
  if (caption) formData.append('caption', caption);

  const res = await fetch(`${BASE_URL}/sendDocument`, {
    method: 'POST',
    body: formData
  });
  return await res.json();
}

async function getFile(fileId) {
  const res = await fetch(`${BASE_URL}/getFile?file_id=${fileId}`);
  return await res.json();
}

async function downloadFile(filePath, downloadPath) {
  const url = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;
  const res = await fetch(url);
  const buffer = await res.buffer();
  fs.writeFileSync(downloadPath, buffer);
  return downloadPath;
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

const BACK_KEYBOARD = { 
  keyboard: [[{ text: "⬅️ بازگشت" }]], 
  resize_keyboard: true 
};

const ADMIN_PANEL_KEYBOARD = {
  keyboard: [
    [{ text: "📊 آمار کاربران" }, { text: "💰 کاربران خریداری کرده" }],
    [{ text: "📸 کاربران ارسال رسید" }, { text: "📤 ارسال فایل به کاربر" }],
    [{ text: "⬅️ بازگشت" }]
  ],
  resize_keyboard: true
};

// ---------- خرید وایرگارد ----------
const WIRED_ITEMS = {
  "1 ماهه | 36 گیگ | 1 کاربر": { price: 95000, info: "1 ماه | 36 گیگابایت | 1 کاربره" },
  "2 ماهه | 70 گیگ | 1 کاربر": { price: 140000, info: "2 ماه | 70 گیگابایت | 1 کاربره" }
};

// ---------- پنل ادمین ----------
async function showAdminPanel(chatId) {
  await sendMessage(chatId, "🔧 پنل ادمین - گزینه مورد نظر را انتخاب کنید:", ADMIN_PANEL_KEYBOARD);
}

async function showUserStats(chatId) {
  const balances = loadBalances();
  const purchases = loadPurchases();
  const receipts = loadReceipts();
  
  const totalUsers = Object.keys(balances).length;
  const usersWithBalance = Object.values(balances).filter(user => user.coins > 0).length;
  const totalPurchases = purchases.length;
  const totalReceipts = receipts.length;
  
  const statsText = `📊 آمار کاربران:
  
👥 تعداد کل کاربران: ${totalUsers}
💰 کاربران دارای موجودی: ${usersWithBalance}
🛒 تعداد کل خریدها: ${totalPurchases}
📸 تعداد رسیدهای ارسال شده: ${totalReceipts}`;

  await sendMessage(chatId, statsText, ADMIN_PANEL_KEYBOARD);
}

async function showPurchaseUsers(chatId) {
  const purchases = loadPurchases();
  
  if (purchases.length === 0) {
    await sendMessage(chatId, "📭 هیچ خریداری ثبت نشده است.", ADMIN_PANEL_KEYBOARD);
    return;
  }
  
  let purchaseText = "💰 کاربران خریداری کرده:\n\n";
  
  purchases.slice(-10).forEach((purchase, index) => {
    purchaseText += `${index + 1}. @${purchase.username || purchase.firstName || 'بدون نام'} 
    آیتم: ${purchase.item}
    مبلغ: ${purchase.price} تومان
    تاریخ: ${new Date(purchase.timestamp).toLocaleString('fa-IR')}\n\n`;
  });
  
  await sendMessage(chatId, purchaseText, ADMIN_PANEL_KEYBOARD);
}

async function showReceiptUsers(chatId) {
  const receipts = loadReceipts();
  
  if (receipts.length === 0) {
    await sendMessage(chatId, "📭 هیچ رسیدی ارسال نشده است.", ADMIN_PANEL_KEYBOARD);
    return;
  }
  
  let receiptText = "📸 کاربران ارسال رسید:\n\n";
  
  receipts.slice(-10).forEach((receipt, index) => {
    receiptText += `${index + 1}. @${receipt.username || receipt.firstName || 'بدون نام'} 
    تاریخ: ${new Date(receipt.timestamp).toLocaleString('fa-IR')}\n\n`;
  });
  
  await sendMessage(chatId, receiptText, ADMIN_PANEL_KEYBOARD);
}

async function handleFileCommand(chatId, text) {
  const parts = text.split(" ");
  if (parts.length < 3) {
    await sendMessage(chatId, "❌ فرمت دستور اشتباه است.\n\nمثال صحیح:\n/file @username filename.txt\n/file 123456789 config.conf", BACK_KEYBOARD);
    return;
  }

  const target = parts[1].replace("@", "");
  const filename = parts[2];
  
  // بررسی وجود فایل
  const filePath = `./files/${filename}`;
  if (!fs.existsSync(filePath)) {
    await sendMessage(chatId, `❌ فایل ${filename} یافت نشد.`, BACK_KEYBOARD);
    return;
  }

  const balances = loadBalances();
  let targetUserId = null;

  // جستجو با یوزرنیم
  for (let uid in balances) {
    if (balances[uid].username === target) {
      targetUserId = uid;
      break;
    }
  }

  // اگر با یوزرنیم پیدا نشد، شاید آی دی عددی باشد
  if (!targetUserId && !isNaN(target)) {
    targetUserId = target;
  }

  if (!targetUserId) {
    await sendMessage(chatId, `❌ کاربر ${target} یافت نشد.`, BACK_KEYBOARD);
    return;
  }

  try {
    const fileStream = fs.createReadStream(filePath);
    await sendDocument(targetUserId, fileStream, `📁 فایل ارسالی از ادمین: ${filename}`);
    await sendMessage(chatId, `✅ فایل ${filename} با موفقیت به کاربر ارسال شد.`, BACK_KEYBOARD);
  } catch (error) {
    await sendMessage(chatId, `❌ خطا در ارسال فایل: ${error.message}`, BACK_KEYBOARD);
  }
}

// تابع جدید برای ارسال فایل از طریق بات
async function handleFileUpload(chatId, fileId, fileName) {
  try {
    // دریافت اطلاعات فایل
    const fileInfo = await getFile(fileId);
    if (!fileInfo.ok) {
      throw new Error('خطا در دریافت اطلاعات فایل');
    }

    // دانلود فایل
    const filePath = fileInfo.result.file_path;
    const tempFilePath = `./temp_${Date.now()}_${fileName}`;
    await downloadFile(filePath, tempFilePath);

    // ارسال فایل به کاربر
    const fileStream = fs.createReadStream(tempFilePath);
    await sendDocument(chatId, fileStream, `📁 ${fileName}`);

    // حذف فایل موقت
    fs.unlinkSync(tempFilePath);

    return true;
  } catch (error) {
    console.error('خطا در ارسال فایل:', error);
    return false;
  }
}

async function handleAddBalance(chatId, text) {
  const parts = text.split(" ");
  if (parts.length !== 3) {
    await sendMessage(chatId, "❌ فرمت دستور اشتباه است.\n\nمثال صحیح:\n/add @username 50000\n/add 123456789 100000", BACK_KEYBOARD);
    return;
  }

  const target = parts[1].replace("@", "");
  const amount = parseInt(parts[2]);

  if (isNaN(amount)) {
    await sendMessage(chatId, "❌ مبلغ باید عددی باشد.", BACK_KEYBOARD);
    return;
  }

  const balances = loadBalances();
  let targetUserId = null;
  let targetUsername = "";

  // جستجو با یوزرنیم
  for (let uid in balances) {
    if (balances[uid].username === target) {
      targetUserId = uid;
      targetUsername = balances[uid].username;
      break;
    }
  }

  // اگر با یوزرنیم پیدا نشد، شاید آی دی عددی باشد
  if (!targetUserId && !isNaN(target)) {
    targetUserId = target;
    targetUsername = balances[target]?.username || target;
  }

  if (!targetUserId) {
    await sendMessage(chatId, `❌ کاربر ${target} یافت نشد.`, BACK_KEYBOARD);
    return;
  }

  addBalance(targetUserId, amount);
  await sendMessage(chatId, `✅ کیف‌پول کاربر @${targetUsername} به اندازه ${amount} تومان شارژ شد.`, BACK_KEYBOARD);
}

// ---------- خرید وایرگارد ----------
async function showWireguard(chatId, userId) {
  const bal = getBalance(userId);
  let text = `🛒 خرید وایرگارد\nموجودی تو: *${bal}* تومان\n\nانتخاب کن:`;
  const keyboard = { keyboard: Object.keys(WIRED_ITEMS).map(i => [{ text: i }]).concat([[{ text: "⬅️ بازگشت" }]]), resize_keyboard: true };
  await sendMessage(chatId, text, keyboard);
}

async function handleWireguard(chatId, userId, user, itemName) {
  const item = WIRED_ITEMS[itemName];
  if (!item) return sendMessage(chatId, "❌ چنین آیتمی وجود ندارد.", BACK_KEYBOARD);
  const bal = getBalance(userId);
  if (bal < item.price) {
    return sendMessage(chatId, `💸 موجودی کافی نیست.\nقیمت: ${item.price} تومان\nموجودی: ${bal} تومان`, BACK_KEYBOARD);
  }
  addBalance(userId, -item.price);
  logPurchase(user, itemName, item.price);
  await sendMessage(chatId, `✅ خرید موفق!\n${item.info}\n📤 لطفاً پس از ارسال رسید، منتظر فایل از ادمین باشید.`, BACK_KEYBOARD);
  await sendMessage(ADMIN_ID, `🛒 کاربر @${user.username || user.first_name} خرید کرد:\n${item.info}\nمبلغ: ${item.price} تومان`);
}

// ---------- شارژ کیف‌پول ----------
const CARD_NUMBER = "6219-8618-2900-7888";

async function chargeWallet(chatId) {
  const cardMessage = `💳 برای شارژ کیف‌پول، مبلغ را واریز کن به کارت:\n\n*${CARD_NUMBER}*\n\n📸 سپس عکس رسید پرداخت رو ارسال کن.`;
  await sendMessage(chatId, cardMessage);
}

async function handleReceipt(chatId, userId, user, photo) {
  const fileId = photo[photo.length - 1].file_id;
  
  // ذخیره اطلاعات رسید
  logReceipt(user, fileId);
  
  // ارسال عکس رسید به ادمین
  try {
    await sendPhoto(ADMIN_ID, fileId, `📸 کاربر @${user.username || user.first_name || 'بدون نام'} رسید ارسال کرد\n\n👤 آی‌دی کاربر: ${userId}`);
  } catch (error) {
    console.error('خطا در ارسال عکس به ادمین:', error);
    await sendMessage(ADMIN_ID, `📸 کاربر @${user.username || user.first_name || 'بدون نام'} رسید ارسال کرد اما خطا در نمایش عکس\n\n👤 آی‌دی کاربر: ${userId}`);
  }
  
  await sendMessage(chatId, "✅ رسید دریافت شد، پس از تأیید توسط ادمین موجودی بروزرسانی می‌شود.");
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
  
  // ایجاد پوشه files اگر وجود ندارد
  if (!fs.existsSync("./files")) {
    fs.mkdirSync("./files");
  }
  
  // ایجاد پوشه temp اگر وجود ندارد
  if (!fs.existsSync("./temp")) {
    fs.mkdirSync("./temp");
  }
  
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

        // دستورات ادمین
        if (userId === ADMIN_ID) {
          if (text === "/admin") {
            await showAdminPanel(chat_id);
            continue;
          }
          
          if (text.startsWith("/file")) {
            await handleFileCommand(chat_id, text);
            continue;
          }
          
          if (text.startsWith("/add")) {
            await handleAddBalance(chat_id, text);
            continue;
          }
          
          if (text === "📊 آمار کاربران") {
            await showUserStats(chat_id);
            continue;
          }
          
          if (text === "💰 کاربران خریداری کرده") {
            await showPurchaseUsers(chat_id);
            continue;
          }
          
          if (text === "📸 کاربران ارسال رسید") {
            await showReceiptUsers(chat_id);
            continue;
          }
          
          if (text === "📤 ارسال فایل به کاربر") {
            await sendMessage(chat_id, "📤 برای ارسال فایل به کاربر از دستور زیر استفاده کنید:\n\n/file @username filename.txt\n/file 123456789 config.conf", BACK_KEYBOARD);
            continue;
          }

          // ارسال فایل از طریق بات
          if (msg.document) {
            const fileId = msg.document.file_id;
            const fileName = msg.document.file_name;
            const success = await handleFileUpload(chat_id, fileId, fileName);
            if (success) {
              await sendMessage(chat_id, `✅ فایل ${fileName} با موفقیت ارسال شد.`);
            } else {
              await sendMessage(chat_id, "❌ خطا در ارسال فایل.");
            }
            continue;
          }
        }

        if (text === "/start") {
          await sendMessage(chat_id, "🥕 خوش آمدید! منوی اصلی:", MAIN_KEYBOARD);
          continue;
        }

        if (text === "🛒 خرید وایرگارد") {
          await showWireguard(chat_id, userId);
          continue;
        }

        if (WIRED_ITEMS[text]) {
          await handleWireguard(chat_id, userId, user, text);
          continue;
        }

        if (text === "💳 شارژ کیف‌پول") {
          await chargeWallet(chat_id);
          continue;
        }

        if (msg.photo) {
          await handleReceipt(chat_id, userId, user, msg.photo);
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
          if (userId === ADMIN_ID) {
            await showAdminPanel(chat_id);
          } else {
            await sendMessage(chat_id, "🔙 بازگشتی به منوی اصلی", MAIN_KEYBOARD);
          }
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
