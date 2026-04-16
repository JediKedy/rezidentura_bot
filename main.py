from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ContextTypes

async def open_webapp(update: Update, context: ContextTypes.DEFAULT_TYPE):
    url = "https://jedikedy.github.io/rezidentura_bot/"
    
    keyboard = [
        [InlineKeyboardButton("Testləri Başlat", web_app=WebAppInfo(url=url))]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.effective_chat.send_message(
        "Sualları həll etmək üçün aşağıdakı düyməyə klikləyin:",
        reply_markup=reply_markup
    )