import subprocess
import sys

# نصب خودکار بسته‌ها در صورت نبود
def install(package):
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
    except Exception as e:
        print(f"❌ خطا در نصب پکیج {package}: {e}")
        exit()

# تلاش برای import پکیج — اگر نبود، نصب می‌شود
try:
    from telegram import Update, ReplyKeyboardMarkup, KeyboardButton
    from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
except ModuleNotFoundError:
    print("📦 پکیج python-telegram-bot نصب نیست! در حال نصب...")
    install("python-telegram-bot")
    print("✅ نصب شد! اجرای دوباره...")
    from telegram import Update, ReplyKeyboardMarkup, KeyboardButton
    from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

import logging
import re

# تنظیمات
TOKEN = "7346348218:AAGU8aUR-07GtJUZxw6JQ2X2Os9Jm_ZhGYU"
ADMIN_ID = 6823146420  # آیدی عددی شما

# لاگ‌گیری
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

# دیتابیس ساده برای ذخیره اطلاعات کاربران
user_data = {}

# تابع /start
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user

    keyboard = [
        ["📞 ارتباط با ما"],
        ["🛒 خرید کانفیگ وایرگارد"],
        ["🌐 سایت ما"],
        ["🎬 خرید اشتراک فیلیمو"]
    ]
    reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)

    welcome_text = (
        f"👋 سلام {user.first_name}!\n"
        f"به فروشگاه اینترنتی ما خوش آمدید\n\n"
        "لطفاً یکی از گزینه‌های زیر را انتخاب کنید:"
    )

    await update.message.reply_text(welcome_text, reply_markup=reply_markup)

# تابع ارتباط با ما
async def contact_us(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    user_data[user_id] = {"mode": "awaiting_contact"}

    text = (
        "📞 **ارتباط با ما**\n\n"
        "لطفاً اطلاعات را در فرمت زیر ارسال کنید:\n"
        "`نام و نام خانوادگی - شماره تلفن`\n\n"
        "مثال:\n"
        "`علی محمدی - 09123456789`"
    )

    await update.message.reply_text(text)

# خرید وایرگارد
async def buy_wireguard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    user_data[user_id] = {"mode": "awaiting_wireguard_payment"}

    text = (
        "🛒 **خرید کانفیگ وایرگارد**\n\n"
        "مدت: 1 ماه\n"
        "حجم: 37 گیگ\n"
        "قیمت: 120,000 تومان\n\n"
        "💳 شماره کارت:\n"
        "`6219861829007888`\n\n"
        "📸 رسید را ارسال کنید."
    )

    await update.message.reply_text(text)

# سایت
async def our_website(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("🌐 سایت ما:\nhttps://speednethavij.ir")

# خرید فیلیمو
async def buy_filimo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    user_data[user_id] = {"mode": "awaiting_filimo_payment"}

    text = (
        "🎬 **خرید اشتراک فیلیمو**\n"
        "قیمت: 300,000 تومان\n\n"
        "💳 شماره کارت:\n"
        "`6219861829007888`\n\n"
        "📸 رسید را ارسال کنید."
    )

    await update.message.reply_text(text)

# پردازش پیام‌ها
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    message_text = update.message.text
    user_mode = user_data.get(user_id, {}).get("mode")

    # اطلاعات تماس
    if user_mode == "awaiting_contact":
        if "-" in message_text:
            try:
                name, phone = message_text.split("-", 1)
                name = name.strip()
                phone = phone.strip()

                if not re.match(r"^09\d{9}$", phone):
                    raise ValueError

                info = (
                    f"📩 درخواست ارتباط جدید\n\n"
                    f"👤 نام: {name}\n"
                    f"📞 شماره: {phone}\n"
                    f"🆔 یوزر: @{update.effective_user.username}"
                )

                await context.bot.send_message(ADMIN_ID, info)
                await update.message.reply_text("✅ اطلاعات ثبت شد.")
                await start(update, context)

            except:
                await update.message.reply_text("❌ فرمت اطلاعات صحیح نیست.")

        else:
            await update.message.reply_text("❌ فرمت اشتباه است.")

        user_data.pop(user_id, None)

    # رسیدها — همراه با ارسال آیدی عددی و یوزرنیم
    elif user_mode in ["awaiting_wireguard_payment", "awaiting_filimo_payment"]:
        if update.message.photo:

            service = "وایرگارد" if user_mode == "awaiting_wireguard_payment" else "فیلیمو"

            user = update.effective_user
            username = f"@{user.username}" if user.username else "❌ بدون یوزرنیم"

            await context.bot.send_message(
                ADMIN_ID,
                f"📥 رسید جدید برای {service}\n"
                f"👤 نام: {user.first_name}\n"
                f"🆔 آیدی عددی: {user.id}\n"
                f"🔗 یوزرنیم: {username}"
            )

            await context.bot.send_photo(ADMIN_ID, update.message.photo[-1].file_id)

            await update.message.reply_text("✅ رسید دریافت شد.")
            await start(update, context)
            user_data.pop(user_id, None)

        else:
            await update.message.reply_text("❌ لطفاً عکس رسید ارسال کنید.")

    # دکمه‌ها
    elif message_text == "📞 ارتباط با ما":
        await contact_us(update, context)

    elif message_text == "🛒 خرید کانفیگ وایرگارد":
        await buy_wireguard(update, context)

    elif message_text == "🌐 سایت ما":
        await our_website(update, context)

    elif message_text == "🎬 خرید اشتراک فیلیمو":
        await buy_filimo(update, context)

    else:
        await update.message.reply_text("از منو استفاده کنید. /start")

# اجرای اصلی
def main():
    application = Application.builder().token(TOKEN).build()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    application.add_handler(MessageHandler(filters.PHOTO, handle_message))

    print("🤖 ربات فعال شد.")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
