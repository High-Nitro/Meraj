// index.js
// Node 18+ required (global fetch available)

const fs = require("fs");
const path = require("path");
const express = require("express");

const TOKEN = "7346348218:AAGU8aUR-07GtJUZxw6JQ2X2Os9Jm_ZhGYU"; // <-- جای توکن خودت بذار
const ADMIN_ID = 6823146420; // <-- شناسه ادمینت
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;

const BALANCE_FILE = path.resolve(__dirname, "balances.json");
const ORDERS_FILE = path.resolve(__dirname, "orders.json");

// کارت برای شارژ (درخواست قبلی)
const CARD_NUMBER = "6219-8618-2900-7888";

// ---------- helpers ----------
function readJson(p){
  if(!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p,"utf8")); }
  catch(e){ console.error("JSON read error", p, e); return {}; }
}
function writeJson(p,obj){ fs.writeFileSync(p, JSON.stringify(obj,null,2), "utf8"); }

// balances
function loadBalances(){ return readJson(BALANCE_FILE); }
function saveBalances(b){ writeJson(BALANCE_FILE,b); }
function ensureUser(user){
  const b = loadBalances();
  const uid = String(user.id);
  if(!b[uid]) {
    b[uid] = {
      coins: 0,
      name: user.first_name || "",
      username: user.username || "",
      country: null
    };
    saveBalances(b);
  }
}
function getBalance(uid){ const b=loadBalances(); return (b[String(uid)]?.coins)||0; }
function addBalance(uid,amount){ const b=loadBalances(); const id=String(uid); b[id]=b[id]||{coins:0}; b[id].coins=(b[id].coins||0)+amount; saveBalances(b); return b[id].coins; }
function setCountry(uid,country){ const b=loadBalances(); const id=String(uid); b[id]=b[id]||{coins:0}; b[id].country=country; saveBalances(b); }
function getUserInfo(uid){ const b=loadBalances(); return b[String(uid)]||null; }

// orders
function loadOrders(){ return readJson(ORDERS_FILE); }
function saveOrders(o){ writeJson(ORDERS_FILE,o); }
function createOrder(obj){ const orders=loadOrders(); const id=Date.now().toString(); obj.id=id; obj.created_at=Date.now(); orders[id]=obj; saveOrders(orders); return orders[id]; }
function updateOrder(id,patch){ const orders=loadOrders(); if(!orders[String(id)]) return null; orders[String(id)] = {...orders[String(id)], ...patch}; saveOrders(orders); return orders[String(id)]; }
function getOrder(id){ return loadOrders()[String(id)]; }

// ---------- Telegram API ----------
async function api(method, payload){
  const url = `${BASE_URL}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });
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
async function sendDocument(chat_id, document, caption=""){
  return api("sendDocument", { chat_id, document, caption });
}

// ---------- Keyboards ----------
const MAIN_KEYBOARD = { keyboard: [[{text:"🛍️ شاپ"}],[{text:"👤 اطلاعات من"},{text:"📨 سفارش‌های من"}]], resize_keyboard:true };
const SHOP_KBD = { keyboard: [[{text:"🌐 وایرگارد 1 ماه — 95,000 تومان"},{text:"🌐 وایرگارد 2 ماه — 140,000 تومان"}],[{text:"📦 درخواست ممبر (بررسی)"}],[{text:"⬅️ بازگشت"}]], resize_keyboard:true };
const BACK_KEYBOARD = { keyboard: [[{text:"⬅️ بازگشت"}]], resize_keyboard:true };
const ADMIN_KEYBOARD = { keyboard: [[{text:"📋 سفارش‌های معلق"},{text:"💳 شارژ کیف‌پول"}],[{text:"📤 ارسال لینک/فایل به سفارش"},{text:"❌ رد سفارش"}],[{text:"🔙 خروج"}]], resize_keyboard:true };

// ---------- Shop items (prices in تومان) ----------
const SHOP_ITEMS = {
  "wire1": { key:"wire1", title:"وایرگارد — 1 ماه • 1 کاربره • 33GB • 95,000 تومان", price:95000, meta:{duration:"1 ماه",quota:"33GB"} },
  "wire2": { key:"wire2", title:"وایرگارد — 2 ماه • 1 کاربره • 75GB • 140,000 تومان", price:140000, meta:{duration:"2 ماه",quota:"75GB"} }
};
// member placeholder: price per 1000
const MEMBER_PRICE_PER_1000 = 70000; // 70,000 تومان

// ---------- state management ----------
const userState = {}; // userId => { step: "...", payload: {...} }
const adminState = {}; // admin steps

// ---------- flows ----------
async function handleStart(msg){
  const chat = msg.chat.id;
  const user = msg.from;
  ensureUser(user);
  const info = getUserInfo(user.id);
  if(!info.country){
    userState[user.id] = { step:"await_country" };
    await sendMessage(chat, "🌍 لطفاً کشور خود را وارد کنید:");
    return;
  }
  const mk = JSON.parse(JSON.stringify(MAIN_KEYBOARD));
  if(user.id === ADMIN_ID) mk.keyboard.push([{text:"🔐 پنل ادمین"}]);
  await sendMessage(chat, `👋 سلام ${info.name||""}!\nسلامت باشی — منو را انتخاب کن:`, mk);
}

async function handleText(msg){
  const chat = msg.chat.id;
  const user = msg.from;
  const uid = user.id;
  ensureUser(user);
  const text = (msg.text||"").trim();

  // user state steps
  const st = userState[uid];
  if(st){
    if(st.step === "await_country"){
      setCountry(uid, text);
      delete userState[uid];
      await sendMessage(chat, "✅ کشور شما ذخیره شد.", MAIN_KEYBOARD);
      return;
    }
    if(st.step === "await_member_details"){
      // expecting "channel_link | count" or multiline; we'll parse basic
      const payloadText = text;
      // basic parse: find last number -> count, rest -> channel
      const m = payloadText.match(/(\d{1,7})\D*$/);
      let count = 0;
      let channel = payloadText;
      if(m){ count = parseInt(m[1]); channel = payloadText.slice(0, m.index).trim(); }
      if(!channel || !count){
        await sendMessage(chat, "فرمت درست نیست. لطفاً ابتدا لینک یا آیدی کانال، سپس تعداد را بنویس. مثال:\n@mychannel 2000", BACK_KEYBOARD);
        return;
      }
      // create order (pending)
      const price = Math.ceil(count/1000) * MEMBER_PRICE_PER_1000;
      const order = createOrder({ user_id:uid, type:"member_request", item_title:`درخواست ممبر ${count} عدد`, price, status:"pending", meta:{channel, count} });
      delete userState[uid];
      await sendMessage(chat, `✅ درخواست شما ثبت شد (ID:${order.id}). قیمت تقریبی: *${price.toLocaleString()}* تومان.\nادمین بررسی می‌کند و طی 24-48 ساعت پاسخ داده می‌شود.`, MAIN_KEYBOARD);
      await sendMessage(ADMIN_ID, `📥 درخواست ممبر جدید:\nID:${order.id}\nکاربر:${uid}\nکانال:${channel}\nتعداد:${count}\nقیمت:${price}\nبرای تکمیل/رد از پنل ادمین استفاده کنید.`, ADMIN_KEYBOARD);
      return;
    }
  }

  // Admin panel
  if(text === "🔐 پنل ادمین" && uid === ADMIN_ID){
    adminState[ADMIN_ID] = { step:null };
    await sendMessage(chat, "🔐 پنل ادمین فعال شد", ADMIN_KEYBOARD);
    return;
  }
  if(uid === ADMIN_ID && adminState[ADMIN_ID]){
    const a = adminState[ADMIN_ID];
    // list pending orders
    if(text === "📋 سفارش‌های معلق"){
      const pend = Object.values(loadOrders()).filter(o=>o.status==="pending");
      if(!pend.length) return await sendMessage(chat, "📭 هیچ سفارش معلقی وجود ندارد.");
      const lines = pend.map(o=>`ID:${o.id}\nکاربر:${o.user_id}\nنوع:${o.type}\nمورد:${o.item_title||o.item}\nقیمت:${o.price.toLocaleString()} تومان\n---`);
      return await sendMessage(chat, "📋 سفارش‌های معلق:\n\n"+lines.join("\n\n"));
    }
    // charge wallet
    if(text === "💳 شارژ کیف‌پول"){
      adminState[ADMIN_ID] = { step:"admin_await_charge_user" };
      return await sendMessage(chat, "📝 شناسه کاربر را وارد کنید برای شارژ:");
    }
    if(a.step === "admin_await_charge_user"){
      const tid = parseInt(text.replace(/\D/g,""));
      if(!tid) return await sendMessage(chat, "شناسه نامعتبر، دوباره وارد کن:");
      adminState[ADMIN_ID] = { step:"admin_await_charge_amount", payload:{ target: tid } };
      return await sendMessage(chat, `شناسه: ${tid}\nحالا مبلغ (تومان) را وارد کن:`);
    }
    if(a.step === "admin_await_charge_amount"){
      const amount = parseInt(text.replace(/\D/g,""));
      if(!amount) return await sendMessage(chat, "مبلغ نامعتبر، دوباره وارد کن:");
      const tid = a.payload.target;
      const newbal = addBalance(tid, amount);
      delete adminState[ADMIN_ID];
      await sendMessage(chat, `✅ کیف‌پول کاربر ${tid} به اندازه ${amount.toLocaleString()} تومان شارژ شد. موجودی جدید: ${newbal.toLocaleString()} تومان`);
      try{ await sendMessage(tid, `🎉 کیف‌پول شما ${amount.toLocaleString()} تومان شارژ شد. موجودی جدید: ${newbal.toLocaleString()} تومان`); }catch(e){}
      return;
    }
    // send link/file to order
    if(text === "📤 ارسال لینک/فایل به سفارش"){
      adminState[ADMIN_ID] = { step:"admin_ask_order_id_for_send" };
      return await sendMessage(chat, "📝 لطفاً ID سفارش را وارد کنید:");
    }
    if(a.step === "admin_ask_order_id_for_send"){
      const oid = text.trim();
      const ord = getOrder(oid);
      if(!ord) return await sendMessage(chat, "سفارش پیدا نشد، ID را درست وارد کنید:");
      adminState[ADMIN_ID] = { step:"admin_await_link", payload:{ orderId: oid } };
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
    if(text === "❌ رد سفارش"){
      adminState[ADMIN_ID] = { step:"admin_ask_reject_id" };
      return await sendMessage(chat, "📝 لطفاً ID سفارش برای رد را وارد کنید:");
    }
    if(a.step === "admin_ask_reject_id"){
      const oid = text.trim();
      const ord = getOrder(oid);
      if(!ord) return await sendMessage(chat, "سفارش پیدا نشد، ID را دوباره وارد کن:");
      adminState[ADMIN_ID] = { step:"admin_await_reject_reason", payload:{ orderId: oid } };
      return await sendMessage(chat, `سفارش: ${oid}\nلطفاً دلیل رد یا توضیحی برای کاربر بنویس:`);
    }
    if(a.step === "admin_await_reject_reason"){
      const reason = text.trim();
      const oid = a.payload.orderId;
      updateOrder(oid, { status:"rejected", admin_note: reason, completed_at: Date.now() });
      const ord = getOrder(oid);
      try{ await sendMessage(ord.user_id, `❌ سفارش شما (ID:${oid}) رد شد.\nدلیل: ${reason}`); }catch(e){}
      delete adminState[ADMIN_ID];
      return await sendMessage(chat, `✅ سفارش ${oid} رد شد و کاربر مطلع گردید.`);
    }
    // exit admin
    if(text === "🔙 خروج"){ delete adminState[ADMIN_ID]; return await sendMessage(chat, "🔙 از پنل خارج شدید.", MAIN_KEYBOARD); }
  }

  // Main user actions
  if(text === "/start"){ return await handleStart(msg); }
  if(text === "🛍️ شاپ"){ return await sendMessage(chat, "🛒 لطفاً سرویس را انتخاب کن:", SHOP_KBD); }
  if(text === "👤 اطلاعات من"){
    const ui = getUserInfo(uid);
    const balance = getBalance(uid);
    return await sendMessage(chat, `👤 اطلاعات شما:\n• نام: ${ui.name||"-"}\n• یوزرنیم: ${ui.username?("@" + ui.username):"-"}\n• شناسه عددی: \`${uid}\`\n• کشور: ${ui.country||"-"}\n\n💰 موجودی: *${balance.toLocaleString()}* تومان`, MAIN_KEYBOARD);
  }
  if(text === "📨 سفارش‌های من"){
    const my = Object.values(loadOrders()).filter(o=>String(o.user_id)===String(uid));
    if(!my.length) return await sendMessage(chat, "📭 شما هنوز سفارشی ثبت نکرده‌اید.", MAIN_KEYBOARD);
    const lines = my.map(o=>`ID:${o.id}\nنوع:${o.type}\nمورد:${o.item_title||o.item}\nقیمت:${(o.price||0).toLocaleString()} تومان\nوضعیت:${o.status}`);
    return await sendMessage(chat, "📦 سفارش‌های شما:\n\n" + lines.join("\n\n"), MAIN_KEYBOARD);
  }

  // Shop selections
  if(text === "🌐 وایرگارد 1 ماه — 95,000 تومان" || text.includes("وایرگارد 1")){
    const item = SHOP_ITEMS["wire1"];
    const bal = getBalance(uid);
    if(bal < item.price) return await sendMessage(chat, `😞 موجودی کافی نیست.\nقیمت: ${item.price.toLocaleString()} تومان\nموجودی: ${bal.toLocaleString()} تومان\nبرای شارژ با ادمین تماس بگیرید.`, MAIN_KEYBOARD);
    // create order and deduct balance
    addBalance(uid, -item.price);
    const order = createOrder({ user_id:uid, type:"wireguard", item:"wire1", item_title:item.title, price:item.price, status:"pending", meta:item.meta });
    await sendMessage(chat, `✅ سفارش ثبت شد (ID:${order.id}). سفارش در وضعیت pending قرار گرفت. ادمین بعدا لینک/فایل را ارسال خواهد کرد.`, MAIN_KEYBOARD);
    await sendMessage(ADMIN_ID, `📥 سفارش جدید وایرگارد:\nID:${order.id}\nکاربر:${uid}\n${item.title}\nقیمت:${item.price.toLocaleString()} تومان`, ADMIN_KEYBOARD);
    return;
  }
  if(text === "🌐 وایرگارد 2 ماه — 140,000 تومان" || text.includes("وایرگارد 2")){
    const item = SHOP_ITEMS["wire2"];
    const bal = getBalance(uid);
    if(bal < item.price) return await sendMessage(chat, `😞 موجودی کافی نیست.\nقیمت: ${item.price.toLocaleString()} تومان\nموجودی: ${bal.toLocaleString()} تومان\nبرای شارژ با ادمین تماس بگیرید.`, MAIN_KEYBOARD);
    addBalance(uid, -item.price);
    const order = createOrder({ user_id:uid, type:"wireguard", item:"wire2", item_title:item.title, price:item.price, status:"pending", meta:item.meta });
    await sendMessage(chat, `✅ سفارش ثبت شد (ID:${order.id}). سفارش در وضعیت pending قرار گرفت. ادمین بعدا لینک/فایل را ارسال خواهد کرد.`, MAIN_KEYBOARD);
    await sendMessage(ADMIN_ID, `📥 سفارش جدید وایرگارد:\nID:${order.id}\nکاربر:${uid}\n${item.title}\nقیمت:${item.price.toLocaleString()} تومان`, ADMIN_KEYBOARD);
    return;
  }
  if(text === "📦 درخواست ممبر (بررسی)"){
    // ask user for details
    userState[uid] = { step:"await_member_details" };
    return await sendMessage(chat, "📥 لطفاً آیدی یا لینک کانال و تعداد ممبر را بنویس (مثال: `@mychannel 2000`):", BACK_KEYBOARD);
  }

  // back
  if(text === "⬅️ بازگشت"){ delete userState[uid]; return await sendMessage(chat, "🔙 بازگشتی به منو", MAIN_KEYBOARD); }

  // fallback
  return await sendMessage(chat, "متوجه نشدم — از منوی پایین استفاده کن.", MAIN_KEYBOARD);
}

// ---------- handle photos (not used for user topup since removed) ----------
async function handlePhoto(msg){
  // currently we don't accept topup photos from users (topup removed).
  await sendMessage(msg.chat.id, "ارسال عکس پشتیبانی نمی‌شود در این نسخه. برای خریدها از مانده کیف‌پول استفاده کنید یا با ادمین تماس بگیرید.", MAIN_KEYBOARD);
}

// ---------- polling + small express server (for Render) ----------
async function getUpdates(offset=null){
  const url = `${BASE_URL}/getUpdates?timeout=30${offset?`&offset=${offset}`:""}`;
  const res = await fetch(url);
  return res.json();
}

async function main(){
  console.log("CarrotBot starting...");

  // express small server so Render web service is happy
  const app = express();
  const PORT = process.env.PORT || 3000;
  app.get("/", (req,res)=> res.send("CarrotBot is running"));
  app.listen(PORT, ()=> console.log(`Express listening on ${PORT}`));

  let offset = null;
  while(true){
    try{
      const data = await getUpdates(offset);
      if(!data || !data.result) { await new Promise(r=>setTimeout(r,1000)); continue; }
      for(const upd of data.result){
        offset = upd.update_id + 1;
        if(!upd.message) continue;
        const msg = upd.message;
        // ensure user in balances
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
