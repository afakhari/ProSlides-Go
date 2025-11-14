# Mock Data Documentation

این فایل شامل داده‌های Mock برای توسعه و تست پروژه است.

## ساختار داده‌ها

### `User_adding`

داده‌های لابی و کاربران متصل شده

```javascript
{
  type: 13,
  Users: [
    { user_id: number, name: string, character: string }
  ]
}
```

### `QuizSetup`

اطلاعات سوالات کوییز

```javascript
{
  type: 5,
  slides: [
    {
      slide_type: number,
      question_id: number,
      question_text: string,
      question_time: number (optional),
      max_point: number (optional),
      min_point: number (optional),
      options: [
        { option_id: any, option_text: string, answer: boolean }
      ]
    }
  ]
}
```

### `createNextPrevious(type, action, slideIndex)`

تابع ایجاد داده‌های ناوبری برای ارسال به سرور

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

## استفاده در کامپوننت‌ها

```javascript
import { User_adding, QuizSetup, createNextPrevious } from "../data/mockData";

// ایجاد داده ناوبری
const navData = createNextPrevious(5, "next", 0);
// TODO: ارسال به سرور
console.log("Data to send:", navData);
```

## نکات مهم

1. این داده‌ها فقط برای توسعه و تست هستند
2. در آینده باید از API واقعی دریافت شوند
3. داده‌های ناوبری باید به سرور ارسال شوند هنگام تغییر صفحه
4. شماره سوال از `QuizSetup.slides` محاسبه می‌شود
