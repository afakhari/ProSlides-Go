from django.core.validators import RegexValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('office', '0003_quiz_access_code_participants_updated_at'),
    ]

    operations = [
        migrations.AlterField(
            model_name='quiz',
            name='access_code',
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=16,
                unique=True,
                validators=[
                    RegexValidator(
                        regex='^[A-Za-z0-9_-]{4,16}$',
                        message='access_code must be 4-16 chars and use letters, numbers, "_" or "-" only',
                    )
                ],
            ),
        ),
    ]
