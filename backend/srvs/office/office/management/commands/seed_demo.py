from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from backend.srvs.office.office import models


class Command(BaseCommand):
    help = "Create a full demo quiz with slides, questions, options, and sample leaderboard data."
    default_password = "password123"

    def add_arguments(self, parser):
        parser.add_argument(
            "--title",
            default="Demo Quiz",
            help="Title for the demo quiz (default: Demo Quiz)",
        )
        parser.add_argument(
            "--owner-username",
            default="demo_owner",
            help="Username for the demo quiz owner (default: demo_owner)",
        )
        parser.add_argument(
            "--owner-email",
            default="owner@example.com",
            help="Email for the demo quiz owner (default: owner@example.com)",
        )
        parser.add_argument(
            "--owner-password",
            default=self.default_password,
            help="Password for the demo quiz owner (default: password123)",
        )
        parser.add_argument(
            "--skip-pending-user",
            action="store_true",
            help="Skip creating an extra unverified demo user.",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Remove any existing quiz with the same title before seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        title = options["title"]
        reset = options["reset"]
        owner_username = options["owner_username"]
        owner_email = options["owner_email"]
        owner_password = options["owner_password"]
        create_pending_user = not options["skip_pending_user"]

        if reset:
            deleted, _ = models.Quiz.objects.filter(title=title).delete()
            self.stdout.write(self.style.WARNING(f"Removed {deleted} existing quiz(es) titled '{title}'"))

        User = get_user_model()
        owner, created = User.objects.get_or_create(
            username=owner_username,
            defaults={"email": owner_email, "is_active": True},
        )
        if created:
            owner.set_password(owner_password)
            owner.save()
        elif owner_email and owner.email != owner_email:
            owner.email = owner_email
            owner.save(update_fields=["email"])

        owner_verification_defaults = {
            "code": None,
            "attempts": 0,
            "is_verified": True,
            "expires_at": timezone.now() + timedelta(hours=2),
            "verified_at": timezone.now(),
        }
        models.EmailVerification.objects.get_or_create(
            user=owner,
            defaults=owner_verification_defaults,
        )

        if create_pending_user:
            pending_username = "demo_pending"
            pending_email = "pending@example.com"
            pending_user, pending_created = User.objects.get_or_create(
                username=pending_username,
                defaults={"email": pending_email, "is_active": True},
            )
            if pending_created:
                pending_user.set_password(self.default_password)
                pending_user.save()
            elif pending_email and pending_user.email != pending_email:
                pending_user.email = pending_email
                pending_user.save(update_fields=["email"])

            pending_verification_defaults = {
                "code": "123456",
                "attempts": 0,
                "is_verified": False,
                "expires_at": timezone.now() + timedelta(hours=2),
                "verified_at": None,
            }
            models.EmailVerification.objects.get_or_create(
                user=pending_user,
                defaults=pending_verification_defaults,
            )

        quiz = models.Quiz.objects.create(
            title=title,
            created_at=timezone.now(),
            owner=owner,
            music_url="https://example.com/music.mp3",
            background_color="#123456",
            background_image_url="https://example.com/background.jpg",
        )
        self.stdout.write(self.style.SUCCESS(f"Created quiz '{quiz.title}' (id={quiz.id})"))

        slides = []
        # Slide 1: single-choice question with image
        slides.append(
            models.Slide.objects.create(
                quiz=quiz,
                slide_type=1,
                order=1,
                show_leaderboard_after=True,
            )
        )
        q1 = models.Question.objects.create(
            slide=slides[-1],
            title="Capital of France",
            text="What is the capital of France?",
            question_type="single",
            min_point=0,
            max_point=100,
            time_limit=20,
            image_url="https://example.com/question-1.png",
            faster_answers_more_points=True,
            partial_scoring=False,
        )
        models.Option.objects.bulk_create(
            [
                models.Option(
                    question=q1,
                    order=1,
                    text="Paris",
                    is_correct=True,
                    votes=8,
                    image_url="https://example.com/option-paris.png",
                ),
                models.Option(question=q1, order=2, text="Berlin", is_correct=False, votes=1),
                models.Option(question=q1, order=3, text="Madrid", is_correct=False, votes=1),
                models.Option(question=q1, order=4, text="Rome", is_correct=False, votes=0),
            ]
        )

        # Slide 2: multi-choice question
        slides.append(
            models.Slide.objects.create(
                quiz=quiz,
                slide_type=1,
                order=2,
                show_leaderboard_after=True,
            )
        )
        q2 = models.Question.objects.create(
            slide=slides[-1],
            title="Prime Numbers",
            text="Select all prime numbers.",
            question_type="multiple",
            min_point=0,
            max_point=120,
            time_limit=30,
            image_url="https://example.com/question-2.png",
            faster_answers_more_points=False,
            partial_scoring=True,
        )
        models.Option.objects.bulk_create(
            [
                models.Option(question=q2, order=1, text="2", is_correct=True, votes=5),
                models.Option(question=q2, order=2, text="3", is_correct=True, votes=4),
                models.Option(question=q2, order=3, text="4", is_correct=False, votes=2),
                models.Option(question=q2, order=4, text="5", is_correct=True, votes=3),
                models.Option(question=q2, order=5, text="6", is_correct=False, votes=1),

            ]
        )

        # Slide 3: content slide (instructions)
        slides.append(
            models.Slide.objects.create(
                quiz=quiz,
                slide_type=2,
                order=3,
                show_leaderboard_after=False,
                title="Break",
                content_text="Take a short break and get ready for the next questions.",
                content_image_url="https://example.com/break.png",
            )
        )

        # Slide 4: content slide without image
        slides.append(
            models.Slide.objects.create(
                quiz=quiz,
                slide_type=2,
                order=4,
                show_leaderboard_after=False,
                title="Tips",
                content_text="Remember to think before you answer.",
                content_image_url=None,
            )
        )

        # Slide 5: another question with different scoring settings
        slides.append(
            models.Slide.objects.create(
                quiz=quiz,
                slide_type=1,
                order=5,
                show_leaderboard_after=False,
            )
        )
        q3 = models.Question.objects.create(
            slide=slides[-1],
            title="Fast Math",
            text="What is 12 x 12?",
            question_type="single",
            min_point=10,
            max_point=200,
            time_limit=15,
            image_url=None,
            faster_answers_more_points=True,
            partial_scoring=False,
        )
        models.Option.objects.bulk_create(
            [
                models.Option(question=q3, order=1, text="124", is_correct=False, votes=2),
                models.Option(question=q3, order=2, text="144", is_correct=True, votes=7),
                models.Option(question=q3, order=3, text="154", is_correct=False, votes=1),
            ]
        )

        # Sample player sessions and leaderboard entries for q1
        players = [
            models.PlayerSession.objects.create(
                rust_session_id="player-1",
                quiz=quiz,
                player_name="Alice",
                avatar=":)",
            ),
            models.PlayerSession.objects.create(
                rust_session_id="player-2",
                quiz=quiz,
                player_name="Bob",
                avatar=":D",
            ),
            models.PlayerSession.objects.create(
                rust_session_id="player-3",
                quiz=quiz,
                player_name="Charlie",
                avatar=":P",
            ),
        ]

        models.Quiz.objects.filter(pk=quiz.pk).update(
            participants_count=len(players)
        )

        leaderboard_entries = [
            models.Leaderboard(
                question=q1,
                rust_session_id=players[0].rust_session_id,
                player_name=players[0].player_name,
                avatar=players[0].avatar,
                score=95,
                time_taken=4.5,
                rank=1,
            ),
            models.Leaderboard(
                question=q1,
                rust_session_id=players[1].rust_session_id,
                player_name=players[1].player_name,
                avatar=players[1].avatar,
                score=70,
                time_taken=7.2,
                rank=2,
            ),
            models.Leaderboard(
                question=q1,
                rust_session_id=players[2].rust_session_id,
                player_name=players[2].player_name,
                avatar=players[2].avatar,
                score=40,
                time_taken=10.8,
                rank=3,
            ),
            models.Leaderboard(
                question=q2,
                rust_session_id=players[0].rust_session_id,
                player_name=players[0].player_name,
                avatar=players[0].avatar,
                score=110,
                time_taken=9.1,
                rank=1,
            ),
            models.Leaderboard(
                question=q2,
                rust_session_id=players[1].rust_session_id,
                player_name=players[1].player_name,
                avatar=players[1].avatar,
                score=90,
                time_taken=12.4,
                rank=2,
            ),
            models.Leaderboard(
                question=q3,
                rust_session_id=players[2].rust_session_id,
                player_name=players[2].player_name,
                avatar=players[2].avatar,
                score=150,
                time_taken=6.8,
                rank=1,
            ),
        ]
        models.Leaderboard.objects.bulk_create(leaderboard_entries)

        self.stdout.write(self.style.SUCCESS("Seed data created successfully"))
        self.stdout.write(
            self.style.SUCCESS(
                f"Demo owner credentials -> username: {owner_username} password: {owner_password}"
            )
        )
