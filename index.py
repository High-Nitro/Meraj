# Updated Telegram Bot with Admin Panel, User List, and File Broadcast
# NOTE: Replace TOKEN and ADMIN_ID with secure values before use.

import subprocess
import sys

# Auto‑install missing packages
def install(package):
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
    except Exception as e:
        print(f"❌ Error installing {package}: {e}")
        exit()

try:
    from telegram import Update, ReplyKeyboardMarkup
    from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
except ModuleNotFoundError:
    print("📦 python-telegram-bot missing! Installing...")
    install("python-telegram-bot")
    from telegram import Update, ReplyKeyboardMarkup
    from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

import logging
import re

TOKEN = "7346348218:AAGU8aUR-07GtJUZxw6JQ2X2Os9Jm_ZhGYU"   # ← Replace
ADMIN_ID = 6823146420         # ← Replace

logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

# User database
database = {}   # {user_id: {username, first_name}}
user_state = {} # track modes

# ------------------------------------------------------------
# START COMMAND
# ------------------------------------------------------------
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user

    # Register user
    database[user.id] = {
        "username": user.username,
        "first_name": user.first_name
    }

    keyboard = []
    if user.id == ADMIN_ID:
        keyboard = [["🛠 پنل مدیریت"], ["📞 ارتباط با ما"], ["🛒 خرید کانفیگ وایرگارد"], ["🎬 خرید اشتراک فیلیمو"], ["🌐 سایت ما"]]
    else:
        keyboard = [["📞 ارتباط با ما"], ["🛒 خرید کانفیگ وایرگارد"], ["🎬 خرید اشتراک فیلیمو"], ["🌐 سایت ما"]]

    reply = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
    text = f"👋 سلام {user.first_name}! به فروشگاه ما خوش آمدی. یکی از گزینه‌ها را انتخاب کن:"
    await update.message.reply_text(text, reply_markup=reply)

# ------------------------------------------------------------
# ADMIN PANEL
# ------------------------------------------------------------
async def admin_panel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return await update.message.reply_text("❌ شما ادمین نیستید.")

    keyboard = [["📋 لیست کاربران"], ["📤 ارسال فایل به کاربران"], ["⬅️ برگشت"]]
    reply = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
    await update.message.reply_text("🛠 پنل مدیریت", reply_markup=reply)

# ------------------------------------------------------------
# SHOW USER LIST
# ------------------------------------------------------------
async def show_users(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return

    text = "📋 لیست کاربران ثبت‌شده:\n\n"
    for uid, info in database.items():
        username = info.get("username") or "—"
        text += f"👤 {info['first_name']} — 🆔 {uid} — @{username}\n"

    await update.message.reply_text(text)

# ------------------------------------------------------------
# BROADCAST FILE MODE
# ------------------------------------------------------------
async def broadcast_mode(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return

    user_state[ADMIN_ID] = {"mode": "awaiting_broadcast_file"}
    await update.message.reply_text("📤 لطفاً فایل یا عکس موردنظر را ارسال کنید تا برای تمام کاربران ارسال شود.")

# ------------------------------------------------------------
# HANDLE BROADCAST FILE
# ------------------------------------------------------------
async def handle_broadcast(update: Update, context: ContextTypes.DEFAULT_TYPE):
    state = user_state.get(ADMIN_ID, {}).get("mode")

    if update.effective_user.id == ADMIN_ID and state == "awaiting_broadcast_file":
        file = None

        if update.message.photo:
            file = update.message.photo[-1].file_id
            send_type = "photo"
        elif update.message.document:
            file = update.message.document.file_id
            send_type = "document"
        else:
            return await update.message.reply_text("❌ فقط عکس یا فایل قابل ارسال است.")

        count = 0
        for uid in database.keys():
            try:
                if send_type == "photo":
                    await context.bot.send_photo(uid, file)
                elif send_type == "document":
                    await context.bot.send_document(uid, file)
                count += 1
            except:
                pass

        await update.message.reply_text(f"✅ فایل با موفقیت برای {count} کاربر ارسال شد.")
        user_state.pop(ADMIN_ID, None)

# ------------------------------------------------------------
# BUY, CONTACT & RECEIPT HANDLING
# ------------------------------------------------------------
async def contact_us(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_state[update.effective_user.id] = {"mode": "awaiting_contact"}
    await update.message.reply_text("📞 فرمت: نام - شماره موبایل")

async def buy_wireguard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_state[update.effective_user.id] = {"mode": "awaiting_wireguard"}
    await update.message.reply_text("🛒 خرید وایرگارد — عکس رسید را ارسال کنید.")

async def buy_filimo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_state[update.effective_user.id] = {"mode": "awaiting_filimo"}
    await update.message.reply_text("🎬 خرید فیلیمو — عکس رسید را ارسال کنید.")

# ------------------------------------------------------------
# HANDLE USER MESSAGES & RECEIPTS
# ------------------------------------------------------------
async def handle_user(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    mode = user_state.get(uid, {}).get("mode")
    msg = update.message.text

    # ADMIN BUTTONS
    if uid == ADMIN_ID:
        if msg == "🛠 پنل مدیریت": return await admin_panel(update, context)
        if msg == "📋 لیست کاربران": return await show_users(update, context)
        if msg == "📤 ارسال فایل به کاربران": return await broadcast_mode(update, context)
        if msg == "⬅️ برگشت": return await start(update, context)

    # CONTACT FORM
    if mode == "awaiting_contact":
        if "-" not in msg:
            return await update.message.reply_text("❌ فرمت اشتباه است.")
        name, phone = msg.split("-", 1)
        await context.bot.send_message(ADMIN_ID, f"📨 درخواست تماس جدید:\n👤 {name.strip()}\n📞 {phone.strip()}\n🆔 {uid}")
        user_state.pop(uid, None)
        return await update.message.reply_text("✅ ثبت شد.")

    # RECEIPT HANDLING
    if mode in ["awaiting_wireguard", "awaiting_filimo"]:
        if not update.message.photo:
            return await update.message.reply_text("❌ لطفاً رسید را بصورت عکس ارسال کنید.")

        user = update.effective_user
        username = f"@{user.username}" if user.username else "—"
        service = "وایرگارد" if mode == "awaiting_wireguard" else "فیلیمو"

        await context.bot.send_message(ADMIN_ID,
            f"📥 رسید جدید برای {service}:\n"
            f"👤 {user.first_name}\n🆔 {uid}\n🔗 {username}"
        )
        await context.bot.send_photo(ADMIN_ID, update.message.photo[-1].file_id)

        user_state.pop(uid, None)
        return await update.message.reply_text("✅ رسید شما ثبت شد.")

    # MAIN BUTTONS
    if msg == "📞 ارتباط با ما": return await contact_us(update, context)
    if msg == "🛒 خرید کانفیگ وایرگارد": return await buy_wireguard(update, context)
    if msg == "🎬 خرید اشتراک فیلیمو": return await buy_filimo(update, context)
    if msg == "🌐 سایت ما": return await update.message.reply_text("🌐 https://speednethavij.ir")

    await update.message.reply_text("از منو استفاده کنید /start")

# ------------------------------------------------------------
# MAIN
# ------------------------------------------------------------
def main():
    app = Application.builder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.PHOTO, handle_broadcast))
    app.add_handler(MessageHandler(filters.Document.ALL, handle_broadcast))

    app.add_handler(MessageHandler(filters.ALL, handle_user))

    print("🤖 Bot Running...")
    app.run_polling()

if __name__ == "__main__":
    main()
