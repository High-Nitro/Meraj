
// index.js (Node.js, CommonJS)
// Requires Node 18+ (global fetch)

const fs = require("fs");
const path = require("path");
const port = process.env.PORT || 4000 

const TOKEN = "PUT_YOUR_TOKEN_HERE"; // <-- توکن ربات
const ADMIN_ID = 6823146420;        // <-- شناسه ادمین عددی
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;

const BALANCE_FILE = path.resolve(__dirname, "balances.json");
const ORDERS_FILE = path.resolve(__dirname, "orders.json");

// ---------- persistence helpers ----------
function readJson(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    console.error("readJson error", filePath, e);
    return {};
  }
}
function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

// ---------- balances ----------
function loadBalances() { return readJson(BALANCE_FILE); }
function saveBalances(b) { writeJson(BALANCE_FILE, b); }
function ensureUser(user) {
  const b = loadBalances();
  const uid = String(user.id);
  if (!b[uid]) {
    b[uid] = {
      coins: 0,
      ref: null,
      name: user.first_name || "",
      username: user.username || "",
      country: null
    };
    saveBalances(b);
  }
}
function getBalance(uid) {
  const b = loadBalances();
  return (b[String(uid)] && b[String(uid)].coins) || 0;
}
function addBalance(uid, amount) {
  const b = loadBalances();
  const id = String(uid);
  b[id] = b[id] || { coins: 0 };
  b[id].coins = (b[id].coins || 0) + amount;
  saveBalances(b);
  return b[id].coins;
}
function setRefFor(uid, refId) {
  const b = loadBalances();
  const id = String(uid);
  b[id] = b[id] || { coins: 0, ref: null };
  if (!b[id].ref && refId != uid) b[id].ref = refId;
  saveBalances(b);
}
function setCountry(uid, country) {
  const b = loadBalances();
  const id = String(uid);
  b[id] = b[id] || { coins: 0 };
  b[id].country = country;
  saveBalances(b);
}

// ---------- orders ----------
/*
orders.json structure:
{
 "orderId1": { id, user_id, type: "wireguard"|"topup"|"member_placeholder", item, price, status: "pending"|"completed"|"rejected", created_at, meta: {...} },
 ...
}
*/
function loadOrders(){ return readJson(ORDERS_FILE); }
function saveOrders(o){ writeJson(ORDERS_FILE, o); }
function createOrder(orderObj){
  const orders = loadOrders();
  const id = Date.now().toString(); // unique
  orderObj.id = id;
  orderObj.created_at = Date.now();
  orders[id] = orderObj;
  saveOrders(orders);
  return orders[id];
}
function getOrder(id){ return loadOrders()[String(id)]; }
function updateOrder(id, patch){
  const orders = loadOrders();
  if(!orders[String(id)]) return null;
  orders[String(id)] = { ...orders[String(id)], ...patch };
  saveOrders(orders);
  return orders[String(id)];
}

// ---------- Telegram API helpers ----------
async function api(method, payload={}, isJson=true){
  const url = `${BASE_URL}/${method}`;
  const headers = {};
  let body;
  if (isJson) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(payload);
    const res = await fetch(url, { method: "POST", headers, body });
    return res.json();
  } else {
    // fallback form-encoded
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(payload);
    const res = await fetch(url, { method: "POST", headers, body });
    return res.json();
  }
}

async function sendMessage(chat_id, text, reply_markup=null, parse_mode="Markdown"){
  const payload = { chat_id, text, parse_mode };
  if (reply_markup) payload.reply_markup = reply_markup;
  return api("sendMessage", payload);
}
async function forwardMessage(chat_id, from_chat_id, message_id){
  return api("forwardMessage", { chat_id, from_chat_id, message_id });
}
async function sendDocument(chat_id, document, caption=""){
  // assume document is a URL string (Telegram can fetch it)
  return api("sendDocument", { chat_id, document, caption });
}

// ---------- Keyboards ----------
const MAIN_KEYBOARD = {
  keyboard:[
    [{text:"🛍️ شاپ"}],
    [{text:"👝 کیف پول"}, {text:"💳 شارژ کیف پول"}],
    [{text:"📨 سفارش‌های من"}]
  ], resize_keyboard:true
};
const SHOP_KBD = {
  keyboard:[
    [{text:"🌐 وایرگارد 1 ماه — 95"}, {text:"🌐 وایرگارد 2 ماه — 140"}],
    [{text:"📦 ممبر (غیرفعال)"}],
    [{text:"⬅️ بازگشت"}]
  ], resize_keyboard:true
};
const BACK_KEYBOARD = { keyboard:[[ {text:"⬅️ بازگشت"} ]], resize_keyboard:true };

const ADMIN_KEYBOARD = {
  keyboard:[
    [{text:"📋 لیست سفارش‌های معلق"}, {text:"💳 لیست شارژهای معلق"}],
    [{text:"➕ شارژ کیف‌پول (اعمال)"} , {text:"📤 ارسال فایل برای سفارش"}],
    [{text:"🔙 خروج از پنل"}]
  ], resize_keyboard:true
};

// ---------- Shop items (pricing in تومان, as user asked) ----------
const SHOP_ITEMS = {
  "وایرگارد_1m": { title: "1 ماه • 1 کاربره • 33 گیگ (گیم/وب) • 95", price: 95, tag:"wireguard", meta:{ duration:"1 month", users:1, quota:"33GB" } },
  "وایرگارد_2m": { title: "2 ماه • 1 کاربره • 75 گیگ (گیم/وب) • 140", price: 140, tag:"wireguard", meta:{ duration:"2 months", users:1, quota:"75GB" } }
};
// Note: ممبر فیک غیرفعال به صورت placeholder:
const MEMBER_PLACEHOLDER = { title:"ممبر فیک (غیرفعال - تماس پشتیبانی)", price_per_1000:70 };

// ---------- states ----------
const userStates = {};   // userStates[userId] = { action: "await_country"|"topup_amount"|"topup_wait_photo"|"ordering_item":itemKey }
const adminStates = {};  // adminStates[ADMIN_ID] = { action: "...", payload: {...} }

// ---------- util ----------
function keyboardToReply(k){ return JSON.stringify(k); }

// ---------- flows ----------
async function handleStart(msg){
  const chat_id = msg.chat.id;
  const user = msg.from;
  ensureUser(user);
  const balances = loadBalances();
  const u = balances[String(user.id)];
  if (!u.country) {
    await sendMessage(chat_id, "🌍 لطفاً کشور خود را وارد کنید:");
    userStates[user.id] = { action: "await_country" };
    return;
  }
  // show main keyboard (admin sees admin panel button)
  const mk = JSON.parse(JSON.stringify(MAIN_KEYBOARD));
  if (user.id === ADMIN_ID) mk.keyboard.push([{text:"🔐 پنل ادمین"}]);
  await sendMessage(chat_id, `🥕 سلام ${u.name || ""}!\nخوش آمدی. منو را انتخاب کن:`, mk);
}

async function handleTextMessage(msg){
  const chat_id = msg.chat.id;
  const user = msg.from;
  const text = (msg.text||"").trim();
  ensureUser(user);
  const uid = user.id;

  // user states handling (country/topup ordering)
  const st = userStates[uid];
  if (st && st.action === "await_country"){
    setCountry(uid, text);
    await sendMessage(chat_id, "✅ کشور ذخیره شد.", MAIN_KEYBOARD);
    delete userStates[uid];
    return;
  }
  if (st && st.action === "topup_amount"){
    const amount = parseInt(text.replace(/[^0-9]/g,""));
    if (!amount || amount <= 0){
      await sendMessage(chat_id, "مبلغ نامعتبر است، مبلغ را به صورت عددی وارد کنید (مثال: 50000):", BACK_KEYBOARD);
      return;
    }
    // set state to wait for photo
    userStates[uid] = { action:"topup_wait_photo", amount };
    await sendMessage(chat_id, `مبلغ ${amount} تومان ثبت شد. لطفاً عکس رسید پرداخت را ارسال کنید.`, BACK_KEYBOARD);
    return;
  }
  if (st && st.action === "ordering_item"){
    // not used in this flow; ordering handled by button presses
  }

  // Admin panel access
  if (text === "🔐 پنل ادمین" && uid === ADMIN_ID){
    await sendMessage(chat_id, "🔐 خوش آمدی به پنل ادمین", ADMIN_KEYBOARD);
    return;
  }

  // Admin actions via keyboard buttons
  if (uid === ADMIN_ID){
    // list pending orders
    if (text === "📋 لیست سفارش‌های معلق"){
      const orders = loadOrders();
      const pend = Object.values(orders).filter(o=>o.status==="pending" && o.type!=="topup");
      if (!pend.length) {
        await sendMessage(chat_id, "📭 هیچ سفارش معلقی وجود ندارد.");
      } else {
        let lines = pend.map(o => `ID:${o.id} — user:${o.user_id} — ${o.item_title || o.item} — ${o.price} تومان — ${o.status}`);
        await sendMessage(chat_id, "📋 سفارش‌های معلق:\n\n" + lines.join("\n\n"));
      }
      return;
    }
    if (text === "💳 لیست شارژهای معلق"){
      const orders = loadOrders();
      const pend = Object.values(orders).filter(o=>o.status==="pending" && o.type==="topup");
      if (!pend.length){ await sendMessage(chat_id, "📭 هیچ درخواست شارژی وجود ندارد."); }
      else {
        let lines = pend.map(o=>`ID:${o.id} — user:${o.user_id} — مبلغ:${o.amount} تومان — زمان:${new Date(o.created_at).toLocaleString()}`);
        await sendMessage(chat_id, "📭 شارژهای معلق:\n\n"+lines.join("\n\n"));
      }
      return;
    }
    if (text === "➕ شارژ کیف‌پول (اعمال)"){
      adminStates[ADMIN_ID] = { action:"admin_wait_credit_user" };
      await sendMessage(chat_id, "📝 لطفاً شناسه کاربر را برای شارژ وارد کنید:");
      return;
    }
    if (text === "📤 ارسال فایل برای سفارش"){
      adminStates[ADMIN_ID] = { action: "admin_send_file_ask_order" };
      await sendMessage(chat_id, "📝 لطفاً ID سفارش را وارد کنید تا برای کاربر فایل/لینک ارسال کنم:");
      return;
    }
    if (text === "🔙 خروج از پنل"){
      await sendMessage(chat_id, "🔙 از پنل خارج شدید.", MAIN_KEYBOARD);
      delete adminStates[ADMIN_ID];
      return;
    }
  }

  // User menu buttons
  if (text === "🛍️ شاپ"){
    await sendMessage(chat_id, "🛒 فروشگاه را انتخاب کن:", SHOP_KBD);
    return;
  }
  if (text === "👝 کیف پول"){
    const bal = getBalance(uid);
    await sendMessage(chat_id, `💰 موجودی کیف‌پول: *${bal}* تومان`, MAIN_KEYBOARD);
    return;
  }
  if (text === "💳 شارژ کیف پول"){
    // ask amount first
    userStates[uid] = { action: "topup_amount" };
    await sendMessage(chat_id, "📥 لطفاً مبلغ شارژ (تومان) را به صورت عدد وارد کن:", BACK_KEYBOARD);
    return;
  }
  if (text === "📨 سفارش‌های من" || text === "📨 سفارش‌های من "){
    const orders = loadOrders();
    const my = Object.values(orders).filter(o=>String(o.user_id)===String(uid));
    if (!my.length) { await sendMessage(chat_id, "📭 شما هنوز سفارشی ثبت نکرده‌اید.", MAIN_KEYBOARD); }
    else {
      let lines = my.map(o=>`ID:${o.id}\nنوع:${o.type}\nمورد:${o.item_title||o.item}\nقیمت:${o.price}\nوضعیت:${o.status}`);
      await sendMessage(chat_id, "📦 سفارش‌های شما:\n\n"+lines.join("\n\n"), MAIN_KEYBOARD);
    }
    return;
  }

  // Shop item selections
  if (text === "🌐 وایرگارد 1 ماه — 95"){
    // item key وایرگارد_1m
    const item = SHOP_ITEMS["وایرگارد_1m"];
    // check balance
    const bal = getBalance(uid);
    if (bal < item.price){
      await sendMessage(chat_id, `😞 موجودی کافی نیست. قیمت: ${item.price} تومان\nموجودی: ${bal} تومان\nبرای شارژ کیف‌پول از دکمه «💳 شارژ کیف پول» استفاده کن.`, MAIN_KEYBOARD);
      return;
    }
    // create order: deduct balance and mark pending
    addBalance(uid, -item.price);
    const order = createOrder({ user_id: uid, type: "wireguard", item: "وایرگارد_1m", item_title: item.title, price: item.price, status: "pending", meta: item.meta });
    // notify admin
    await sendMessage(chat_id, `✅ سفارش ثبت شد (ID: ${order.id}). سفارش شما پس از بررسی طی 24-48 ساعت انجام می‌شود.`, MAIN_KEYBOARD);
    await sendMessage(ADMIN_ID, `📥 سفارش جدید:\nID:${order.id}\nکاربر:${uid}\n${item.title}\nقیمت:${item.price}\nبرای تکمیل: از پنل ادمین استفاده کنید.`, ADMIN_KEYBOARD);
    return;
  }
  if (text === "🌐 وایرگارد 2 ماه — 140"){
    const item = SHOP_ITEMS["وایرگارد_2m"];
    const bal = getBalance(uid);
    if (bal < item.price){
      await sendMessage(chat_id, `😞 موجودی کافی نیست. قیمت: ${item.price} تومان\nموجودی: ${bal} تومان\nبرای شارژ کیف‌پول از دکمه «💳 شارژ کیف پول» استفاده کن.`, MAIN_KEYBOARD);
      return;
    }
    addBalance(uid, -item.price);
    const order = createOrder({ user_id: uid, type: "wireguard", item: "وایرگارد_2m", item_title: item.title, price: item.price, status: "pending", meta: item.meta });
    await sendMessage(chat_id, `✅ سفارش ثبت شد (ID: ${order.id}). سفارش شما پس از بررسی طی 24-48 ساعت انجام می‌شود.`, MAIN_KEYBOARD);
    await sendMessage(ADMIN_ID, `📥 سفارش جدید:\nID:${order.id}\nکاربر:${uid}\n${item.title}\nقیمت:${item.price}\nبرای تکمیل: از پنل ادمین استفاده کنید.`, ADMIN_KEYBOARD);
    return;
  }
  if (text === "📦 ممبر (غیرفعال)"){
    await sendMessage(chat_id, "❗ این سرویس غیرفعال است. برای سفارشات بزرگ یا خدمات تبلیغی قانونی با پشتیبانی تماس بگیرید.", MAIN_KEYBOARD);
    return;
  }

  // back
  if (text === "⬅️ بازگشت"){
    await sendMessage(chat_id, "🔙 بازگشتی به منوی اصلی", MAIN_KEYBOARD);
    return;
  }

  // admin interactive states
  if (uid === ADMIN_ID && adminStates[ADMIN_ID]){
    const astate = adminStates[ADMIN_ID];
    if (astate.action === "admin_wait_credit_user"){
      // expecting user id
      const targetId = parseInt(text.replace(/[^0-9]/g,""));
      if (!targetId){ await sendMessage(chat_id, "شناسه نامعتبر، دوباره وارد کن:"); return; }
      astate.payload = { targetId };
      astate.action = "admin_wait_credit_amount";
      await sendMessage(chat_id, `✅ شناسه دریافت شد: ${targetId}\nلطفاً مبلغ (تومان) برای شارژ وارد کن:`);
      return;
    }
    if (astate.action === "admin_wait_credit_amount"){
      const amount = parseInt(text.replace(/[^0-9]/g,""));
      if (!amount){ await sendMessage(chat_id, "مبلغ نامعتبر، دوباره وارد کن:"); return; }
      const tid = astate.payload.targetId;
      const newbal = addBalance(tid, amount);
      await sendMessage(chat_id, `✅ کیف‌پول کاربر ${tid} به اندازه ${amount} تومان شارژ شد. موجودی جدید: ${newbal}`);
      try { await sendMessage(tid, `🎉 کیف‌پول شما ${amount} تومان شارژ شد!\nموجودی جدید: ${newbal}`); } catch(e){ /* ignore */ }
      delete adminStates[ADMIN_ID];
      return;
    }
    if (astate.action === "admin_send_file_ask_order"){
      const orderId = text.trim();
      const order = getOrder(orderId);
      if (!order){ await sendMessage(chat_id, "سفارش پیدا نشد، لطفاً ID درست را وارد کن:"); return; }
      astate.payload = { orderId };
      astate.action = "admin_send_file_wait_link";
      await sendMessage(chat_id, `✅ سفارش یافت: ID ${orderId}\nلطفاً لینک فایل یا متن ارسال به کاربر را وارد کن:`);
      return;
    }
    if (astate.action === "admin_send_file_wait_link"){
      const link = text.trim();
      const orderId = astate.payload.orderId;
      const order = getOrder(orderId);
      if (!order){ await sendMessage(chat_id, "خطا: سفارش دیگر وجود ندارد."); delete adminStates[ADMIN_ID]; return; }
      // mark completed and send link to user
      updateOrder(orderId, { status: "completed", admin_note: `file_sent: ${link}`, completed_at: Date.now() });
      try {
        await sendMessage(order.user_id, `✅ سفارش شما (ID:${orderId}) تکمیل شد.\nلینک/فایل:\n${link}`);
      } catch(e){
        await sendMessage(chat_id, `⚠️ ارسال به کاربر ناموفق بود: ${e.message}`);
      }
      await sendMessage(chat_id, `✅ فایل به کاربر ارسال شد و سفارش ${orderId} تکمیل شد.`);
      delete adminStates[ADMIN_ID];
      return;
    }
  }

  // fallback
  await sendMessage(chat_id, "متوجه نشدم — از منوی پایین استفاده کن.", MAIN_KEYBOARD);
}

// ---------- handle photos (for topup receipts) ----------
async function handlePhotoMessage(msg){
  const chat_id = msg.chat.id;
  const user = msg.from;
  const uid = user.id;
  const st = userStates[uid];
  // if awaiting topup photo
  if (st && st.action === "topup_wait_photo"){
    const amount = st.amount;
    // forward message to admin
    try {
      await forwardMessage(ADMIN_ID, chat_id, msg.message_id);
    } catch(e){
      // fallback: send note
      await sendMessage(ADMIN_ID, `📸 رسید شارژ از کاربر ${uid} (ولی فوروارد نشد).`);
    }
    // create topup order (pending)
    const order = createOrder({ user_id: uid, type: "topup", amount, status: "pending", meta: { note: "receipt forwarded" } });
    await sendMessage(chat_id, `✅ رسید ارسال شد. درخواست شارژ با ID:${order.id} ثبت شد. پس از بررسی ادمین، کیف‌پول شما شارژ می‌شود.`);
    await sendMessage(ADMIN_ID, `📥 درخواست شارژ جدید:\nID:${order.id}\nکاربر:${uid}\nمبلغ:${amount}\nبرای تایید/رد از پنل ادمین استفاده کنید.`);
    delete userStates[uid];
    return;
  }
  // otherwise ignore or notify
  await sendMessage(chat_id, "اگر قصد ارسال رسید را دارید، ابتدا از منوی «💳 شارژ کیف پول» اقدام کنید.", MAIN_KEYBOARD);
}

// ---------- main polling loop ----------
async function getUpdates(offset=null){
  const url = `${BASE_URL}/getUpdates?timeout=30${offset?`&offset=${offset}`:""}`;
  const res = await fetch(url);
  return res.json();
}

async function main(){
  console.log("CarrotBot starting...");
  let offset = null;
  while(true){
    try {
      const data = await getUpdates(offset);
      if (!data || !data.result) { await new Promise(r=>setTimeout(r,1000)); continue; }
      for (const upd of data.result){
        offset = upd.update_id + 1;
        if (upd.message){
          const msg = upd.message;
          const chat_id = msg.chat.id;
          const user = msg.from;
          // ensure user
          ensureUser(user);
          if (msg.text){
            const txt = msg.text.trim();
            if (txt === "/start"){
              await handleStart(msg);
            } else if (txt.startsWith("/start ")){
              // referral handling
              const ref = txt.split(" ")[1];
              const refId = parseInt(ref);
              if (refId && refId !== user.id){
                setRefFor(user.id, refId);
                addBalance(refId, 1);
                await sendMessage(refId, `🥕 کاربری با دعوت شما وارد شد. +1 هویج دریافت کردید.`);
              }
              await handleStart(msg);
            } else {
              await handleTextMessage(msg);
            }
          } else if (msg.photo){
            // photo received
            await handlePhotoMessage(msg);
          } else {
            // other content
            await sendMessage(chat_id, "نوع پیام پشتیبانی نمی‌شود. لطفاً متن یا عکس ارسال کن.", MAIN_KEYBOARD);
          }
        }
      }
    } catch (e){
      console.error("Main loop error:", e);
      await new Promise(r=>setTimeout(r,2000));
    }
  }
}

main();
