import fetch from 'node-fetch';

const TOKEN = "7346348218:AAGU8aUR-07GtJUZxw6JQ2X2Os9Jm_ZhGYU";
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;
const BALANCE_FILE = "balances.json";
const ADMIN_ID = 6823146420;

// ===== مدیریت داده =====
function loadBalances() {
    if (!fs.existsSync(BALANCE_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(BALANCE_FILE, "utf-8"));
    } catch (e) {
        return {};
    }
}

function saveBalances(balances) {
    fs.writeFileSync(BALANCE_FILE, JSON.stringify(balances, null, 2), {encoding:"utf-8"});
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
            country: null
        };
        saveBalances(balances);
    }
}

function updateCountry(userId, country) {
    const balances = loadBalances();
    const uid = String(userId);
    if (balances[uid]) {
        balances[uid].country = country;
        saveBalances(balances);
    }
}

function addBalance(userId, amount) {
    const balances = loadBalances();
    const uid = String(userId);
    if (!balances[uid]) balances[uid] = {coins:0};
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
    if (!balances[uid]) balances[uid] = {coins:0, ref: refId};
    else if (!balances[uid].ref && refId != userId) balances[uid].ref = refId;
    saveBalances(balances);
}

// ===== Telegram API =====
async function sendMessage(chatId, text, reply_markup=null) {
    const payload = {chat_id: chatId, text, parse_mode:"Markdown"};
    if (reply_markup) payload.reply_markup = reply_markup;
    const res = await fetch(`${BASE_URL}/sendMessage`, {
        method: "POST",
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
    });
    return res.json();
}

async function getUpdates(offset=null, timeout=60) {
    let url = `${BASE_URL}/getUpdates?timeout=${timeout}`;
    if (offset) url += `&offset=${offset}`;
    const res = await fetch(url);
    return res.json();
}

// ===== منوها =====
const MAIN_KEYBOARD = {
    keyboard:[
        [{text:"🎮 شروع بازی"}],
        [{text:"👥 دعوت دوستان"}],
        [{text:"👝 کیف پول"}],
        [{text:"🛒 خرید فایل"}]
    ],
    resize_keyboard:true
};

const BACK_KEYBOARD = {keyboard:[[{text:"⬅️ بازگشت"}]], resize_keyboard:true};

// ===== خرید =====
const ITEMS = {
    "📄 فایل آموزشی": {price:50, link:"https://example.com/file1.zip"},
    "🎵 موسیقی ویژه": {price:80, link:"https://example.com/music.mp3"},
    "🧰 ابزار خاص": {price:120, link:"https://example.com/tool.rar"},
};

async function showShop(chatId, userId) {
    const bal = getBalance(userId);
    const text = `🛍️ فروشگاه فایل‌ها\nموجودی تو: *${bal}* 🥕\n\nانتخاب کن:`;
    const keyboard = {keyboard:Object.keys(ITEMS).map(item=>[{text:item}]).concat([[{text:"⬅️ بازگشت"}]]), resize_keyboard:true};
    await sendMessage(chatId, text, keyboard);
}

async function handlePurchase(userId, chatId, itemName) {
    if (!ITEMS[itemName]) return sendMessage(chatId,"❌ چنین آیتمی وجود ندارد.", BACK_KEYBOARD);
    const bal = getBalance(userId);
    const item = ITEMS[itemName];
    if (bal < item.price) return sendMessage(chatId, `😞 موجودی کافی نیست.\nقیمت: ${item.price} 🥕\nموجودی فعلی: ${bal} 🥕`, BACK_KEYBOARD);
    addBalance(userId, -item.price);
    await sendMessage(chatId, `✅ خرید موفق!\n${itemName}\n📥 لینک دانلود:\n${item.link}`, BACK_KEYBOARD);
}

// ===== بازی =====
function gameResultText(result) {
    if (result==0) return "💀 متأسفم! چیزی نصیبت نشد...";
    return `🎉 تبریک! ${result} 🥕 هویج گرفتی!`;
}

async function playGame(userId, chatId) {
    for (let i=3;i>0;i--) {
        await sendMessage(chatId, `⏳ ${i} ...`);
        await new Promise(r=>setTimeout(r,1000));
    }
    const result = [0,1,3,6][Math.floor(Math.random()*4)];
    addBalance(userId,result);
    await sendMessage(chatId, gameResultText(result));
    if(result>0) {
        const total = getBalance(userId);
        await sendMessage(chatId, `🏦 موجودی فعلی: *${total}* 🥕`);
    }
}

// ===== رفرال =====
function referralLink(userId) {
    return `https://t.me/USERNAME_BOT?start=${userId}`;
}

async function handleReferral(userId,text) {
    if(!text.startsWith("/start ")) return;
    const refId = parseInt(text.split(" ")[1]);
    if(refId && refId!=userId) {
        setRef(userId, refId);
        addBalance(refId,1);
        await sendMessage(refId, "🥕 یه دوست جدید دعوت کردی!\n+1 هویج بهت اضافه شد 🎉");
    }
}

// ===== حلقه اصلی =====
async function main(){
    console.log("🥕 CarrotBot (Node.js) running...");
    let offset = null;
    const userStates = {};

    while(true){
        let updates;
        try {updates = await getUpdates(offset);} catch(e){console.log(e); await new Promise(r=>setTimeout(r,2000)); continue;}

        for(const upd of updates.result){
            offset = upd.update_id+1;
            if(!upd.message) continue;

            const msg = upd.message;
            const chatId = msg.chat.id;
            const user = msg.from;
            const userId = user.id;
            const text = msg.text?.trim();

            ensureUser(user);
            const balances = loadBalances();
            const udata = balances[String(userId)];

            // در حال وارد کردن کشور
            if(userStates[userId]=="country_input"){
                updateCountry(userId,text);
                await sendMessage(chatId,"✅ کشور ذخیره شد!",MAIN_KEYBOARD);
                delete userStates[userId];
                continue;
            }

            // اگر کشور ثبت نشده
            if(!udata.country){
                await sendMessage(chatId,"🥕 سلام به مزرعه‌ی هویج خوش اومدی!\nاول کشورت رو بنویس تا ادامه بدیم 👇");
                userStates[userId]="country_input";
                continue;
            }

            // بررسی رفرال
            if(text.startsWith("/start ")) { await handleReferral(userId,text); await sendMessage(chatId,"🌍 کشور شما قبلاً ذخیره شده است.",MAIN_KEYBOARD); continue;}
            if(text=="/start"){ await sendMessage(chatId,"🥕 سلام به مزرعه‌ی هویج خوش اومدی!\nاول کشورت رو بنویس تا ادامه بدیم 👇"); userStates[userId]="country_input"; continue;}

            // منوها
            if(text=="🎮 شروع بازی"){ await playGame(userId,chatId); continue;}
            if(text=="👝 کیف پول"){ await sendMessage(chatId,`💰 موجودی کیف‌پول: *${getBalance(userId)}* 🥕`,MAIN_KEYBOARD); continue;}
            if(text=="👥 دعوت دوستان"){ await sendMessage(chatId,`👥 لینک دعوت مخصوصت:\n${referralLink(userId)}\n\nهر کسی از طریق این لینک بیاد، ۱ 🥕 می‌گیری!`,BACK_KEYBOARD); continue;}
            if(text=="🛒 خرید فایل"){ await showShop(chatId,userId); continue;}
            if(ITEMS[text]){ await handlePurchase(userId,chatId,text); continue;}
            if(text=="⬅️ بازگشت"){ await sendMessage(chatId,"🔙 بازگشتی به منوی اصلی",MAIN_KEYBOARD); continue;}

            await sendMessage(chatId,"🤔 متوجه نشدم، از منوی پایین استفاده کن 👇",MAIN_KEYBOARD);
        }
        await new Promise(r=>setTimeout(r,500));
    }
}

main();
