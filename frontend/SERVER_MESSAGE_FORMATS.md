# 🔄 فرمت‌های واقعی پیام‌های سرور

این فایل فرمت‌های **واقعی** که از سرور دریافت می‌شود را نشان می‌دهد.

---

## 📥 دریافتی از سرور

### Type 8: نتایج سوال

```json
{
  "type": 8,
  "question_id": 45,
  "options": [
    {
      "option_id": 58,
      "number_of_submits": 0
    },
    {
      "option_id": 59,
      "number_of_submits": 1
    }
  ]
}
```

**نکات مهم:**

- ✅ فیلد `options` (نه `submit`)
- ✅ فیلد `number_of_submits` (نه `number_of_submit`)
- ✅ شامل `question_id`

---

### Type 1: نتایج لیدربورد

```json
{
  "type": 1,
  "results": [
    {
      "user_id": "8b6e39ab-4c6d-4255-a90a-41cb7ce7171b",
      "name": "Ali",
      "character": "❤️",
      "rank": 1,
      "total_points": 83.97112369537354,
      "new_points": 83.97112369537354
    },
    {
      "user_id": "957d350e-bc07-47c2-a997-d09256e91f9a",
      "name": "Sima",
      "character": "❤️",
      "rank": 2,
      "total_points": 0,
      "new_points": 0
    }
  ]
}
```

**نکات مهم:**

- ✅ فیلد `results` (نه `leaderboard`)
- ✅ `user_id` به صورت UUID string
- ✅ امتیازات به صورت float
- ✅ شامل `rank`, `total_points`, `new_points`

---

### Type 7: لیست بازیکنان (فرضی - هنوز تست نشده)

```json
{
  "type": 7,
  "users": [
    {
      "user_id": "uuid-string",
      "name": "Ali",
      "character": "❤️"
    }
  ]
}
```

---

## 📤 ارسالی به سرور

### Type 9: دستور ناوبری

```json
{
  "type": 9,
  "action": "next"
}
```

یا

```json
{
  "type": 9,
  "action": "previous"
}
```

**نکات:**

- ✅ `action` باید `"next"` یا `"previous"` باشد
- ✅ بدون فیلدهای اضافی

---

## 🔄 تفاوت با Mock Data

### Mock Data (قدیمی)

```javascript
// ❌ فرمت قدیمی
{
  type: 8,
  submit: [
    { option_id: 62, number_of_submit: 10 }
  ]
}
```

### Server Format (واقعی)

```javascript
// ✅ فرمت واقعی
{
  type: 8,
  question_id: 45,
  options: [
    { option_id: 58, number_of_submits: 0 }
  ]
}
```

---

## 📝 چک‌لیست سازگاری

- ✅ **PickAnswerQuestion**: به‌روزرسانی شده برای Type 8
  - ✅ چک کردن `options` یا `submit`
  - ✅ چک کردن `number_of_submits` یا `number_of_submit`
- ✅ **LeaderBoard**: به‌روزرسانی شده برای Type 1

  - ✅ چک کردن `results`
  - ✅ پشتیبانی از UUID string برای `user_id`
  - ✅ پشتیبانی از float برای امتیازات

- ✅ **mockData.js**: به‌روزرسانی شده
  - ✅ `QuestionResult` با فرمت جدید
  - ✅ `LeaderboardResult` اضافه شده

---

## 🧪 تست

برای تست فرمت‌ها:

```javascript
// در Console
console.log("Received:", lastMessage);

// بررسی ساختار
if (lastMessage.type === 8) {
  console.log("Options:", lastMessage.options);
  console.log("First option:", lastMessage.options?.[0]);
}

if (lastMessage.type === 1) {
  console.log("Results:", lastMessage.results);
  console.log("First player:", lastMessage.results?.[0]);
}
```

---

## 📌 نکات مهم

1. **همیشه** از optional chaining استفاده کنید: `lastMessage.options?.[0]`
2. **همیشه** هر دو فرمت را چک کنید برای backward compatibility
3. **UUID strings** را به عنوان string نگه دارید (تبدیل به number نکنید)
4. **Float numbers** ممکن است اعداد طولانی باشند - برای نمایش round کنید

---

## 🔄 آپدیت: {تاریخ}

این سند بر اساس پیام‌های واقعی دریافت شده از سرور به‌روزرسانی می‌شود.

آخرین آپدیت: November 10, 2025
