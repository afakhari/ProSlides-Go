# سیستم ردیابی ناوبری (Navigation Tracking System)

## خلاصه تغییرات

تمام صفحات اصلی پروژه به سیستم ردیابی ناوبری مجهز شده‌اند که عملیات‌های کاربر را در کنسول ثبت می‌کنند و آماده ارسال به سرور هستند.

## صفحات به‌روزرسانی شده

### 1. JoinPage2.jsx ✅

- **وضعیت**: به‌روزرسانی شده
- **قابلیت‌ها**:
  - تشخیص شماره سوال از `QuizSetup`
  - لاگ کردن عملیات `next`, `previous`, `start`
  - نمایش شماره سوال در عنوان: `Quiz question X of Y`

### 2. manager_question.jsx (PollPage) ✅

- **وضعیت**: به‌روزرسانی شده
- **قابلیت‌ها**:
  - تشخیص شماره سوال از `QuizSetup`
  - لاگ کردن عملیات `next`, `previous`
  - نمایش شماره سوال در عنوان: `Quiz Question X of Y`

### 3. LeaderBoard.jsx ✅

- **وضعیت**: به‌روزرسانی شده
- **قابلیت‌ها**:
  - تشخیص شماره سوال از `QuizSetup`
  - لاگ کردن عملیات `next`, `previous`
  - نمایش شماره سوال در عنوان: `Leaderboard - Question X of Y`

## ساختار داده ناوبری

```javascript
{
  type: 5,
  action: "next" | "previous" | "start",
  slide_index: number  // شماره سوال فعلی (0-indexed)
}
```

## نحوه کار

### فلوی ناوبری در App.jsx

```
JoinPage2 → (Start) → PollPage → (Next) → LeaderBoard → (Next) → JoinPage2
```

### Console Logs

هر صفحه با یک prefix مشخص لاگ می‌کند:

- `[JoinPage2]`: عملیات در صفحه Join
- `[PollPage]`: عملیات در صفحه سوال
- `[LeaderBoard]`: عملیات در صفحه Leaderboard

### مثال Console Output

```javascript
// در JoinPage2 - کلیک روی دکمه Start:
[JoinPage2] Starting quiz, navigation data to send to server:
{
  type: 5,
  action: "start",
  slide_index: 0
}

// در PollPage - کلیک روی دکمه Next:
[PollPage] Navigation data to send to server:
{
  type: 5,
  action: "next",
  slide_index: 0
}

// در LeaderBoard - کلیک روی دکمه Next:
[LeaderBoard] Navigation data to send to server:
{
  type: 5,
  action: "next",
  slide_index: 0
}
```

## محاسبه شماره سوال

در تمام صفحات، شماره سوال به صورت زیر محاسبه می‌شود:

```javascript
const currentQuestionIndex = Math.floor(currentSlide / 2);
const questionNumber = currentQuestionIndex + 1; // برای نمایش به کاربر (1-indexed)
const totalQuestions = QuizSetup.slides.length;
```

## TODO: اتصال به سرور

در تمام توابع `handleNext` و `handlePrevious`، یک TODO برای ارسال داده به سرور قرار داده شده:

```javascript
// TODO: Send newNavigationData to server when connected
```

برای اتصال به سرور:

1. API endpoint مناسب را ایجاد کنید
2. داده `newNavigationData` را با استفاده از fetch یا axios ارسال کنید
3. مدیریت خطا و response را پیاده‌سازی کنید

### مثال ارسال به سرور:

```javascript
const handleNext = async () => {
  const newNavigationData = createNextPrevious(5, "next", currentQuestionIndex);
  setNavigationData(newNavigationData);
  console.log(
    "[PageName] Navigation data to send to server:",
    newNavigationData
  );

  try {
    const response = await fetch("/api/navigation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newNavigationData),
    });

    if (!response.ok) {
      console.error("Failed to send navigation data");
    }
  } catch (error) {
    console.error("Error sending navigation data:", error);
  }

  if (onNext) onNext();
};
```

## فایل‌های مرتبط

- `/frontend/src/data/mockData.js`: تعریف `QuizSetup` و `createNextPrevious()`
- `/frontend/src/data/README.md`: مستندات کامل mockData
- `/frontend/src/App.jsx`: مدیریت state و navigation اصلی
- `/frontend/src/pages/JoinPage2.jsx`: صفحه Join
- `/frontend/src/pages/manager_question.jsx`: صفحه سوال
- `/frontend/src/pages/LeaderBoard.jsx`: صفحه Leaderboard

## تست کردن

1. پروژه را اجرا کنید: `npm run dev`
2. Developer Console مرورگر را باز کنید (F12)
3. بین صفحات navigate کنید
4. باید لاگ‌های مربوط به هر عملیات را مشاهده کنید

## نکات مهم

✅ شماره سوال به صورت خودکار از `QuizSetup` محاسبه می‌شود  
✅ تمام عملیات navigation در console ثبت می‌شوند  
✅ داده‌ها با فرمت استاندارد آماده ارسال به سرور هستند  
✅ هر صفحه با prefix مشخص لاگ می‌کند برای دیباگ آسان‌تر  
✅ سیستم قابل گسترش برای افزودن action های جدید است
