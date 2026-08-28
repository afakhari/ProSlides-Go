# آرشیو ساختار Mock قدیمی

> **Deprecated — audited 2026-08-28:** examples below are a historical inventory
> only. They are not current architecture, not an API contract, and must not be
> copied into production code. Numeric WebSocket messages are retired. The Go
> OpenAPI contract, `src/live`, `src/services/quizService.ts`, and module-owned
> canonical types are authoritative. Existing production imports are tracked
> for removal in frontend Phase F4; do not add another import from `mockData`.

این فایل صرفاً برای فهم و حذف تدریجی مدل‌های سازگاری قدیمی نگهداری می‌شود.
راهنمای معماری جاری در `docs/frontend-architecture.md` و تصمیم آن در ADR 0003
قرار دارد. هر مثال `TODO: Send to server` در ادامه منسوخ است؛ فرمان واقعی باید
از adapter تایپ‌شده HTTP استفاده کند و وضعیت live از snapshot/SSE بازیابی شود.

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

## وضعیت فعلی و روش حذف

- نام فایل‌ها و importهای تاریخی بالا ممکن است دیگر در repository وجود نداشته
  باشند؛ برای یافتن مصرف‌کننده واقعی از جست‌وجوی source استفاده کنید.
- هیچ داده API را به این قالب‌ها تبدیل نکنید. DTO واقعی در مرز typed ماژول به
  مدل canonical همان دامنه تبدیل می‌شود.
- fixture تست باید کنار تست مصرف‌کننده قرار گیرد و فقط همان مدل canonical را
  بسازد.
- حذف هر import production باید همراه تست pending/success/error و در live همراه
  تست ترتیب رویداد، retry ID و non-disclosure باشد.
- پس از حذف آخرین مصرف‌کننده production و انتقال fixtureهای لازم، این فایل و
  `mockData.js` حذف می‌شوند.

**وضعیت سند:** آرشیوی؛ آخرین ممیزی 2026-08-28.
