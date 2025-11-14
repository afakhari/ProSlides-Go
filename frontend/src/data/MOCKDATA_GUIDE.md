# Mock Data - راهنمای کامل

این فایل شامل **تمام** داده‌های Mock استفاده شده در پروژه است که از فایل‌های مختلف pages و components جمع‌آوری شده‌اند.

---

## 📁 ساختار فایل mockData.js

فایل mockData به بخش‌های منطقی تقسیم شده است:

### 1️⃣ User and Players Data

### 2️⃣ Questions Data

### 3️⃣ Footer/UI Data

### 4️⃣ Game Configuration

### 5️⃣ Output/Response Types

---

## 📊 داده‌های کاربران و بازیکنان

### `User_adding`

داده‌های لابی و کاربران در حال اتصال

```javascript
{
  type: 13,
  Users: [
    { user_id: number, name: string, character: string }
  ]
}
```

**استفاده در:**

- `JoinPage2.jsx`

---

### `LeaderboardPlayers`

داده‌های بازیکنان برای صفحه Leaderboard اصلی

```javascript
[
  {
    user_id: number,
    name: string,
    character: string,
    color: string,
    rank: number,
    total_points: number,
    new_points: number,
  },
];
```

**استفاده در:**

- `LeaderBoard.jsx`

---

### `DefaultModalPlayers`

داده‌های پیش‌فرض برای Modal لیدربورد

```javascript
[
  {
    id: number,
    name: string,
    character: string,
    points: number,
    color: string,
  },
];
```

**استفاده در:**

- `LeaderboardModal.jsx`

---

## ❓ داده‌های سوالات

### `PickAnswerQuestion_EN`

سوال انتخاب گزینه به انگلیسی

```javascript
{
  type: 2,
  question_id: number,
  question_text: string,
  options: [
    { option_id: number, option_text: string }
  ],
  question_time: number,
  min_point: number,
  max_point: number
}
```

**استفاده در:**

- `pages/pickAnswerQuestion.jsx`
- `components/presentation/players/pickAnswerQuestion.jsx`

---

### `PickAnswerResult_EN`

نتیجه سوال انتخاب گزینه به انگلیسی

```javascript
{
  type: 3,
  question_id: number,
  optionsResult: [
    { option_id: number, answer: boolean }
  ]
}
```

---

### `PickAnswerQuestion_FA`

سوال انتخاب گزینه به فارسی

**استفاده در:**

- `components/presentation/players/pickAnswerQuestion.jsx`

---

### `PickAnswerResult_FA`

نتیجه سوال انتخاب گزینه به فارسی

---

### `QuizSetup`

اطلاعات کامل کوییز با چندین اسلاید

```javascript
{
  type: 5,
  slides: [
    {
      slide_type: number,
      question_id: number,
      question_text: string,
      question_time: number,
      max_point: number,
      min_point: number,
      options: [
        { option_id: any, option_text: string, answer: boolean }
      ]
    }
  ]
}
```

**استفاده در:**

- `JoinPage2.jsx`
- `manager_question.jsx`
- `LeaderBoard.jsx`

---

## 🎨 داده‌های UI و Footer

### `DefaultFooterStats`

آمار پیش‌فرض برای Footer

```javascript
{
  hearts: number,
  happy: number,
  star: number,
  thumbsUp: number,
  players: { current: number, max: number }
}
```

**استفاده در:**

- `Footer.jsx`
- `JoinPage2.jsx`
- `manager_question.jsx`
- `LeaderBoard.jsx`

---

### `DefaultChatMessages`

پیام‌های چت پیش‌فرض

```javascript
[{ user: string, message: string, avatar: string }];
```

**استفاده در:**

- `Footer.jsx`

---

### `FooterMenuItems`

آیتم‌های منوی Footer

```javascript
[{ icon: string, label: string, action: string }];
```

**استفاده در:**

- `Footer.jsx`

---

### `KeyboardShortcuts`

میانبرهای صفحه کلید

```javascript
[{ label: string, key: string }];
```

**استفاده در:**

- `Footer.jsx`

---

### `Reactions`

واکنش‌های موجود

```javascript
[{ icon: string, label: string, key: string }];
```

**استفاده در:**

- `Footer.jsx`

---

## ⚙️ پیکربندی بازی

### `DefaultGameCode`

کد بازی پیش‌فرض

```javascript
const DefaultGameCode = "ZH4NJ";
```

**استفاده در:**

- `JoinPage2.jsx`
- `manager_question.jsx`
- `LeaderBoard.jsx`

---

### `UserColorList`

لیست رنگ‌ها برای نام کاربران

```javascript
const UserColorList = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", ...
];
```

**استفاده در:**

- `JoinPage2.jsx`

---

## 📤 توابع ایجاد خروجی

### `createUserAnswer(questionId, selectedOptions, timeLeft)`

ایجاد فرمت پاسخ کاربر

```javascript
{
  type: 4,
  question_id: number,
  optins_selected: array,
  time_left: number
}
```

**استفاده در:**

- `pages/pickAnswerQuestion.jsx`
- `components/presentation/players/pickAnswerQuestion.jsx`

---

### `createNextPrevious(type, action, slideIndex)`

ایجاد داده‌های ناوبری برای ارسال به سرور

**پارامترها:**

- `type`: نوع عملیات (پیش‌فرض: 5)
- `action`: "next" | "previous" | "start" | null
- `slideIndex`: شماره اسلاید فعلی

**خروجی:**

```javascript
{
  type: number,
  action: string | null,
  slide_index: number | null
}
```

**استفاده در:**

- `JoinPage2.jsx`
- `manager_question.jsx`
- `LeaderBoard.jsx`

---

## 🔄 نحوه Import کردن

### Import همه چیز:

```javascript
import * as MockData from "../data/mockData";
```

### Import انتخابی:

```javascript
import {
  User_adding,
  QuizSetup,
  DefaultGameCode,
  createNextPrevious,
} from "../data/mockData";
```

---

## 📋 فایل‌های به‌روزرسانی شده

تمام فایل‌های زیر برای استفاده از `mockData.js` به‌روزرسانی شده‌اند:

### Pages:

✅ `JoinPage2.jsx`  
✅ `manager_question.jsx`  
✅ `LeaderBoard.jsx`  
✅ `pickAnswerQuestion.jsx`

### Components:

✅ `LeaderboardModal.jsx`  
✅ `Footer.jsx`  
✅ `presentation/players/pickAnswerQuestion.jsx`

---

## 💡 نکات مهم

1. **یک منبع واحد**: تمام JSON ها در یک فایل مرکزی
2. **قابل نگهداری**: تغییرات فقط در یک جا
3. **قابل استفاده مجدد**: توابع helper برای ایجاد داده‌ها
4. **سازماندهی شده**: دسته‌بندی منطقی داده‌ها
5. **آماده برای سرور**: فرمت‌های استاندارد برای ارسال/دریافت

---

## 🚀 استفاده در آینده

هنگام اتصال به سرور واقعی:

1. داده‌های دریافتی را به همین فرمت تبدیل کنید
2. از توابع helper موجود استفاده کنید
3. فقط import ها را تغییر دهید (از mockData به API)

---

## 📝 مثال استفاده کامل

```javascript
// در یک صفحه
import {
  QuizSetup,
  createNextPrevious,
  DefaultGameCode,
  UserColorList,
  DefaultFooterStats,
} from "../data/mockData";

function MyPage() {
  const gameCode = DefaultGameCode;
  const colors = UserColorList;
  const currentQuestion = QuizSetup.slides[0];

  const handleNext = () => {
    const navData = createNextPrevious(5, "next", 0);
    console.log(navData);
    // TODO: Send to server
  };

  return <Footer stats={DefaultFooterStats} />;
}
```

---

**نسخه:** 2.0  
**آخرین به‌روزرسانی:** تمام JSON ها از فایل‌های پراکنده به mockData منتقل شدند
