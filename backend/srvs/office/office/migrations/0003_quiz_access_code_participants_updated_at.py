import secrets
import string

from django.core.validators import RegexValidator
from django.db import migrations, models
import django.utils.timezone


def generate_access_code(length=6):
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def populate_quiz_fields(apps, schema_editor):
    Quiz = apps.get_model('office', 'Quiz')
    PlayerSession = apps.get_model('office', 'PlayerSession')

    for quiz in Quiz.objects.all():
        if not quiz.access_code:
            while True:
                code = generate_access_code()
                if not Quiz.objects.filter(access_code=code).exists():
                    quiz.access_code = code
                    break

        quiz.participants_count = PlayerSession.objects.filter(quiz=quiz).count()
        quiz.save(update_fields=['access_code', 'participants_count'])


class Migration(migrations.Migration):

    dependencies = [
        ('office', '0002_option_votes_positive'),
    ]

    operations = [
        migrations.AddField(
            model_name='quiz',
            name='access_code',
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=16,
                null=True,
                unique=True,
                validators=[
                    RegexValidator(
                        regex='^[A-Za-z0-9_-]{4,16}$',
                        message='access_code must be 4-16 chars and use letters, numbers, "_" or "-" only',
                    )
                ],
            ),
        ),
        migrations.AddField(
            model_name='quiz',
            name='participants_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='quiz',
            name='updated_at',
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.RunPython(populate_quiz_fields, migrations.RunPython.noop),
    ]
