from fastapi import APIRouter, Request, Header
from linebot import LineBotApi, WebhookParser
from linebot.models import MessageEvent, TextMessage, TextSendMessage
from configparser import ConfigParser

router = APIRouter()

# 統一讀取 config.ini
config = ConfigParser()
config.read('./app/config/config.ini')
CHANNEL_SECRET = config.get('LINE', 'channel_secret')
CHANNEL_ACCESS_TOKEN = config.get('LINE', 'channel_access_token')

line_bot_api = LineBotApi(CHANNEL_ACCESS_TOKEN)
parser = WebhookParser(CHANNEL_SECRET)

@router.post("/callback")
async def callback(request: Request, x_line_signature: str = Header(None)):
    body = await request.body()
    events = parser.parse(body.decode('utf-8'), x_line_signature)
    for event in events:
        if isinstance(event, MessageEvent) and isinstance(event.message, TextMessage):
            line_bot_api.reply_message(
                event.reply_token,
                TextSendMessage(text="您好，這是用藥管理及藥物警戒系統。請使用下方圖文選單操作。")
            )
    return "OK"
