import secrets
import string

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, RegexValidator
from django.db import IntegrityError, models, transaction
from django.utils import timezone


ACCESS_CODE_ALPHABET = string.ascii_letters + string.digits


def generate_access_code(length=6):
    return ''.join(secrets.choice(ACCESS_CODE_ALPHABET) for _ in range(length))


class Quiz(models.Model):
    title = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    owner = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="quizzes", null=True, blank=True
    )
    access_code = models.CharField(
        max_length=16,
        unique=True,
        db_index=True,
        blank=True,
        validators=[
            RegexValidator(
                regex=r'^[A-Za-z0-9_-]{4,16}$',
                message='access_code must be 4-16 chars and use letters, numbers, "_" or "-" only',
            )
        ],
    )
    participants_count = models.PositiveIntegerField(default=0)
    music_url = models.URLField(
        max_length=500, blank=True, null=True)
    background_color = models.CharField(max_length=7, default='#FFFFFF')
    background_image_url = models.URLField(
        max_length=500, blank=True, null=True)

    class Meta:
        ordering = ['-created_at']

    def _generate_unique_access_code(self):
        for _ in range(10):
            code = generate_access_code()
            if not Quiz.objects.filter(access_code=code).exists():
                return code
        raise ValidationError('Could not generate a unique access code')

    def save(self, *args, **kwargs):
        if self.access_code:
            super().save(*args, **kwargs)
            return

        for _ in range(5):
            self.access_code = self._generate_unique_access_code()
            try:
                super().save(*args, **kwargs)
                return
            except IntegrityError:
                self.access_code = None
        raise ValidationError('Could not generate a unique access code')

    def __str__(self):
        return self.title


class EmailVerification(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='email_verification'
    )
    code = models.CharField(max_length=6, blank=True, null=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    is_verified = models.BooleanField(default=False)
    sent_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField()
    verified_at = models.DateTimeField(blank=True, null=True)

    def is_expired(self):
        return timezone.now() >= self.expires_at


class Slide(models.Model):
    SLIDE_TYPE_CHOICES = [
        (1, 'Question'),
        (2, 'Content'),
    ]

    quiz = models.ForeignKey(
        Quiz, on_delete=models.CASCADE, related_name='slides')
    slide_type = models.IntegerField(choices=SLIDE_TYPE_CHOICES)
    order = models.PositiveIntegerField()
    show_leaderboard_after = models.BooleanField(default=False)
    title = models.CharField(max_length=255, blank=True, null=True)
    content_text = models.TextField(blank=True, null=True)
    content_image_url = models.URLField(
        max_length=500, blank=True, null=True)

    class Meta:
        unique_together = ['quiz', 'order']
        ordering = ['order']

    def save(self, *args, **kwargs):
        """
        Assign the next available order under a row lock when order is omitted,
        to avoid duplicate order values under concurrent inserts.
        """
        if self.order is None:
            with transaction.atomic():
                last_slide = (
                    self.__class__.objects
                    .select_for_update()
                    .filter(quiz=self.quiz)
                    .order_by('-order')
                    .first()
                )
                self.order = last_slide.order + 1 if last_slide else 1
                super().save(*args, **kwargs)
                return
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Slide {self.order} - {self.get_slide_type_display()}"


class Question(models.Model):
    QUESTION_TYPE_CHOICES = [
        ('single', 'Single Choice'),
        ('multiple', 'Multiple Choice'),
    ]

    slide = models.OneToOneField(
        Slide, on_delete=models.CASCADE, primary_key=True)
    title = models.CharField(max_length=255, blank=True, null=True)
    text = models.TextField(blank=True, null=True)
    question_type = models.CharField(
        max_length=10, choices=QUESTION_TYPE_CHOICES)
    min_point = models.IntegerField(default=0)
    max_point = models.IntegerField(default=100)
    time_limit = models.IntegerField(default=30)
    image_url = models.URLField(
        max_length=500, blank=True, null=True)
    faster_answers_more_points = models.BooleanField(default=False)
    partial_scoring = models.BooleanField(default=False)

    @property
    def id(self):
        # سازگاری با کدی که انتظار فیلد id دارد؛ pk همان slide_id است
        return self.pk

    def __str__(self):
        return self.title or f"Question for Slide {self.slide_id}"


class Option(models.Model):
    question = models.ForeignKey(
        Question, on_delete=models.CASCADE, related_name='options')
    order = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)
    votes = models.PositiveIntegerField(default=0)
    image_url = models.URLField(
        max_length=500, blank=True, null=True)

    class Meta:
        ordering = ['order']
        constraints = [
            models.UniqueConstraint(
                fields=['question', 'order'],
                name='unique_option_order_per_question',
            )
        ]

    def save(self, *args, **kwargs):
        if self.order is None:
            with transaction.atomic():
                last_option = (
                    self.__class__.objects
                    .select_for_update()
                    .filter(question=self.question)
                    .order_by('-order')
                    .first()
                )
                self.order = last_option.order + 1 if last_option else 1
        super().save(*args, **kwargs)

    def __str__(self):
        return self.text


class PlayerSession(models.Model):
    rust_session_id = models.CharField(max_length=255, unique=True)
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE)
    player_name = models.CharField(max_length=100)
    avatar = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.player_name} ({self.rust_session_id})"


class Leaderboard(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    rust_session_id = models.CharField(max_length=255)
    player_name = models.CharField(max_length=100)
    avatar = models.CharField(max_length=10)
    score = models.IntegerField()
    time_taken = models.FloatField()
    rank = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['question', 'rust_session_id']
