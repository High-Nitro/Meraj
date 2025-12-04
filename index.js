import subprocess
import sys

# نصب خودکار کتابخانه
try:
    from telegram import Update
    from telegram.ext import Application, CommandHandler
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "python-telegram-bot"])
    from telegram import Update
    from telegram.ext import Application, CommandHandler

TOKEN = "7346348218:AAGU8aUR-07GtJUZxw6JQ2X2Os9Jm_ZhGYU"

async def start(update, context):
    await update.message.reply_text("سلام!")

app = Application.builder().token(TOKEN).build()
app.add_handler(CommandHandler("start", start))

print("بات اجرا شد...")
app.run_polling()
