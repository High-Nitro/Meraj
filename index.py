# Full-featured Telegram Bot (Admin panel + broadcasts + single sends + ban + channel checks)
# IMPORTANT: Replace TOKEN and ADMIN_ID with your values before running.

import subprocess
import sys

# Auto-install missing packages
def install(package):
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
    except Exception as e:
        print(f"❌ Error installing {package}: {e}")
        exit()

try:
    from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton
    from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, CallbackQueryHandler
except ModuleNotFoundError:
    print("📦 python-telegram-bot missing! Installing...")
    install("python-telegram-bot")
    from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton
    from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, CallbackQueryHandler

import logging
import re

# ------------------ CONFIG ------------------
TOKEN = "YOUR_TOKEN_HERE"
ADMIN_ID = 123456789
TELEGRAM_CHANNEL = "@PolinO2YT"  # your telegram channel username (with @)
YOUTUBE_CHANNEL_URL = "https://youtube.com/@polin02yt?si=1ytAdE0ADvFAJ23i"
# --------------------------------------------

logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

# Simple in-memory storages (use persistent DB in production)
users = {}          # {user_id: {first_name, username, banned: False, approved: False}}
user_modes = {}     # {user_id: {mode: ... , payload: ...}}
banned_users = set()
pending_youtube_proof = {}  # {user_id: file_id} — admin will verify

# Helper: register user
def register_user(user):
    if user.id not in users:
        users[user.id] = {"first_name": user.first_name or "—", "username": user.username or "—", "banned": False, "approved": False}
    else:
        users[user.id]["username"] = user.username or users[user.id]["username"]
        users[user.id]["first_name"] = user.first_name or users[user.id]["first_name"]

# Helper: check membership in required telegram channel
async def is_member_of_channel(context, user_id):
    try:
        member = await context.bot.get_chat_member(TELEGRAM_CHANNEL, user_id)
        return member.status not in ["left", "kicked"]
    except Exception as e:
        # if bot is not admin or channel invalid, treat as not member — admin should ensure bot is member of the channel
        logger.warning(f"Couldn't check channel membership: {e}")
        return False

# NOTE: It's NOT POSSIBLE to programmatically verify if a user is subscribed to a YouTube channel using the Telegram bot API.
# Therefore we implement a manual proof flow: user is asked to subscribe to the YouTube channel and send a screenshot (or proof file),
# which will be reviewed by the admin. Admin can approve the user after checking the proof.

# ------------------ START ------------------
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    register_user(user)

    if users[user.id].get("banned"):
        return await update.message.reply_text("❌ شما از ربات بن شده‌اید.")

    # Buttons: put buy buttons on the same row, others grouped
    if user.id == ADMIN_ID:
        keyboard = [
            ["🛒 خرید کانفیگ وایرگارد", "🎬 خرید اشتراک فیلیمو"],
            ["📞 ارتباط با ما", "🌐 سایت ما"],
            ["🛠 پنل مدیریت"]
        ]
    else:
        keyboard = [
            ["🛒 خرید کانفیگ وایرگارد", "🎬 خرید اشتراک فیلیمو"],
            ["📞 ارتباط با ما", "🌐 سایت ما"]
        ]

    reply = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
    await update.message.reply_text(f"👋 سلام {user.first_name}! به فروشگاه ما خوش آمدی. یکی از گزینه‌ها را انتخاب کن:", reply_markup=reply)

# ------------------ ADMIN PANEL ------------------
async def admin_panel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return await update.message.reply_text("❌ شما ادمین نیستید.")

    keyboard = [
        ["📋 لیست کاربران", "🔎 انتخاب کاربر"],
        ["📤 ارسال برای همه", "📨 ارسال متنی"],
        ["📷 ارسال عکس همه", "📁 ارسال فایل همه"],
        ["✅ بررسی یوتیوب", "🚫 بن/آنبن"],
        ["⬅️ برگشت"]
    ]
    await update.message.reply_text("🛠 پنل مدیریت", reply_markup=ReplyKeyboardMarkup(keyboard, resize_keyboard=True))

# ------------------ LIST USERS ------------------
async def list_users(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    if not users:
        return await update.message.reply_text("لیست کاربری ثبت نشده.")

    text = "📋 لیست کاربران:

"
    for uid, info in users.items():
        text += f"👤 {info['first_name']} — 🆔 {uid} — @{info['username']} — بن:{info.get('banned', False)} — یوتیوب تایید:{info.get('approved', False)}
"
    await update.message.reply_text(text)

# ------------------ SELECT USER (single send) ------------------
async def select_user_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    # store state and ask admin to send the user id or choose from list
    user_modes[ADMIN_ID] = {"mode": "awaiting_user_id_for_send"}
    await update.message.reply_text("🔎 لطفاً آیدی عددی کاربری که می‌خواهید ارسال تکی کنید را وارد کنید (یا /list_users برای دیدن لیست).")

# ------------------ BROADCAST FLOWS ------------------
async def broadcast_text_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    user_modes[ADMIN_ID] = {"mode": "awaiting_broadcast_text"}
    await update.message.reply_text("📨 لطفاً متن موردنظر را ارسال کنید تا برای همه ارسال شود.")

async def broadcast_photo_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    user_modes[ADMIN_ID] = {"mode": "awaiting_broadcast_photo"}
    await update.message.reply_text("📷 لطفاً عکس را ارسال کنید تا برای همه ارسال شود.")

async def broadcast_file_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    user_modes[ADMIN_ID] = {"mode": "awaiting_broadcast_file"}
    await update.message.reply_text("📁 لطفاً فایل را ارسال کنید تا برای همه ارسال شود.")

# ------------------ BAN / UNBAN ------------------
async def ban_unban_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    user_modes[ADMIN_ID] = {"mode": "awaiting_ban_unban"}
    await update.message.reply_text("🚫 لطفاً آیدی عددی کاربر را ارسال کنید تا بن/آنبن شود.")

# ------------------ YOUTUBE PROOF FLOW ------------------
async def youtube_broadcast_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    user_modes[ADMIN_ID] = {"mode": "awaiting_youtube_broadcast"}
    await update.message.reply_text("📢 لطفاً متن + لینک یوتیوب را با یک خط فاصله ارسال کنید (مثال: متن سلام - https://youtube.com/...).")

# ------------------ USER ACTIONS (contact / buy) ------------------
async def contact_us(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    if users.get(uid, {}).get('banned'):
        return await update.message.reply_text('❌ شما بن شده‌اید.')

    # require telegram channel membership
    if not await is_member_of_channel(context, uid):
        await update.message.reply_text(f"⚠️ لطفاً ابتدا به کانال تلگرامی ما بپیوندید: {TELEGRAM_CHANNEL}")
        return

    # require youtube proof
    if not users[uid].get('approved'):
        user_modes[uid] = {"mode": "awaiting_youtube_proof_for_contact"}
        await update.message.reply_text(f"⚠️ لطفاً کانال یوتیوب ما را سابسکرایب کنید: {YOUTUBE_CHANNEL_URL} و یک عکس از اثبات ارسال کنید برای بررسی توسط ادمین.")
        return

    user_modes[uid] = {"mode": "awaiting_contact"}
    await update.message.reply_text("📞 فرمت: نام - شماره موبایل")

async def buy_wireguard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    if users.get(uid, {}).get('banned'):
        return await update.message.reply_text('❌ شما بن شده‌اید.')

    # membership & youtube check
    if not await is_member_of_channel(context, uid):
        await update.message.reply_text(f"⚠️ لطفاً ابتدا به کانال تلگرامی ما بپیوندید: {TELEGRAM_CHANNEL}")
        return
    if not users[uid].get('approved'):
        user_modes[uid] = {"mode": "awaiting_youtube_proof_for_buy"}
        await update.message.reply_text(f"⚠️ لطفاً کانال یوتیوب ما را سابسکرایب کنید: {YOUTUBE_CHANNEL_URL} و یک عکس از اثبات ارسال کنید برای بررسی توسط ادمین.")
        return

    user_modes[uid] = {"mode": "awaiting_wireguard_receipt"}
    await update.message.reply_text("🛒 خرید وایرگارد — عکس رسید را ارسال کنید.")

async def buy_filimo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    if users.get(uid, {}).get('banned'):
        return await update.message.reply_text('❌ شما بن شده‌اید.')

    if not await is_member_of_channel(context, uid):
        await update.message.reply_text(f"⚠️ لطفاً ابتدا به کانال تلگرامی ما بپیوندید: {TELEGRAM_CHANNEL}")
        return
    if not users[uid].get('approved'):
        user_modes[uid] = {"mode": "awaiting_youtube_proof_for_buy"}
        await update.message.reply_text(f"⚠️ لطفاً کانال یوتیوب ما را سابسکرایب کنید: {YOUTUBE_CHANNEL_URL} و یک عکس از اثبات ارسال کنید برای بررسی توسط ادمین.")
        return

    user_modes[uid] = {"mode": "awaiting_filimo_receipt"}
    await update.message.reply_text("🎬 خرید فیلیمو — عکس رسید را ارسال کنید.")

# ------------------ MESSAGE HANDLER ------------------
async def message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message:
        return
    uid = update.effective_user.id
    register_user(update.effective_user)

    # Handle admin commands from panel
    text = (update.message.text or "").strip()
    mode = user_modes.get(uid, {}).get('mode')

    # Admin quick buttons
    if uid == ADMIN_ID and text:
        if text == "🛠 پنل مدیریت":
            return await admin_panel(update, context)
        if text == "📋 لیست کاربران":
            return await list_users(update, context)
        if text == "🔎 انتخاب کاربر":
            return await select_user_prompt(update, context)
        if text == "📤 ارسال برای همه":
            return await broadcast_text_prompt(update, context)
        if text == "📨 ارسال متنی":
            return await broadcast_text_prompt(update, context)
        if text == "📷 ارسال عکس همه":
            return await broadcast_photo_prompt(update, context)
        if text == "📁 ارسال فایل همه":
            return await broadcast_file_prompt(update, context)
        if text == "✅ بررسی یوتیوب":
            return await update.message.reply_text("📌 برای تایید یوتیوب کاربر، از /approve_user <user_id> استفاده کنید پس از بررسی تصاویر ارسالی.")
        if text == "🚫 بن/آنبن":
            return await ban_unban_prompt(update, context)
        if text == "⬅️ برگشت":
            return await start(update, context)

    # Admin awaiting states
    if uid == ADMIN_ID and mode:
        # awaiting broadcast text
        if mode == "awaiting_broadcast_text" and text:
            sent = 0
            for user_id, info in users.items():
                if info.get('banned'):
                    continue
                try:
                    await context.bot.send_message(user_id, text)
                    sent += 1
                except:
                    pass
            user_modes.pop(ADMIN_ID, None)
            return await update.message.reply_text(f"✅ پیام برای {sent} کاربر ارسال شد.")

        # awaiting single user id to send next
        if mode == "awaiting_user_id_for_send" and text.isdigit():
            target = int(text)
            if target not in users:
                return await update.message.reply_text("❌ کاربر یافت نشد.")
            user_modes[ADMIN_ID] = {"mode": "awaiting_single_send_content", "target": target}
            return await update.message.reply_text(f"✅ آیدی دریافت شد. حالا عکس/فایل/متن را ارسال کنید تا برای {target} فرستاده شود.")

        # awaiting single send content
        if mode == "awaiting_single_send_content":
            target = user_modes[ADMIN_ID].get('target')
            # if it's text
            if text:
                try:
                    await context.bot.send_message(target, text)
                    await update.message.reply_text("✅ پیام متنی ارسال شد.")
                except Exception as e:
                    await update.message.reply_text(f"❌ ارسال نشد: {e}")
                user_modes.pop(ADMIN_ID, None)
                return

        # awaiting broadcast photo
        if mode == "awaiting_broadcast_photo" and update.message.photo:
            file_id = update.message.photo[-1].file_id
            sent = 0
            for user_id, info in users.items():
                if info.get('banned'):
                    continue
                try:
                    await context.bot.send_photo(user_id, file_id)
                    sent += 1
                except:
                    pass
            user_modes.pop(ADMIN_ID, None)
            return await update.message.reply_text(f"✅ عکس برای {sent} کاربر ارسال شد.")

        # awaiting broadcast file/document
        if mode == "awaiting_broadcast_file" and update.message.document:
            file_id = update.message.document.file_id
            sent = 0
            for user_id, info in users.items():
                if info.get('banned'):
                    continue
                try:
                    await context.bot.send_document(user_id, file_id)
                    sent += 1
                except:
                    pass
            user_modes.pop(ADMIN_ID, None)
            return await update.message.reply_text(f"✅ فایل برای {sent} کاربر ارسال شد.")

        # awaiting ban/unban
        if mode == "awaiting_ban_unban" and text.isdigit():
            target = int(text)
            if target not in users:
                return await update.message.reply_text('❌ کاربر یافت نشد.')
            users[target]['banned'] = not users[target].get('banned', False)
            status = 'بن شد' if users[target]['banned'] else 'آنبن شد'
            user_modes.pop(ADMIN_ID, None)
            return await update.message.reply_text(f'✅ کاربر {target} {status}.')

        # awaiting youtube broadcast
        if mode == "awaiting_youtube_broadcast" and text and ' - ' in text:
            msg, link = text.split(' - ', 1)
            sent = 0
            full = f"📺 ویدیو جدید: {msg}
{link}"
            for user_id, info in users.items():
                if info.get('banned'):
                    continue
                try:
                    await context.bot.send_message(user_id, full)
                    sent += 1
                except:
                    pass
            user_modes.pop(ADMIN_ID, None)
            return await update.message.reply_text(f"✅ لینک یوتیوب برای {sent} کاربر ارسال شد.")

    # Admin sending a document/photo while in broadcast single-send
    if uid == ADMIN_ID and mode == "awaiting_single_send_content":
        target = user_modes[ADMIN_ID].get('target')
        if update.message.photo:
            file_id = update.message.photo[-1].file_id
            try:
                await context.bot.send_photo(target, file_id)
                await update.message.reply_text("✅ عکس ارسال شد.")
            except Exception as e:
                await update.message.reply_text(f"❌ ارسال نشد: {e}")
            user_modes.pop(ADMIN_ID, None)
            return
        if update.message.document:
            file_id = update.message.document.file_id
            try:
                await context.bot.send_document(target, file_id)
                await update.message.reply_text("✅ فایل ارسال شد.")
            except Exception as e:
                await update.message.reply_text(f"❌ ارسال نشد: {e}")
            user_modes.pop(ADMIN_ID, None)
            return

    # ------------------ USER FLOWS ------------------
    # if user sending youtube proof for manual verification
    if mode in ["awaiting_youtube_proof_for_contact", "awaiting_youtube_proof_for_buy"] and update.message.photo:
        # store proof and notify admin for manual check
        pending_youtube_proof[uid] = update.message.photo[-1].file_id
        await context.bot.send_photo(ADMIN_ID, update.message.photo[-1].file_id)
        await context.bot.send_message(ADMIN_ID, f"📌 اثبات یوتیوب برای کاربر: {uid}. برای تایید: /approve_user {uid}")
        user_modes.pop(uid, None)
        return await update.message.reply_text("✅ تصویر دریافت شد. پس از بررسی ادمین، دسترسی شما تایید خواهد شد.")

    # contact form
    if mode == "awaiting_contact" and text and '-' in text:
        name, phone = text.split('-', 1)
        await context.bot.send_message(ADMIN_ID, f"📩 درخواست ارتباط جدید
👤 نام: {name.strip()}
📞 شماره: {phone.strip()}
🆔 {uid}")
        user_modes.pop(uid, None)
        return await update.message.reply_text("✅ اطلاعات ثبت شد.")

    # receipts
    if mode in ["awaiting_wireguard_receipt", "awaiting_filimo_receipt"]:
        service = "وایرگارد" if mode == "awaiting_wireguard_receipt" else "فیلیمو"
        if not update.message.photo:
            return await update.message.reply_text("❌ لطفاً رسید را بصورت عکس ارسال کنید.")
        user = update.effective_user
        username = f"@{user.username}" if user.username else "—"
        await context.bot.send_message(ADMIN_ID, f"📥 رسید جدید برای {service}
👤 {user.first_name}
🆔 {uid}
🔗 {username}")
        await context.bot.send_photo(ADMIN_ID, update.message.photo[-1].file_id)
        user_modes.pop(uid, None)
        return await update.message.reply_text("✅ رسید شما ثبت شد.")

    # default main buttons
    if text == "📞 ارتباط با ما":
        return await contact_us(update, context)
    if text == "🛒 خرید کانفیگ وایرگارد":
        return await buy_wireguard(update, context)
    if text == "🎬 خرید اشتراک فیلیمو":
        return await buy_filimo(update, context)
    if text == "🌐 سایت ما":
        return await update.message.reply_text(f"🌐 {YOUTUBE_CHANNEL_URL}")
    if text == "/list_users":
        return await list_users(update, context)

    # fallback
    await update.message.reply_text("از منو استفاده کنید یا /start را بزنید.")

# ------------------ ADMIN COMMANDS ------------------
async def approve_user_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    args = context.args
    if not args:
        return await update.message.reply_text("Usage: /approve_user <user_id>")
    try:
        uid = int(args[0])
    except:
        return await update.message.reply_text("آیدی نامعتبر است.")
    if uid not in users:
        return await update.message.reply_text("کاربر وجود ندارد.")
    users[uid]['approved'] = True
    # notify user
    try:
        await context.bot.send_message(uid, "✅ اثبات یوتیوب شما تایید شد. اکنون می‌توانید اقدام کنید.")
    except:
        pass
    return await update.message.reply_text(f"کاربر {uid} تایید شد.")

async def unapprove_user_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    args = context.args
    if not args:
        return await update.message.reply_text("Usage: /unapprove_user <user_id>")
    try:
        uid = int(args[0])
    except:
        return await update.message.reply_text("آیدی نامعتبر است.")
    if uid not in users:
        return await update.message.reply_text("کاربر وجود ندارد.")
    users[uid]['approved'] = False
    try:
        await context.bot.send_message(uid, "⚠️ تایید یوتیوب شما لغو شد.")
    except:
        pass
    return await update.message.reply_text(f"کاربر {uid} غیرفعال شد.")

# ------------------ SETUP & RUN ------------------
def main():
    app = Application.builder().token(TOKEN).build()

    app.add_handler(CommandHandler('start', start))
    app.add_handler(MessageHandler(filters.ALL & (~filters.COMMAND), message_handler))

    # admin commands
    app.add_handler(CommandHandler('approve_user', approve_user_cmd))
    app.add_handler(CommandHandler('unapprove_user', unapprove_user_cmd))

    print('🤖 Bot Running...')
    app.run_polling()

if __name__ == '__main__':
    main()

# ------------------ NOTES ------------------
# 1) Telegram channel membership can be checked programmatically; make sure the bot is a member of the channel
#    and has permission to get chat members. Set TELEGRAM_CHANNEL to the channel username (with @) or channel id.
# 2) YouTube subscription cannot be verified via the Telegram bot API. We therefore request users to send proof
#    (screenshot) which the admin will manually review and then run /approve_user <user_id> to grant access.
# 3) This implementation uses in-memory dicts — restart will lose data. For production, use a database (sqlite/redis/postgres).
# 4) Buttons are grouped so that buy buttons are displayed side-by-side as requested.
