from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError


class Quiz(models.Model):
    title = models.CharField(max_length=200)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Slide(models.Model):
    quiz = models.ForeignKey(
        Quiz, on_delete=models.CASCADE, related_name='slides')
    title = models.CharField(max_length=200)
    order = models.IntegerField(default=1)

    class Meta:
        abstract = True
        ordering = ['order']

    def clean(self):
        if self.order <= 0:
            raise ValidationError(
                {'order': 'Order must be greater than zero.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.quiz.title} - {self.title}"


class QuestionSlide(Slide):
    question_text = models.TextField()

    class Meta:
        abstract = True


class PickAnswerQuestion(QuestionSlide):
    class Meta:
        db_table = 'quiz_pickanswerquestion'

    def __str__(self):
        return f"{self.quiz.title} - {self.title} (Multiple Choice)"


class Option(models.Model):
    question = models.ForeignKey(
        PickAnswerQuestion, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=200)
    is_correct = models.BooleanField(default=False)
    order = models.IntegerField(default=1)  # ✅ اضافه کردن فیلد ترتیب

    class Meta:
        ordering = ['order', 'id']  # ✅ مرتب‌سازی بر اساس ترتیب
        unique_together = ['question', 'order']  # ✅ ترتیب یکتا در هر سوال

    def clean(self):
        """اعتبارسنجی ترتیب"""
        if self.order <= 0:
            raise ValidationError(
                {'order': 'Order must be greater than zero.'})

        # بررسی یکتایی ترتیب در همان سوال
        if self.pk:  # اگر در حال آپدیت است
            existing = Option.objects.filter(
                question=self.question,
                order=self.order
            ).exclude(pk=self.pk)
        else:  # اگر در حال ایجاد است
            existing = Option.objects.filter(
                question=self.question,
                order=self.order
            )

        if existing.exists():
            raise ValidationError({
                'order': f'An option with order {self.order} already exists in this question.'
            })

    def save(self, *args, **kwargs):
        """اعمال اعتبارسنجی قبل از ذخیره"""
        self.full_clean()

        # اگر order مشخص نشده، آخرین order + 1 قرار بده
        if not self.order:
            last_order = Option.objects.filter(question=self.question).aggregate(
                models.Max('order')
            )['order__max'] or 0
            self.order = last_order + 1

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.question.title} - {self.text} (Order: {self.order})"
