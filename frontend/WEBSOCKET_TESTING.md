# 🧪 راهنمای تست WebSocket

## 📝 چک‌لیست تست

### ✅ 1. تست JoinPage

- [ ] باز کردن صفحه Join
- [ ] مشاهده وضعیت "Connected" در گوشه بالا
- [ ] باز کردن Console و مشاهده log:
  ```
  🔌 Connecting to: ws://present.proslides.ir/ws/room1/manager
  ✅ WebSocket Connected as manager
  ```
- [ ] در صورت اضافه شدن بازیکن جدید، مشاهده پیام Type 7
- [ ] کلیک روی دکمه Start و مشاهده ارسال پیام:
  ```
  📤 Sent: {"type":9,"action":"next"}
  ```

### ✅ 2. تست PickAnswerQuestion

- [ ] مشاهده تایمر شروع شدن
- [ ] پس از پایان تایمر یا دریافت Type 8، نمایش نتایج
- [ ] بررسی Console برای پیام:
  ```
  📩 Received: {"type":8,"submit":[...]}
  [PickAnswerQuestion] Question results: [...]
  ```
- [ ] مشاهده به‌روزرسانی نمودار با داده‌های واقعی
- [ ] کلیک روی Next/Previous و ارسال دستور

### ✅ 3. تست LeaderBoard

- [ ] مشاهده لیست بازیکنان مرتب شده
- [ ] انیمیشن بارها (از امتیاز قبلی به امتیاز جدید)
- [ ] دریافت به‌روزرسانی لیدربورد از سرور
- [ ] بررسی Console:
  ```
  📩 Received: {"type":7,"users":[...]}
  [LeaderBoard] Leaderboard updated: [...]
  ```
- [ ] کلیک روی Next/Previous

### ✅ 4. تست Auto-Reconnect

- [ ] قطع کردن اتصال سرور
- [ ] مشاهده تغییر وضعیت به "Disconnected"
- [ ] روشن کردن سرور
- [ ] مشاهده پیام "🔄 Attempting to reconnect..."
- [ ] وضعیت به "Connected" تغییر کند

## 🔍 Debugging

### نمایش Console Logs

در Developer Tools (F12) → Console:

```javascript
// Enable verbose logging
localStorage.setItem("debug", "ws:*");

// Disable logging
localStorage.removeItem("debug");
```

### بررسی WebSocket در Network Tab

1. باز کردن Developer Tools (F12)
2. رفتن به تب **Network**
3. فیلتر کردن روی **WS** (WebSocket)
4. کلیک روی اتصال WebSocket
5. مشاهده پیام‌های ارسالی/دریافتی در **Messages**

### تست با manager.html

برای تست سریع بدون React:

1. باز کردن `backend/srvs/facade/static/manager.html`
2. وارد کردن Session ID
3. کلیک روی Connect
4. تست دکمه‌های Next/Previous

## 📊 پیام‌های مورد انتظار

### Manager → Server

```json
// Navigation
{ "type": 9, "action": "next" }
{ "type": 9, "action": "previous" }
```

### Server → Manager

```json
// Type 7: Player List
{
  "type": 7,
  "users": [
    {"user_id": 1, "name": "Ali", "character": "👑"},
    ...
  ]
}

// Type 2: New Question
{
  "type": 2,
  "question_id": 56,
  "question_text": "What is the capital of France?",
  "options": [...],
  "question_time": 40
}

// Type 8: Question Results (ACTUAL FORMAT)
{
  "type": 8,
  "question_id": 45,
  "options": [
    {"option_id": 72, "number_of_submits": 10},
    {"option_id": 73, "number_of_submits": 5},
    {"option_id": 74, "number_of_submits": 15},
    {"option_id": 75, "number_of_submits": 3}
  ]
}

// Type 1: Leaderboard Results (ACTUAL FORMAT)
{
  "type": 1,
  "results": [
    {
      "user_id": "uuid-string",
      "name": "Ali",
      "character": "❤️",
      "rank": 1,
      "total_points": 83.97,
      "new_points": 83.97
    }
  ]
}
```

## ⚠️ مشکلات رایج

### 1. اتصال برقرار نمی‌شود

```
❌ WebSocket Error
```

**راه حل:**

- بررسی آدرس سرور در `WebSocketContext.jsx`
- اطمینان از روشن بودن سرور
- بررسی CORS و firewall

### 2. پیام‌ها دریافت نمی‌شوند

```
Connected اما پیامی نمی‌آید
```

**راه حل:**

- بررسی Console برای خطاها
- تست با `manager.html` برای مطمئن شدن از سرور
- بررسی `lastMessage` در React DevTools

### 3. Auto-reconnect کار نمی‌کند

**راه حل:**

- بررسی `ws.onclose` در Context
- اطمینان از وجود `sessionId`
- Clear کردن cache و reload

### 4. نمودار به‌روز نمی‌شود

**راه حل:**

- بررسی `option_id` ها مطابقت دارند
- Console.log کردن `lastMessage` در `PickAnswerQuestion`
- بررسی state `votes`

## 🎯 مراحل تست کامل

### Scenario 1: شروع جلسه جدید

1. ✅ Manager: باز کردن JoinPage
2. ✅ Player: اتصال چند بازیکن
3. ✅ Manager: مشاهده لیست بازیکنان در JoinPage
4. ✅ Manager: کلیک Start
5. ✅ همه: انتقال به صفحه سوال
6. ✅ Players: پاسخ دادن به سوال
7. ✅ Manager: مشاهده نتایج در نمودار
8. ✅ Manager: کلیک Next
9. ✅ همه: انتقال به Leaderboard
10. ✅ مشاهده امتیازات و رنک‌ها

### Scenario 2: قطع و وصل شدن

1. ✅ قطع کردن اینترنت
2. ✅ مشاهده "Disconnected"
3. ✅ وصل کردن اینترنت
4. ✅ مشاهده "Connected" بعد از 3 ثانیه
5. ✅ ادامه کار عادی

## 📞 نکات مهم

- ⏱️ Timeout پیش‌فرض reconnect: **3 ثانیه**
- 🔄 تعداد تلاش‌های reconnect: **نامحدود**
- 📦 حداکثر سایز پیام: بستگی به سرور دارد
- 🌐 پروتکل: **WebSocket (ws:// یا wss://)**

## 🚀 آماده برای Production

قبل از deploy:

- [ ] تغییر آدرس به `wss://` (SSL)
- [ ] بررسی error handling
- [ ] تست با اتصال آهسته
- [ ] تست با تعداد زیاد بازیکن
- [ ] بررسی performance
- [ ] تست cross-browser
- [ ] تست mobile

## 📚 مراجع اضافی

- [WebSocket Testing Tools](https://www.piesocket.com/websocket-tester)
- [Chrome DevTools - Network Tab](https://developer.chrome.com/docs/devtools/network/)
- [React DevTools](https://react.dev/learn/react-developer-tools)
