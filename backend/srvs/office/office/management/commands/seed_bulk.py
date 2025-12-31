import random
import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from backend.srvs.office.office import models


AVATARS = [":)", ":D", ":P", "XD", ":-)", ";-)", ":|", ":3", "<3", "o_O"]
TITLE_WORDS = [
    "Atlas",
    "Nova",
    "Pioneer",
    "Summit",
    "Orbit",
    "Signal",
    "Compass",
    "Cascade",
    "Aurora",
    "Vertex",
]
CONTENT_SNIPPETS = [
    "Quick break before the next challenge.",
    "Review the key points on this slide.",
    "Take a breath, next question is coming.",
    "Focus up, the next round starts now.",
]


class Command(BaseCommand):
    help = "Generate bulk demo data (quizzes, slides, questions, options, players, leaderboards)."
    default_password = "password123"

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete all data before seeding.",
        )
        parser.add_argument(
            "--owners",
            type=int,
            default=3,
            help="Number of demo owners to create (ignored if Quiz has no owner field).",
        )
        parser.add_argument(
            "--single-owner",
            action="store_true",
            help="Assign all quizzes to the first owner created.",
        )
        parser.add_argument(
            "--owner-username",
            default=None,
            help="Use a specific username as the only owner (overrides --owners).",
        )
        parser.add_argument(
            "--owner-email",
            default=None,
            help="Email for the specific owner (used with --owner-username).",
        )
        parser.add_argument(
            "--owner-password",
            default=None,
            help="Password for the specific owner if it is created.",
        )
        parser.add_argument(
            "--verified-ratio",
            type=float,
            default=0.7,
            help="Share of demo owners with verified email state (0-1).",
        )
        parser.add_argument(
            "--quizzes",
            type=int,
            default=12,
            help="Number of quizzes to create.",
        )
        parser.add_argument(
            "--slides-per-quiz",
            type=int,
            default=8,
            help="Number of slides per quiz.",
        )
        parser.add_argument(
            "--content-ratio",
            type=float,
            default=0.25,
            help="Fraction of slides that are content slides (0-1).",
        )
        parser.add_argument(
            "--options-per-question",
            type=int,
            default=4,
            help="Number of options per question.",
        )
        parser.add_argument(
            "--players-per-quiz",
            type=int,
            default=25,
            help="Number of player sessions per quiz.",
        )
        parser.add_argument(
            "--leaderboard-per-question",
            type=int,
            default=15,
            help="Leaderboard entries per question (max players per quiz).",
        )
        parser.add_argument(
            "--seed",
            type=int,
            default=42,
            help="Random seed for deterministic data.",
        )

    def _create_owners(self, options, rng):
        quiz_fields = {field.name for field in models.Quiz._meta.fields}
        if "owner" not in quiz_fields:
            return []

        User = get_user_model()
        owners = []
        owner_username = options.get("owner_username")
        owner_email = options.get("owner_email")
        owner_password = options.get("owner_password") or self.default_password
        if owner_username:
            user, created = User.objects.get_or_create(
                username=owner_username,
                defaults={
                    "email": owner_email or f"{owner_username}@example.com",
                    "is_active": True,
                },
            )
            if created:
                user.set_password(owner_password)
                user.save()
            else:
                updates = []
                if owner_email and hasattr(user, "email") and user.email != owner_email:
                    user.email = owner_email
                    updates.append("email")
                if hasattr(user, "is_active") and not user.is_active:
                    user.is_active = True
                    updates.append("is_active")
                if updates:
                    user.save(update_fields=updates)
            return [user]

        count = max(options["owners"], 1)
        for idx in range(count):
            username = f"demo_owner_{idx + 1}"
            email = f"owner{idx + 1}@example.com"
            user, created = User.objects.get_or_create(
                username=username,
                defaults={"email": email, "is_active": True},
            )
            if created:
                user.set_password("password123")
                user.save()
            else:
                updates = []
                if hasattr(user, "email") and not user.email:
                    user.email = email
                    updates.append("email")
                if hasattr(user, "is_active") and not user.is_active:
                    user.is_active = True
                    updates.append("is_active")
                if updates:
                    user.save(update_fields=updates)
            owners.append(user)
        return owners

    def _ensure_email_verifications(self, owners, rng, verified_ratio):
        if not owners:
            return

        now = timezone.now()
        for owner in owners:
            is_verified = rng.random() < verified_ratio
            defaults = {
                "code": None if is_verified else f"{rng.randint(0, 999999):06d}",
                "attempts": rng.randint(0, 2),
                "is_verified": is_verified,
                "expires_at": now + timedelta(hours=2),
                "verified_at": now if is_verified else None,
            }
            models.EmailVerification.objects.get_or_create(
                user=owner,
                defaults=defaults,
            )

    def _random_color(self, rng):
        return f"#{rng.randint(0, 0xFFFFFF):06x}"

    def _question_type(self, rng):
        return "single" if rng.random() < 0.7 else "multiple"

    def _build_leaderboard(self, question, players, per_question, rng, player_id_field, leaderboard_id_field):
        selected = rng.sample(players, k=min(len(players), per_question))
        entries = []
        for player in selected:
            entries.append(
                {
                    "session_id": getattr(player, player_id_field),
                    "player_name": player.player_name,
                    "avatar": player.avatar,
                    "score": rng.randint(0, question.max_point),
                    "time_taken": round(rng.uniform(1, question.time_limit), 2),
                }
            )

        entries.sort(key=lambda row: (-row["score"], row["time_taken"]))
        ranked = []
        prev_score = None
        current_rank = 0
        for idx, entry in enumerate(entries):
            if prev_score is None or entry["score"] < prev_score:
                current_rank = idx + 1
            prev_score = entry["score"]
            leaderboard_kwargs = {
                "question": question,
                "player_name": entry["player_name"],
                "avatar": entry["avatar"],
                "score": entry["score"],
                "time_taken": entry["time_taken"],
                "rank": current_rank,
            }
            leaderboard_kwargs[leaderboard_id_field] = entry["session_id"]
            ranked.append(models.Leaderboard(**leaderboard_kwargs))
        return ranked

    @transaction.atomic
    def handle(self, *args, **options):
        if options["flush"]:
            call_command("flush", verbosity=0, interactive=False)
            self.stdout.write(self.style.WARNING("Database flushed."))

        rng = random.Random(options["seed"])
        owners = self._create_owners(options, rng)
        self._ensure_email_verifications(owners, rng, options["verified_ratio"])
        single_owner = options["single_owner"] or bool(options["owner_username"])

        quizzes_created = 0
        slides_created = 0
        questions_created = 0
        options_created = 0
        players_created = 0
        leaderboards_created = 0

        player_fields = {field.name for field in models.PlayerSession._meta.fields}
        if "rust_session_id" in player_fields:
            player_id_field = "rust_session_id"
        else:
            player_id_field = "user_id"

        leaderboard_fields = {field.name for field in models.Leaderboard._meta.fields}
        if "rust_session_id" in leaderboard_fields:
            leaderboard_id_field = "rust_session_id"
        else:
            leaderboard_id_field = "user_id"

        for quiz_idx in range(options["quizzes"]):
            if owners:
                owner = owners[0] if single_owner else owners[quiz_idx % len(owners)]
            else:
                owner = None
            title = f"Demo Quiz {quiz_idx + 1} - {rng.choice(TITLE_WORDS)}"
            quiz_kwargs = {
                "title": title,
                "music_url": "https://example.com/music.mp3",
                "background_color": self._random_color(rng),
                "background_image_url": "https://example.com/background.jpg",
            }
            if owner:
                quiz_kwargs["owner"] = owner
            quiz = models.Quiz.objects.create(**quiz_kwargs)
            quizzes_created += 1

            question_objects = []
            for order in range(1, options["slides_per_quiz"] + 1):
                is_content = order != 1 and rng.random() < options["content_ratio"]
                if is_content:
                    slide = models.Slide.objects.create(
                        quiz=quiz,
                        slide_type=2,
                        order=order,
                        show_leaderboard_after=False,
                        title=f"Break {order}",
                        content_text=rng.choice(CONTENT_SNIPPETS),
                        content_image_url="https://example.com/slide.png",
                    )
                    slides_created += 1
                    continue

                slide = models.Slide.objects.create(
                    quiz=quiz,
                    slide_type=1,
                    order=order,
                    show_leaderboard_after=rng.random() < 0.7,
                )
                slides_created += 1

                question = models.Question.objects.create(
                    slide=slide,
                    title=f"Question {order}",
                    text="Pick the best answer.",
                    question_type=self._question_type(rng),
                    min_point=0,
                    max_point=rng.choice([50, 100, 150, 200]),
                    time_limit=rng.choice([15, 20, 30, 45]),
                    faster_answers_more_points=rng.random() < 0.5,
                    partial_scoring=rng.random() < 0.5,
                )
                question_objects.append(question)
                questions_created += 1

                option_count = max(options["options_per_question"], 2)
                if question.question_type == "single":
                    correct_count = 1
                else:
                    correct_count = rng.randint(1, option_count - 1)
                correct_indices = set(rng.sample(range(option_count), correct_count))
                option_rows = [
                    models.Option(
                        question=question,
                        order=idx + 1,
                        text=f"Option {idx + 1}",
                        is_correct=idx in correct_indices,
                        votes=rng.randint(0, options["players_per_quiz"]),
                    )
                    for idx in range(option_count)
                ]
                models.Option.objects.bulk_create(option_rows)
                options_created += len(option_rows)

            player_rows = []
            for player_idx in range(options["players_per_quiz"]):
                player_rows.append(
                    models.PlayerSession(
                        **{
                            player_id_field: uuid.uuid4().hex,
                            "quiz": quiz,
                            "player_name": f"Player {quiz_idx + 1}-{player_idx + 1}",
                            "avatar": rng.choice(AVATARS),
                        }
                    )
                )
            models.PlayerSession.objects.bulk_create(player_rows)
            players_created += len(player_rows)

            models.Quiz.objects.filter(pk=quiz.pk).update(
                participants_count=len(player_rows)
            )

            leaderboard_rows = []
            for question in question_objects:
                leaderboard_rows.extend(
                    self._build_leaderboard(
                        question,
                        player_rows,
                        options["leaderboard_per_question"],
                        rng,
                        player_id_field,
                        leaderboard_id_field,
                    )
                )
            if leaderboard_rows:
                models.Leaderboard.objects.bulk_create(leaderboard_rows)
                leaderboards_created += len(leaderboard_rows)

        self.stdout.write(
            self.style.SUCCESS(
                "Seed completed: "
                f"{quizzes_created} quizzes, "
                f"{slides_created} slides, "
                f"{questions_created} questions, "
                f"{options_created} options, "
                f"{players_created} players, "
                f"{leaderboards_created} leaderboard rows."
            )
        )
