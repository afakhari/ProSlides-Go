import logging
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Quiz, Slide, Question, Option, PlayerSession, Leaderboard


logger = logging.getLogger(__name__)


class OptionSerializer(serializers.ModelSerializer):
    option_id = serializers.IntegerField(source='id', read_only=True)

    class Meta:
        model = Option
        fields = ['option_id', 'text', 'is_correct', 'votes', 'image_url']
        read_only_fields = ['option_id', 'votes']

    def create(self, validated_data):
        """
        ایجاد گزینه جدید برای یک سوال
        """
        return super().create(validated_data)


class QuestionSerializer(serializers.ModelSerializer):
    question_id = serializers.SerializerMethodField()
    options = OptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = [
            'question_id', 'title', 'text', 'question_type', 'min_point',
            'max_point', 'time_limit', 'image_url', 'faster_answers_more_points',
            'partial_scoring', 'options'
        ]
        read_only_fields = ['question_id']

    def get_question_id(self, obj):
        # OneToOne primary key mapped to slide_id; pk resolves correctly
        return obj.pk


class SlideSerializer(serializers.ModelSerializer):
    slide_id = serializers.IntegerField(source='id', read_only=True)
    question = QuestionSerializer(read_only=True)
    leaderboard = serializers.SerializerMethodField()  # اضافه شده اینجا

    class Meta:
        model = Slide
        fields = [
            'slide_id', 'slide_type', 'order', 'show_leaderboard_after',
            'title', 'content_text', 'content_image_url', 'question', 'leaderboard'
        ]
        read_only_fields = ['slide_id']
        extra_kwargs = {
            'order': {'required': False},
            'title': {'required': False},
            'content_text': {'required': False}
        }

    def get_leaderboard(self, obj):
        """دریافت لیدربرد برای اسلایدهای سوال"""
        if obj.slide_type == 1 and hasattr(obj, 'question'):  # فقط برای اسلایدهای سوال
            try:
                leaderboard_entries = Leaderboard.objects.filter(
                    question=obj.question).order_by('rank')
                serializer = LeaderboardEntrySerializer(
                    leaderboard_entries, many=True)
                return serializer.data
            except Exception:
                logger.exception("Failed to build leaderboard for slide_id=%s question_id=%s",
                                 obj.pk, getattr(obj, 'question_id', None))
                return []
        return []


class QuizSerializer(serializers.ModelSerializer):
    quiz_id = serializers.IntegerField(source='id', read_only=True)
    slides = SlideSerializer(many=True, read_only=True)

    class Meta:
        model = Quiz
        fields = [
            'quiz_id', 'title', 'created_at', 'updated_at', 'author',
            'access_code', 'participants_count', 'music_url',
            'background_color', 'background_image_url', 'slides'
        ]
        read_only_fields = ['quiz_id', 'created_at', 'updated_at', 'participants_count']

    def validate_access_code(self, value):
        if not value:
            return value
        exists = Quiz.objects.filter(access_code=value)
        if self.instance:
            exists = exists.exclude(pk=self.instance.pk)
        if exists.exists():
            raise serializers.ValidationError('access_code already in use')
        return value


class QuizListSerializer(serializers.ModelSerializer):
    quiz_id = serializers.IntegerField(source='id', read_only=True)
    quiz_name = serializers.CharField(source='title', read_only=True)
    last_update = serializers.DateTimeField(source='updated_at', read_only=True)
    slides_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Quiz
        fields = [
            'quiz_id', 'quiz_name', 'last_update', 'created_at',
            'access_code', 'participants_count', 'slides_count'
        ]


class ExportSerializer(serializers.ModelSerializer):
    quiz_id = serializers.IntegerField(source='id', read_only=True)
    slides = serializers.SerializerMethodField()
    background = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = ['quiz_id', 'title', 'background', 'music_url', 'slides']

    def get_background(self, obj):
        return {
            'color': obj.background_color,
            'image': obj.background_image_url
        }

    def get_slides(self, obj):
        """Return slides with an extra leaderboard slide after flagged questions."""
        serialized_slides = SlideSerializer(obj.slides.all(), many=True).data
        slides_with_leaderboards = []

        for slide_data in serialized_slides:
            slides_with_leaderboards.append(slide_data)

            if slide_data.get('slide_type') == 1 and slide_data.get('show_leaderboard_after'):
                slides_with_leaderboards.append(self._build_leaderboard_slide(slide_data))

        return slides_with_leaderboards

    @staticmethod
    def _build_leaderboard_slide(question_slide):
        """Create a lightweight leaderboard slide placeholder."""
        return {
            'slide_id': question_slide.get('slide_id'),
            'slide_type': 3,
            'order': question_slide.get('order'),
            'show_leaderboard_after': False,
            'title': None,
            'content_text': None,
            'content_image_url': None,
            'question': None,
            'leaderboard': [],
        }


class PlayerSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlayerSession
        fields = ['user_id', 'quiz', 'player_name', 'avatar']


class LeaderboardEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Leaderboard
        fields = ['user_id', 'player_name',
                  'avatar', 'score', 'time_taken', 'rank']


class LeaderboardReceiveItemSerializer(serializers.Serializer):
    user_id = serializers.CharField()
    score = serializers.IntegerField()
    time_taken = serializers.FloatField()
    rank = serializers.IntegerField()


class LeaderboardReceiveSerializer(serializers.Serializer):
    leaderboard = LeaderboardReceiveItemSerializer(many=True)


User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "password"]

    def create(self, validated_data):
        user = User(
            username=validated_data["username"],
            email=validated_data.get("email"),
        )
        user.set_password(validated_data["password"])
        user.save()
        return user
