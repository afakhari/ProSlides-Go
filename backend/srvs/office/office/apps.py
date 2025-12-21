from django.apps import AppConfig


class OfficeConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'backend.srvs.office.office'
    label = 'office'
    verbose_name = 'Office'

    def ready(self):
        from . import signals  # noqa: F401
