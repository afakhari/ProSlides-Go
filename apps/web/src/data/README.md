# Legacy mock-data inventory

> **Archived compatibility reference (audited 2026-08-28):** the structures
> below document legacy fixtures; they are not an integration guide or current
> backend contract. Numeric `type` messages belong to the removed Django/Rust
> WebSocket view model. New production code must use the OpenAPI contract,
> `src/live`, `src/services/quizService.ts`, and `src/utils/apiFetch.ts`.
>
> Some current production components still import this directory. That is a
> known F4 migration gap, not an approved pattern. Migrated modules must replace
> these compatibility models with canonical typed module models; do not add new
> imports. See `docs/frontend-architecture.md` and ADR 0003.

مطالب زیر فقط شکل تاریخی fixtureها را برای تست‌های قدیمی توضیح می‌دهند. برای
پیاده‌سازی جدید از آن‌ها استفاده نکنید و هیچ پیام عددی را به API ارسال نکنید.

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

## نمونه تاریخی — برای کپی‌کردن نیست

```javascript
import { User_adding, QuizSetup, createNextPrevious } from "../data/mockData";

// ایجاد داده ناوبری
const navData = createNextPrevious(5, "next", 0);
// TODO: ارسال به سرور
console.log("Data to send:", navData);
```

## وضعیت مهاجرت

1. قرارداد واقعی API هم‌اکنون در `apps/api/openapi/openapi.yaml` پیاده شده است.
2. فرمان‌های live با HTTP و رویدادها با SSE منتقل می‌شوند؛ WebSocket عددی بازنمی‌گردد.
3. fixtureهای لازم باید کنار تست مصرف‌کننده و با مدل canonical همان ماژول قرار گیرند.
4. حذف وابستگی production به این پوشه بخشی از Phase F4 است.
