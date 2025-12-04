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
    """ارسال منو اصلی هنگام استارت"""
    user = update.effective_user
    
    # ایجاد منو اصلی
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

# تابع برای بخش ارتباط با ما
async def contact_us(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """بخش ارتباط با ما"""
    user_id = update.effective_user.id
    
    # ذخیره اینکه کاربر در حالت ثبت اطلاعات است
    user_data[user_id] = {"mode": "awaiting_contact"}
    
    text = (
        "📞 **ارتباط با ما**\n\n"
        "برای ارتباط با پشتیبانی، لطفاً اطلاعات زیر را ارسال کنید:\n\n"
        "1. 📱 شماره تلفن\n"
        "2. 👤 نام و نام خانوادگی\n\n"
        "⚠️ **توجه:** اطلاعات را به صورت زیر ارسال کنید:\n"
        "`نام و نام خانوادگی - شماره تلفن`\n\n"
        "مثال:\n"
        "`علی محمدی - 09123456789`"
    )
    
    await update.message.reply_text(text)

# تابع برای خرید کانفیگ وایرگارد
async def buy_wireguard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """بخش خرید کانفیگ وایرگارد"""
    user_id = update.effective_user.id
    
    text = (
        "🛒 **خرید کانفیگ وایرگارد**\n\n"
        "📦 **پلن موجود:**\n"
        "• مدت: 1 ماه\n"
        "• حجم: 37 گیگابایت\n"
        "• قیمت: 120,000 تومان\n\n"
        "💳 **روش پرداخت:**\n"
        "لطفاً مبلغ 120,000 تومان به شماره کارت زیر واریز کنید:\n"
        "`6037-****-****-****`\n\n"
        "📸 **پس از واریز:**\n"
        "عکس رسید پرداخت را برای همین بات ارسال کنید.\n\n"
        "✅ **تایید پرداخت:**\n"
        "پس از تایید پرداخت، کانفیگ برای شما ارسال خواهد شد."
    )
    
    # ذخیره حالت کاربر برای دریافت رسید پرداخت
    user_data[user_id] = {"mode": "awaiting_wireguard_payment"}
    
    await update.message.reply_text(text)

# تابع برای سایت ما
async def our_website(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """نمایش لینک سایت"""
    text = (
        "🌐 **سایت ما**\n\n"
        "برای مشاهده و خرید از سایت ما، روی لینک زیر کلیک کنید:\n\n"
        "🔗 https://speednethavij.ir\n\n"
        "📱 همچنین می‌توانید مستقیماً در مرورگر خود آدرس زیر را وارد کنید:\n"
        "`speednethavij.ir`"
    )
    
    await update.message.reply_text(text)

# تابع برای خرید اشتراک فیلیمو
async def buy_filimo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """بخش خرید اشتراک فیلیمو"""
    user_id = update.effective_user.id
    
    text = (
        "🎬 **خرید اشتراک فیلیمو**\n\n"
        "📦 **پلن موجود:**\n"
        "• نوع: اشتراک دائمی\n"
        "• قیمت: 300,000 تومان\n\n"
        "💳 **روش پرداخت:**\n"
        "لطفاً مبلغ 300,000 تومان به شماره کارت زیر واریز کنید:\n"
        "`6037-****-****-****`\n\n"
        "📸 **پس از واریز:**\n"
        "عکس رسید پرداخت را برای همین بات ارسال کنید.\n\n"
        "✅ **تایید پرداخت:**\n"
        "پس از تایید پرداخت، لینک دانلود اپلیکیشن و دسترسی‌ها برای شما ارسال خواهد شد."
    )
    
    # ذخیره حالت کاربر برای دریافت رسید پرداخت
    user_data[user_id] = {"mode": "awaiting_filimo_payment"}
    
    await update.message.reply_text(text)

# تابع برای پردازش پیام‌های متنی
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """پردازش پیام‌های دریافتی"""
    user_id = update.effective_user.id
    message_text = update.message.text
    user_mode = user_data.get(user_id, {}).get("mode")
    
    # پردازش بر اساس حالت کاربر
    if user_mode == "awaiting_contact":
        # بررسی فرمت اطلاعات تماس
        if "-" in message_text:
            name_part, phone_part = message_text.split("-", 1)
            name = name_part.strip()
            phone = phone_part.strip()
            
            # اعتبارسنجی شماره تلفن
            if re.match(r'^09\d{9}$', phone.replace(" ", "")):
                # ارسال اطلاعات به ادمین
                contact_info = (
                    f"📩 **درخواست ارتباط جدید**\n\n"
                    f"👤 کاربر: {update.effective_user.full_name}\n"
                    f"🆔 آیدی: @{update.effective_user.username or 'بدون نام کاربری'}\n"
                    f"📞 شماره: {phone}\n"
                    f"📋 نام: {name}\n"
                    f"⏰ زمان: {update.message.date}"
                )
                
                try:
                    # ارسال به ادمین
                    await context.bot.send_message(
                        chat_id=ADMIN_ID,
                        text=contact_info
                    )
                    
                    # پاسخ به کاربر
                    await update.message.reply_text(
                        "✅ اطلاعات شما با موفقیت ثبت شد.\n"
                        "به زودی با شما تماس خواهیم گرفت."
                    )
                    
                    # بازگشت به منو اصلی
                    await start(update, context)
                    
                except Exception as e:
                    logger.error(f"Error sending to admin: {e}")
                    await update.message.reply_text("❌ خطا در ارسال اطلاعات. لطفاً دوباره تلاش کنید.")
            else:
                await update.message.reply_text(
                    "❌ شماره تلفن نامعتبر است.\n"
                    "لطفاً شماره را به فرمت صحیح وارد کنید:\n"
                    "`09123456789`"
                )
        else:
            await update.message.reply_text(
                "❌ فرمت اطلاعات صحیح نیست.\n"
                "لطفاً به فرمت زیر ارسال کنید:\n"
                "`نام و نام خانوادگی - شماره تلفن`"
            )
        
        # حذف حالت کاربر
        if user_id in user_data:
            del user_data[user_id]
    
    elif user_mode in ["awaiting_wireguard_payment", "awaiting_filimo_payment"]:
        # اگر کاربر عکس ارسال کرده (برای رسید پرداخت)
        if update.message.photo:
            service = "کانفیگ وایرگارد" if user_mode == "awaiting_wireguard_payment" else "اشتراک فیلیمو"
            price = "120,000" if user_mode == "awaiting_wireguard_payment" else "300,000"
            
            # ارسال رسید به ادمین
            receipt_info = (
                f"💰 **رسید پرداخت جدید**\n\n"
                f"🛍️ سرویس: {service}\n"
                f"💵 مبلغ: {price} تومان\n"
                f"👤 کاربر: {update.effective_user.full_name}\n"
                f"🆔 آیدی: @{update.effective_user.username or 'بدون نام کاربری'}\n"
                f"🆔 عددی: {user_id}"
            )
            
            try:
                # ارسال متن به ادمین
                await context.bot.send_message(
                    chat_id=ADMIN_ID,
                    text=receipt_info
                )
                
                # ارسال عکس به ادمین
                photo_file = await update.message.photo[-1].get_file()
                await photo_file.download_to_drive(f"receipt_{user_id}.jpg")
                
                await context.bot.send_photo(
                    chat_id=ADMIN_ID,
                    photo=update.message.photo[-1].file_id,
                    caption=f"رسید پرداخت برای {service}"
                )
                
                # پاسخ به کاربر
                await update.message.reply_text(
                    f"✅ رسید پرداخت برای {service} دریافت شد.\n"
                    f"پس از تایید، {service} برای شما ارسال خواهد شد."
                )
                
                # بازگشت به منو اصلی
                await start(update, context)
                
            except Exception as e:
                logger.error(f"Error processing receipt: {e}")
                await update.message.reply_text("❌ خطا در ارسال رسید. لطفاً دوباره تلاش کنید.")
            
            # حذف حالت کاربر
            if user_id in user_data:
                del user_data[user_id]
        
        elif message_text == "بازگشت به منو":
            await start(update, context)
            if user_id in user_data:
                del user_data[user_id]
    
    # پردازش دکمه‌های منو
    elif message_text == "📞 ارتباط با ما":
        await contact_us(update, context)
    
    elif message_text == "🛒 خرید کانفیگ وایرگارد":
        await buy_wireguard(update, context)
    
    elif message_text == "🌐 سایت ما":
        await our_website(update, context)
    
    elif message_text == "🎬 خرید اشتراک فیلیمو":
        await buy_filimo(update, context)
    
    else:
        # اگر پیام نامربوط بود
        await update.message.reply_text(
            "لطفاً از دکمه‌های منو استفاده کنید.\n"
            "برای بازگشت به منو اصلی، /start را ارسال کنید."
        )

# تابع main
def main():
    """شروع بات"""
    # ایجاد برنامه
    application = Application.builder().token(TOKEN).build()
    
    # ثبت هندلرها
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    application.add_handler(MessageHandler(filters.PHOTO, handle_message))
    
    # شروع بات
    print("🤖 بات در حال اجرا است...")
    print(f"🔗 آدرس بات: https://t.me/{application.bot.username}")
    print("📱 برای استفاده، در تلگرام بات را پیدا کرده و /start را بزنید")
    
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
