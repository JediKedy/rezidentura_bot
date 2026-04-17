from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    url = "https://jedikedy.github.io/rezidentura_bot/"

    keyboard = [
        [InlineKeyboardButton("Testləri Başlat 🚀", web_app=WebAppInfo(url=url))]
    ]

    await update.message.reply_text(
        "Quiz app-ə başlamaq üçün aşağıdakı düyməyə bas 👇",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

app = ApplicationBuilder().token("BOT_TOKEN").build()
app.add_handler(CommandHandler("start", start))

app.run_polling()