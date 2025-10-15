// index.js
// Node 18+ required (global fetch)
// CommonJS

const fs = require("fs");
const path = require("path");
const express = require("express");

// ===== تنظیمات (از env اگر موجود) =====
const TOKEN = process.env.TOKEN || "PUT_YOUR_TOKEN_HERE";
const ADMIN_ID = parseInt(process.env.ADMIN_ID || "6823146420", 10);
const CARD_NUMBER = process.env.CARD_NUMBER || "6219-8618-2900-7888";
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;

const BALANCE_FILE = path.resolve(__dirname, "balances.json");
const ORDERS_FILE = path.resolve(__dirname, "orders.json");

// ===== کمک‌کننده‌های فایل =====
function readJson(p){ if(!fs.existsSync(p)) return {}; try { return JSON.parse(fs.readFileSync(p,"utf8")); } catch(e){ console.error("readJson error", p, e); return {}; } }
function writeJson(p,obj){ fs.writeFileSync(p, JSON.stringify(obj,null,2), "utf8"); }

// ===== balances =====
function loadBalances(){ return readJson(BALANCE_FILE); }
function saveBalances(b){ writeJson(BALANCE_FILE, b); }
function ensureUser(user){
  if(!user || !user.id) return;
  const b = loadBalances();
  const uid = String(user.id);
  if(!b[uid]) {
    b[uid] = { coins: 0, name: user.first_name || "", username: user.username || "", country: null };
    saveBalances(b);
  }
}
function getBalance(uid){ const b = loadBalances(); return (b[String(uid)] && b[String(uid)].coins) || 0; }
function addBalance(uid, amount){ const b = loadBalances(); const id = String(uid); b[id] = b[id] || { coins: 0 }; b[id].coins = (b[id].coins || 0) + amount; saveBalances(b); return b[id].coins; }
function setCountry(uid, country){ const b = loadBalances(); const id = String(uid); b[id] = b[id] || { coins:0 }; b[id].country = country; saveBalances(b); }
function getUserInfo(uid){ const b = loadBalances(); return b[String(uid)] || null; }

// ===== orders =====
function loadOrders(){ return readJson(ORDERS_FILE); }
function saveOrders(o){ writeJson(ORDERS_FILE, o); }
function createOrder(obj){ const orders = loadOrders(); const id = Date.now().toString(); obj.id = id; obj.created_at = Date.now(); orders[id] = obj; saveOrders(orders); return orders[id]; }
function getOrder(id){ return loadOrders()[String(id)]; }
function updateOrder(id, patch){ const orders = loadOrders(); if(!orders[String(id)]) return null; orders[String(id)] = { ...orders[String(id)], ...patch }; saveOrders(orders); return orders[String(id)]; }

// ===== Telegram helpers =====
async function api(method, payload){
  const url = `${BASE_URL}/${method}`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(payload) });
  return res.json();
}
async function sendMessage(chat_id, text, reply_markup=null, parse_mode="Markdown"){
  const payload = { chat_id, text, parse_mode };
  if(reply_markup) payload.reply_markup = reply_markup;
  return api("sendMessage", payload);
}
async function forwardMessage(chat_id, from_chat_id, message_id){
  return api("forwardMessage", { chat_id, from_chat_id, message_id });
}

// ===== Keyboards =====
const MAIN_KEYBOARD = { keyboard:[ [{text:"🛍️ شاپ"}], [{text:"👤 اطلاعات من"},{text:"📨 سفارش‌های من"}], [{text:"💳 شارژ کیف پول"}] ], resize_keyboard:true };
const SHOP_KBD = { keyboard:[ [{text:"🌐 وایرگارد 1 ماه — 95,000 تومان"},{text:"🌐 وایرگارد 2 ماه — 140,000 تومان"}], [{text:"⬅️ بازگشت"}] ], resize_keyboard:true };
const BACK_KEYBOARD = { keyboard:[[ {text:"⬅️ بازگشت"} ]], resize_keyboard:true };
const ADMIN_KEYBOARD = { keyboard:[ [{text:"📋 سفارش‌های معلق"},{text:"📭 شارژهای معلق"}], [{text:"➕ شارژ کیف‌پول"},{text:"📤 ارسال لینک/فایل به سفارش"}], [{text:"❌ رد سفارش"},{text:"🔙 خروج از پنل"}] ], resize_keyboard:true };

// ===== shop items (تومان) =====
const SHOP_ITEMS = {
  wire1: { key:"wire1", title:"وایرگارد — 1 ماه • 1 کاربره • 33GB • 95,000 تومان", price:95000, meta:{duration:"1 ماه",quota:"33GB"} },
  wire2: { key:"wire2", title:"وایرگارد — 2 ماه • 1 کاربره • 75GB • 140,000 تومان", price:140000, meta:{duration:"2 ماه",quota:"75GB"} }
};

// ===== state =====
const userState = {};   // userId -> { step:..., payload:{} }
const adminState = {};  // ADMIN_ID -> { step:..., payload:{} }

// ===== flows =====
async function handleStart(msg){
  const chat = msg.chat.id;
  const user = msg.from;
  ensureUser(user);
  const info = getUserInfo(user.id);
  if(!info || !info.country){
    userState[user.id] = { step:"await_country" };
    await sendMessage(chat, "🌍 لطفاً کشور خود را وارد کنید:");
    return;
  }
  const mk = JSON.parse(JSON.stringify(MAIN_KEYBOARD));
  if(user.id === ADMIN_ID) mk.keyboard.push([{text:"🔐 پنل ادمین"}]);
  await sendMessage(chat, `👋 سلام ${info.name||""}! منو را انتخاب کن:`, mk);
}

async function handleText(msg){
  const chat = msg.chat.id;
  const user = msg.from;
  const uid = user.id;
  ensureUser(user);
  const text = (msg.text||"").trim();

  // user states
  const st = userState[uid];
  if(st){
    if(st.step === "await_country"){
      setCountry(uid, text);
      delete userState[uid];
      await sendMessage(chat, "✅ کشور شما ذخیره شد.", MAIN_KEYBOARD);
      return;
    }
    if(st.step === "await_topup_amount"){
      const amount = parseInt(text.replace(/\D/g,""));
      if(!amount || amount <=0){ await sendMessage(chat, "مبلغ نامعتبر است. مقدار را به صورت عدد وارد کنید:", BACK_KEYBOARD); return; }
      userState[uid] = { step:"await_topup_receipt", payload:{ amount } };
      await sendMessage(chat, `📌 مبلغ ثبت شد: ${amount.toLocaleString()} تومان\nلطفاً عکس رسید واریز را ارسال کنید.`, BACK_KEYBOARD);
      return;
    }
  }

  // Admin panel access (always available to admin)
  if(text === "🔐 پنل ادمین" && uid === ADMIN_ID){
    adminState[ADMIN_ID] = { step:null };
    await sendMessage(chat, "🔐 پنل ادمین فعال شد", ADMIN_KEYBOARD);
    return;
  }

  // Admin actions
  if(uid === ADMIN_ID && adminState[ADMIN_ID]){
    const a = adminState[ADMIN_ID];
    // list pending shop orders (not topup)
    if(text === "📋 سفارش‌های معلق"){
      const pend = Object.values(loadOrders()).filter(o=>o.status==="pending" && o.type === "wireguard");
      if(!pend.length) return await sendMessage(chat, "📭 هیچ سفارش وایرگاردِ معلقی وجود ندارد.");
      const lines = pend.map(o=>`ID:${o.id}\nکاربر:${o.user_id}\n${o.item_title}\nقیمت:${(o.price||0).toLocaleString()} تومان\n---`);
      return await sendMessage(chat, "📋 سفارش‌های وایرگارد معلق:\n\n" + lines.join("\n\n"));
    }
    // list pending topups
    if(text === "📭 شارژهای معلق"){
      const pend = Object.values(loadOrders()).filter(o=>o.status==="pending" && o.type === "topup");
      if(!pend.length) return await sendMessage(chat, "📭 هیچ درخواست شارژی وجود ندارد.");
      const lines = pend.map(o=>`ID:${o.id}\nکاربر:${o.user_id}\nمبلغ:${(o.amount||0).toLocaleString()} تومان\n---`);
      return await sendMessage(chat, "📭 شارژهای معلق:\n\n" + lines.join("\n\n"));
    }
    // admin credit flow start
    if(text === "➕ شارژ کیف‌پول"){
      adminState[ADMIN_ID] = { step:"admin_await_target" };
      return await sendMessage(chat, "📝 لطفاً شناسه (ID) کاربر را وارد کنید برای شارژ:");
    }
    if(a.step === "admin_await_target"){
      const tid = parseInt(text.replace(/\D/g,""));
      if(!tid) return await sendMessage(chat, "شناسه نامعتبر، دوباره وارد کن:");
      a.step = "admin_await_amount";
      a.payload = { target: tid };
      return await sendMessage(chat, `شناسه دریافت شد: ${tid}\nلطفاً مبلغ (تومان) را وارد کنید:`);
    }
    if(a.step === "admin_await_amount"){
      const amount = parseInt(text.replace(/\D/g,""));
      if(!amount || amount<=0) return await sendMessage(chat, "مبلغ نامعتبر، دوباره وارد کن:");
      const tid = a.payload.target;
      const newbal = addBalance(tid, amount);
      delete adminState[ADMIN_ID];
      await sendMessage(chat, `✅ کیف‌پول کاربر ${tid} به اندازه ${amount.toLocaleString()} تومان شارژ شد.\nموجودی جدید: ${newbal.toLocaleString()} تومان`);
      try{ await sendMessage(tid, `🎉 کیف‌پول شما ${amount.toLocaleString()} تومان شارژ شد!\nموجودی جدید: ${newbal.toLocaleString()} تومان`); }catch(e){ /* ignore */ }
      return;
    }
    // send link/file to order
    if(text === "📤 ارسال لینک/فایل به سفارش"){
      a.step = "admin_ask_order_id_for_send";
      return await sendMessage(chat, "📝 لطفاً ID سفارش را وارد کنید:");
    }
    if(a.step === "admin_ask_order_id_for_send"){
      const oid = text.trim();
      const ord = getOrder(oid);
      if(!ord) { a.step = null; return await sendMessage(chat, "سفارش پیدا نشد."); }
      a.step = "admin_await_link";
      a.payload = { orderId: oid };
      return await sendMessage(chat, `سفارش یافت: ID:${oid}\nلطفاً لینک یا متن ارسال به کاربر را وارد کنید:`);
    }
    if(a.step === "admin_await_link"){
      const link = text.trim();
      const oid = a.payload.orderId;
      updateOrder(oid, { status:"completed", admin_note: link, completed_at: Date.now() });
      const ord = getOrder(oid);
      try{ await sendMessage(ord.user_id, `✅ سفارش شما (ID:${oid}) تکمیل شد.\n${link}`); }catch(e){}
      delete adminState[ADMIN_ID];
      return await sendMessage(chat, `✅ لینک/فایل برای سفارش ${oid} ارسال شد.`);
    }
    // reject order
    if(text === "❌ رد سفارش"){
      a.step = "admin_ask_reject_id";
      return await sendMessage(chat, "📝 لطفاً ID سفارش برای رد را وارد کنید:");
    }
    if(a.step === "admin_ask_reject_id"){
      const oid = text.trim();
      const ord = getOrder(oid);
      if(!ord) { a.step = null; return await sendMessage(chat, "سفارش پیدا نشد."); }
      a.step = "admin_await_reject_reason";
      a.payload = { orderId: oid };
      return await sendMessage(chat, `سفارش: ${oid}\nلطفاً دلیل رد یا توضیحی برای کاربر بنویس:`);
    }
    if(a.step === "admin_await_reject_reason"){
      const reason = text.trim();
      const oid = a.payload.orderId;
      updateOrder(oid, { status:"rejected", admin_note: reason, completed_at: Date.now() });
      const ord = getOrder(oid);
      try{ await sendMessage(ord.user_id, `❌ سفارش شما (ID:${oid}) رد شد.\nدلیل: ${reason}`); }catch(e){}
      delete adminState[ADMIN_ID];
      return await sendMessage(chat, `✅ سفارش ${oid} رد شد و کاربر مطلع شد.`);
    }
    // logout admin
    if(text === "🔙 خروج از پنل" || text === "🔙 خروج"){
      delete adminState[ADMIN_ID];
      return await sendMessage(chat, "🔙 از پنل خارج شدید.", MAIN_KEYBOARD);
    }
  }

  // User actions
  if(text === "/start") return await handleStart(msg);
  if(text === "🛍️ شاپ") return await sendMessage(chat, "🛒 فروشگاه:", SHOP_KBD);
  if(text === "👤 اطلاعات من"){
    const ui = getUserInfo(uid);
    const bal = getBalance(uid);
    return await sendMessage(chat, `👤 اطلاعات شما:\n• نام: ${ui?.name||"-"}\n• یوزرنیم: ${ui?.username?("@" + ui.username):"-"}\n• شناسه: \`${uid}\`\n• کشور: ${ui?.country||"-"}\n\n💰 موجودی: *${bal.toLocaleString()}* تومان`, MAIN_KEYBOARD);
  }
  if(text === "📨 سفارش‌های من"){
    const my = Object.values(loadOrders()).filter(o=>String(o.user_id)===String(uid));
    if(!my.length) return await sendMessage(chat, "📭 شما هنوز سفارشی ثبت نکرده‌اید.", MAIN_KEYBOARD);
    const lines = my.map(o=>`ID:${o.id}\nنوع:${o.type}\nمورد:${o.item_title||o.item}\nقیمت:${(o.price||0).toLocaleString()} تومان\nوضعیت:${o.status}`);
    return await sendMessage(chat, "📦 سفارش‌های شما:\n\n" + lines.join("\n\n"), MAIN_KEYBOARD);
  }
  if(text === "💳 شارژ کیف پول"){
    userState[uid] = { step:"await_topup_amount" };
    return await sendMessage(chat, `💳 شماره کارت جهت واریز:\n\`${CARD_NUMBER}\`\n\nلطفاً مبلغ را وارد کنید (تومان):`, BACK_KEYBOARD);
  }

  // Shop flows: buy wireguard
  if(text.includes("وایرگارد 1") || text.includes("wire1")){
    const item = SHOP_ITEMS.wire1;
    const bal = getBalance(uid);
    if(bal < item.price) return await sendMessage(chat, `😞 موجودی کافی نیست.\nقیمت: ${item.price.toLocaleString()} تومان\nموجودی: ${bal.toLocaleString()} تومان`, MAIN_KEYBOARD);
    addBalance(uid, -item.price);
    const order = createOrder({ user_id: uid, type: "wireguard", item: item.key, item_title: item.title, price: item.price, status: "pending", meta: item.meta });
    await sendMessage(chat, `✅ سفارش ثبت شد (ID:${order.id}). سفارش در وضعیت pending قرار گرفت. ادمین پس از بررسی لینک/فایل را ارسال می‌کند.`, MAIN_KEYBOARD);
    await sendMessage(ADMIN_ID, `📥 سفارش وایرگارد جدید:\nID:${order.id}\nکاربر:${uid}\n${item.title}\nقیمت:${item.price.toLocaleString()} تومان`, ADMIN_KEYBOARD);
    return;
  }
  if(text.includes("وایرگارد 2") || text.includes("wire2")){
    const item = SHOP_ITEMS.wire2;
    const bal = getBalance(uid);
    if(bal < item.price) return await sendMessage(chat, `😞 موجودی کافی نیست.\nقیمت: ${item.price.toLocaleString()} تومان\nموجودی: ${bal.toLocaleString()} تومان`, MAIN_KEYBOARD);
    addBalance(uid, -item.price);
    const order = createOrder({ user_id: uid, type: "wireguard", item: item.key, item_title: item.title, price: item.price, status: "pending", meta: item.meta });
    await sendMessage(chat, `✅ سفارش ثبت شد (ID:${order.id}). سفارش در وضعیت pending قرار گرفت. ادمین پس از بررسی لینک/فایل را ارسال می‌کند.`, MAIN_KEYBOARD);
    await sendMessage(ADMIN_ID, `📥 سفارش وایرگارد جدید:\nID:${order.id}\nکاربر:${uid}\n${item.title}\nقیمت:${item.price.toLocaleString()} تومان`, ADMIN_KEYBOARD);
    return;
  }

  // back
  if(text === "⬅️ بازگشت"){ delete userState[uid]; return await sendMessage(chat, "🔙 بازگشتی به منو", MAIN_KEYBOARD); }

  // fallback
  return await sendMessage(chat, "متوجه نشدم — از منوی پایین استفاده کن.", MAIN_KEYBOARD);
}

// ===== photo handler (for topup receipts) =====
async function handlePhoto(msg){
  const chat = msg.chat.id;
  const user = msg.from;
  const uid = user.id;
  const st = userState[uid];
  if(st && st.step === "await_topup_receipt"){
    const amount = st.payload.amount;
    // forward receipt to admin
    try{
      await forwardMessage(ADMIN_ID, chat, msg.message_id);
    }catch(e){
      await sendMessage(ADMIN_ID, `📸 رسید از کاربر ${uid} ارسال شد (فوروارد ناموفق).`);
    }
    // create topup order pending
    const order = createOrder({ user_id: uid, type: "topup", amount, status: "pending", meta: { note: "receipt forwarded" } });
    delete userState[uid];
    await sendMessage(chat, `✅ رسید ارسال شد. درخواست شارژ با ID:${order.id} ثبت شد. پس از بررسی ادمین، کیف‌پول شما شارژ می‌شود.`);
    await sendMessage(ADMIN_ID, `📥 درخواست شارژ جدید:\nID:${order.id}\nکاربر:${uid}\nمبلغ:${amount.toLocaleString()} تومان\nبرای تایید/رد از پنل ادمین استفاده کنید.`, ADMIN_KEYBOARD);
    return;
  }
  // otherwise generic
  await sendMessage(chat, "برای ارسال رسید ابتدا از منو «💳 شارژ کیف پول» مبلغ را ثبت کن.", MAIN_KEYBOARD);
}

// ===== polling + express (برای Render) =====
async function getUpdates(offset=null){
  const url = `${BASE_URL}/getUpdates?timeout=30${offset?`&offset=${offset}`:""}`;
  const res = await fetch(url);
  return res.json();
}

async function main(){
  console.log("CarrotBot starting...");

  // small express so Render web service is happy
  const app = express();
  const PORT = process.env.PORT || 3000;
  app.get("/", (req,res) => res.send("CarrotBot is running"));
  app.listen(PORT, () => console.log(`Express listening on ${PORT}`));

  let offset = null;
  while(true){
    try{
      const data = await getUpdates(offset);
      if(!data || !data.result){ await new Promise(r=>setTimeout(r,1000)); continue; }
      for(const upd of data.result){
        offset = upd.update_id + 1;
        if(!upd.message) continue;
        const msg = upd.message;
        // ensure user
        if(msg.from) ensureUser(msg.from);
        if(msg.text) await handleText(msg);
        else if(msg.photo) await handlePhoto(msg);
        else await sendMessage(msg.chat.id, "نوع پیام پشتیبانی نمی‌شود.", MAIN_KEYBOARD);
      }
    }catch(e){
      console.error("Main loop error:", e);
      await new Promise(r=>setTimeout(r,2000));
    }
  }
}

main();
