from django.contrib import admin
from django.utils.html import format_html
from .models import Quiz, Slide, Question, Option, PlayerSession, Leaderboard


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'title', 'owner', 'slides_count', 'created_at',
        'background_preview', 'music_preview'
    ]
    list_filter = ['created_at', 'owner']
    search_fields = ['title', 'owner__username', 'owner__email']
    readonly_fields = ['created_at', 'slides_count_display']
    fieldsets = (
        ('اطلاعات اصلی', {
            'fields': ('title', 'owner', 'created_at')
        }),
        ('ظاهر و صدا', {
            'fields': ('background_color', 'background_image_url', 'music_url')
        }),
        ('آمار', {
            'fields': ('slides_count_display',)
        })
    )

    def slides_count(self, obj):
        return obj.slides.count()
    slides_count.short_description = 'تعداد اسلایدها'

    def slides_count_display(self, obj):
        return obj.slides.count()
    slides_count_display.short_description = 'تعداد اسلایدها'

    def background_preview(self, obj):
        if obj.background_image_url:
            return format_html(
                '<a href="{}" target="_blank"><img src="{}" style="max-height: 50px; max-width: 50px;" /></a>',
                obj.background_image_url,
                obj.background_image_url
            )
        elif obj.background_color:
            return format_html(
                '<div style="width: 50px; height: 20px; background-color: {}; border: 1px solid #ccc;"></div>',
                obj.background_color
            )
        return '-'
    background_preview.short_description = 'پس‌زمینه'

    def music_preview(self, obj):
        if obj.music_url:
            return format_html(
                '<a href="{}" target="_blank">🎵 گوش دادن</a>',
                obj.music_url
            )
        return '-'
    music_preview.short_description = 'موسیقی'


@admin.register(Slide)
class SlideAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'quiz', 'get_slide_type_display', 'order',
        'show_leaderboard_after', 'has_question', 'has_content'
    ]
    list_filter = ['slide_type', 'show_leaderboard_after', 'quiz']
    search_fields = ['quiz__title', 'title', 'content_text']
    list_editable = ['order', 'show_leaderboard_after']
    readonly_fields = ['slide_preview']
    fieldsets = (
        ('اطلاعات اصلی', {
            'fields': ('quiz', 'slide_type', 'order', 'show_leaderboard_after')
        }),
        ('محتوا', {
            'fields': ('title', 'content_text', 'content_image_url')
        }),
        ('پیش‌نمایش', {
            'fields': ('slide_preview',)
        })
    )

    def has_question(self, obj):
        return hasattr(obj, 'question')
    has_question.boolean = True
    has_question.short_description = 'سوال دارد'

    def has_content(self, obj):
        return bool(obj.title or obj.content_text or obj.content_image_url)
    has_content.boolean = True
    has_content.short_description = 'محتوا دارد'

    def slide_preview(self, obj):
        if obj.slide_type == 1 and hasattr(obj, 'question'):
            question = obj.question
            return format_html(
                '<strong>سوال:</strong> {}<br><strong>نوع:</strong> {}<br><strong>زمان:</strong> {} ثانیه',
                question.title or 'بدون عنوان',
                question.get_question_type_display(),
                question.time_limit
            )
        elif obj.slide_type == 2:
            content = []
            if obj.title:
                content.append(f'<strong>عنوان:</strong> {obj.title}')
            if obj.content_text:
                content.append(f'<strong>متن:</strong> {obj.content_text[:100]}...' if len(
                    obj.content_text) > 100 else f'<strong>متن:</strong> {obj.content_text}')
            if obj.content_image_url:
                content.append(
                    f'<strong>تصویر:</strong> <a href="{obj.content_image_url}" target="_blank">مشاهده</a>')

            return format_html('<br>'.join(content)) if content else 'بدون محتوا'
        return 'نوع اسلاید نامشخص'
    slide_preview.short_description = 'پیش‌نمایش اسلاید'


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = [
        'slide_display', 'question_type', 'time_limit',
        'max_point', 'options_count', 'has_image'
    ]
    list_filter = ['question_type',
                   'faster_answers_more_points', 'partial_scoring']
    search_fields = ['title', 'text', 'slide__quiz__title']
    readonly_fields = ['slide_info', 'options_list']
    fieldsets = (
        ('اطلاعات اصلی', {
            'fields': ('slide_info', 'title', 'text', 'question_type')
        }),
        ('تنظیمات امتیاز', {
            'fields': ('min_point', 'max_point', 'time_limit', 'faster_answers_more_points', 'partial_scoring')
        }),
        ('رسانه', {
            'fields': ('image_url',)
        }),
        ('گزینه‌ها', {
            'fields': ('options_list',)
        })
    )

    def slide_display(self, obj):
        return f"{obj.slide.quiz.title} - اسلاید {obj.slide.order}"
    slide_display.short_description = 'کوئیز - اسلاید'

    def options_count(self, obj):
        return obj.options.count()
    options_count.short_description = 'تعداد گزینه‌ها'

    def has_image(self, obj):
        return bool(obj.image_url)
    has_image.boolean = True
    has_image.short_description = 'تصویر دارد'

    def slide_info(self, obj):
        return format_html(
            '<strong>کوئیز:</strong> {}<br><strong>اسلاید:</strong> {} (ترتیب: {})',
            obj.slide.quiz.title,
            obj.slide.id,
            obj.slide.order
        )
    slide_info.short_description = 'اطلاعات اسلاید'

    def options_list(self, obj):
        options = obj.options.all()
        if not options:
            return 'هیچ گزینه‌ای وجود ندارد'

        options_html = []
        for option in options:
            correct_icon = '✅' if option.is_correct else '❌'
            options_html.append(
                f'{correct_icon} {option.text} (رای: {option.votes})'
            )

        return format_html('<br>'.join(options_html))
    options_list.short_description = 'لیست گزینه‌ها'


@admin.register(Option)
class OptionAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'question_display', 'text_short', 'is_correct',
        'votes', 'has_image'
    ]
    list_filter = ['is_correct', 'question__slide__quiz']
    search_fields = ['text', 'question__title', 'question__slide__quiz__title']
    list_editable = ['is_correct', 'votes']
    readonly_fields = ['question_info', 'image_preview']
    fieldsets = (
        ('اطلاعات اصلی', {
            'fields': ('question_info', 'text', 'is_correct', 'votes')
        }),
        ('رسانه', {
            'fields': ('image_url', 'image_preview')
        })
    )

    def question_display(self, obj):
        return f"{obj.question.slide.quiz.title} - {obj.question.title or 'بدون عنوان'}"
    question_display.short_description = 'سوال'

    def text_short(self, obj):
        return obj.text[:50] + '...' if len(obj.text) > 50 else obj.text
    text_short.short_description = 'متن گزینه'

    def has_image(self, obj):
        return bool(obj.image_url)
    has_image.boolean = True
    has_image.short_description = 'تصویر دارد'

    def question_info(self, obj):
        return format_html(
            '<strong>کوئیز:</strong> {}<br><strong>اسلاید:</strong> {}<br><strong>سوال:</strong> {}',
            obj.question.slide.quiz.title,
            obj.question.slide.order,
            obj.question.title or 'بدون عنوان'
        )
    question_info.short_description = 'اطلاعات سوال'

    def image_preview(self, obj):
        if obj.image_url:
            return format_html(
                '<a href="{}" target="_blank"><img src="{}" style="max-height: 200px; max-width: 200px;" /></a>',
                obj.image_url,
                obj.image_url
            )
        return '-'
    image_preview.short_description = 'پیش‌نمایش تصویر'


@admin.register(PlayerSession)
class PlayerSessionAdmin(admin.ModelAdmin):
    list_display = [
        'rust_session_id', 'player_name', 'avatar', 'quiz_display',
        'created_at'
    ]
    list_filter = ['quiz', 'created_at']
    search_fields = ['player_name', 'rust_session_id', 'quiz__title']
    readonly_fields = ['created_at', 'session_info']
    fieldsets = (
        ('اطلاعات بازیکن', {
            'fields': ('rust_session_id', 'player_name', 'avatar', 'quiz')
        }),
        ('زمان', {
            'fields': ('created_at',)
        }),
        ('اطلاعات سشن', {
            'fields': ('session_info',)
        })
    )

    def quiz_display(self, obj):
        return obj.quiz.title
    quiz_display.short_description = 'کوئیز'

    def session_info(self, obj):
        return format_html(
            '<strong>سشن:</strong> {}<br><strong>بازیکن:</strong> {}<br><strong>کوئیز:</strong> {}',
            obj.rust_session_id,
            obj.player_name,
            obj.quiz.title
        )
    session_info.short_description = 'اطلاعات سشن'


@admin.register(Leaderboard)
class LeaderboardAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'question_display', 'player_name', 'avatar',
        'score', 'time_taken', 'rank', 'created_at'
    ]
    list_filter = ['question__slide__quiz', 'created_at', 'rank']
    search_fields = ['player_name', 'rust_session_id', 'question__title']
    readonly_fields = ['created_at', 'leaderboard_info']
    fieldsets = (
        ('اطلاعات لیدربرد', {
            'fields': ('question', 'rust_session_id', 'player_name', 'avatar')
        }),
        ('نتایج', {
            'fields': ('score', 'time_taken', 'rank')
        }),
        ('زمان', {
            'fields': ('created_at',)
        }),
        ('خلاصه', {
            'fields': ('leaderboard_info',)
        })
    )

    def question_display(self, obj):
        return f"{obj.question.slide.quiz.title} - {obj.question.title or 'بدون عنوان'}"
    question_display.short_description = 'سوال'

    def leaderboard_info(self, obj):
        return format_html(
            '<strong>بازیکن:</strong> {} ({})<br><strong>سوال:</strong> {}<br><strong>امتیاز:</strong> {} - <strong>رتبه:</strong> {}<br><strong>زمان:</strong> {} ثانیه',
            obj.player_name,
            obj.avatar,
            obj.question.title or 'بدون عنوان',
            obj.score,
            obj.rank,
            obj.time_taken
        )
    leaderboard_info.short_description = 'خلاصه لیدربرد'

# ثبت مدل‌ها با ادمین‌کلاس‌های سفارشی
# (اگر بخواهید به صورت دستی ثبت کنید، این خطوط را اضافه کنید)
# admin.site.register(Quiz, QuizAdmin)
# admin.site.register(Slide, SlideAdmin)
# admin.site.register(Question, QuestionAdmin)
# admin.site.register(Option, OptionAdmin)
# admin.site.register(PlayerSession, PlayerSessionAdmin)
# admin.site.register(Leaderboard, LeaderboardAdmin)
