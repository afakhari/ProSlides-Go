from django.db.models import F
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone

from .models import PlayerSession, Quiz


@receiver(pre_save, sender=PlayerSession)
def cache_old_quiz_id(sender, instance, **kwargs):
    if instance.pk:
        instance._old_quiz_id = (
            sender.objects.filter(pk=instance.pk)
            .values_list('quiz_id', flat=True)
            .first()
        )


@receiver(post_save, sender=PlayerSession)
def update_participants_on_save(sender, instance, created, **kwargs):
    if created:
        Quiz.objects.filter(pk=instance.quiz_id).update(
            participants_count=F('participants_count') + 1,
            updated_at=timezone.now(),
        )
        return

    old_quiz_id = getattr(instance, '_old_quiz_id', None)
    if old_quiz_id and old_quiz_id != instance.quiz_id:
        Quiz.objects.filter(pk=old_quiz_id, participants_count__gt=0).update(
            participants_count=F('participants_count') - 1,
            updated_at=timezone.now(),
        )
        Quiz.objects.filter(pk=instance.quiz_id).update(
            participants_count=F('participants_count') + 1,
            updated_at=timezone.now(),
        )


@receiver(post_delete, sender=PlayerSession)
def update_participants_on_delete(sender, instance, **kwargs):
    Quiz.objects.filter(pk=instance.quiz_id, participants_count__gt=0).update(
        participants_count=F('participants_count') - 1,
        updated_at=timezone.now(),
    )
