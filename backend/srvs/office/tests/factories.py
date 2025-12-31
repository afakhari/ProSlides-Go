import factory
from django.utils import timezone
from django.contrib.auth import get_user_model

from backend.srvs.office.office import models

User = get_user_model()


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    username = factory.Sequence(lambda n: f"user{n}")
    email = factory.LazyAttribute(lambda o: f"{o.username}@example.com")
    password = factory.PostGenerationMethodCall("set_password", "password123")


class QuizFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Quiz

    title = factory.Faker("sentence")
    created_at = factory.LazyFunction(timezone.now)
    music_url = None
    background_color = "#FFFFFF"
    background_image_url = None
    owner = factory.SubFactory(UserFactory)


class SlideFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Slide

    quiz = factory.SubFactory(QuizFactory)
    slide_type = 1
    order = factory.Sequence(lambda n: n + 1)
    show_leaderboard_after = False
    title = factory.Faker("sentence")
    content_text = factory.Faker("paragraph")
    content_image_url = None


class QuestionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Question

    slide = factory.SubFactory(SlideFactory, slide_type=1)
    title = factory.Faker("sentence")
    text = factory.Faker("paragraph")
    question_type = "single"
    min_point = 0
    max_point = 100
    time_limit = 30
    image_url = None
    faster_answers_more_points = False
    partial_scoring = False


class OptionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.Option

    question = factory.SubFactory(QuestionFactory)
    text = factory.Faker("word")
    is_correct = False
    votes = 0
    image_url = None


class PlayerSessionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = models.PlayerSession

    rust_session_id = factory.Faker("uuid4")
    quiz = factory.SubFactory(QuizFactory)
    player_name = factory.Faker("name")
    avatar = factory.Faker("emoji")
