import logging
from django.db.models import Prefetch
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Quiz, Slide, Question, Option, PlayerSession, Leaderboard


logger = logging.getLogger(__name__)


class OptionSerializer(serializers.ModelSerializer):
    option_id = serializers.IntegerField(source='id', read_only=True)

    class Meta:
        model = Option
        fields = ['option_id', 'order', 'text', 'is_correct', 'votes', 'image_url']
        read_only_fields = ['option_id', 'votes']
        extra_kwargs = {
            'order': {'required': False, 'min_value': 1},
        }

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
                prefetched = getattr(obj.question, 'prefetched_leaderboard', None)
                if prefetched is not None:
                    leaderboard_entries = prefetched
                else:
                    leaderboard_entries = Leaderboard.objects.filter(
                        question=obj.question
                    ).order_by('rank')
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
    owner_name = serializers.SerializerMethodField()
    owner_full_name = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = [
            'quiz_id', 'title', 'created_at', 'updated_at', 'owner_name',
            'owner_full_name',
            'access_code', 'participants_count', 'music_url',
            'background_color', 'background_image_url', 'slides'
        ]
        read_only_fields = ['quiz_id', 'created_at', 'updated_at', 'participants_count']

    def get_owner_name(self, obj):
        owner = getattr(obj, "owner", None)
        return owner.username if owner else None

    def get_owner_full_name(self, obj):
        owner = getattr(obj, "owner", None)
        return owner.first_name if owner else None

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
    owner_name = serializers.SerializerMethodField()
    owner_full_name = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = [
            'quiz_id', 'quiz_name', 'last_update', 'created_at',
            'access_code', 'participants_count', 'slides_count', 'owner_name',
            'owner_full_name'
        ]

    def get_owner_name(self, obj):
        owner = getattr(obj, "owner", None)
        return owner.username if owner else None

    def get_owner_full_name(self, obj):
        owner = getattr(obj, "owner", None)
        return owner.first_name if owner else None


class ExportSerializer(serializers.ModelSerializer):
    quiz_id = serializers.IntegerField(source='id', read_only=True)
    slides = serializers.SerializerMethodField()
    background = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = ['quiz_id', 'title', 'access_code', 'background', 'music_url', 'slides']

    def get_background(self, obj):
        return {
            'color': obj.background_color,
            'image': obj.background_image_url
        }

    def get_slides(self, obj):
        """Return slides with an extra leaderboard slide after flagged questions."""
        slides = obj.slides.select_related('question').prefetch_related(
            Prefetch(
                'question__leaderboard_set',
                queryset=Leaderboard.objects.order_by('rank'),
                to_attr='prefetched_leaderboard',
            )
        )
        serialized_slides = SlideSerializer(slides, many=True).data
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
    user_id = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = PlayerSession
        fields = ['rust_session_id', 'user_id', 'quiz', 'player_name', 'avatar']
        extra_kwargs = {
            'rust_session_id': {'required': False},
        }

    def validate(self, attrs):
        session_id = attrs.get('rust_session_id') or attrs.get('user_id')
        if not session_id:
            raise serializers.ValidationError({'rust_session_id': 'This field is required.'})
        attrs['rust_session_id'] = session_id
        attrs.pop('user_id', None)
        return attrs


class LeaderboardEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Leaderboard
        fields = ['rust_session_id', 'player_name', 'avatar', 'score', 'time_taken', 'rank']


class LeaderboardReceiveItemSerializer(serializers.Serializer):
    rust_session_id = serializers.CharField(max_length=255, required=False)
    user_id = serializers.CharField(max_length=255, required=False)
    player_name = serializers.CharField(max_length=100)
    avatar = serializers.CharField(max_length=10)
    score = serializers.IntegerField()
    time_taken = serializers.FloatField()
    rank = serializers.IntegerField()

    def validate(self, attrs):
        session_id = attrs.get('rust_session_id') or attrs.get('user_id')
        if not session_id:
            raise serializers.ValidationError({'rust_session_id': 'This field is required.'})
        attrs['rust_session_id'] = session_id
        attrs.pop('user_id', None)
        return attrs


class LeaderboardReceiveSerializer(serializers.Serializer):
    leaderboard = LeaderboardReceiveItemSerializer(many=True)

class QuestionOptionResultSerializer(serializers.Serializer):
    option_id = serializers.IntegerField(min_value=1)
    number_of_submits = serializers.IntegerField(min_value=0)


class QuestionResultsReceiveSerializer(serializers.Serializer):
    options = QuestionOptionResultSerializer(many=True)


User = get_user_model()


def validate_simple_password(value):
    if not value:
        raise serializers.ValidationError("Enter a password.")
    if len(value) < 8:
        raise serializers.ValidationError("Use at least 8 characters.")
    if value.isdigit():
        raise serializers.ValidationError("Password cannot be all numbers.")
    return value


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    email = serializers.EmailField()
    full_name = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "password", "full_name"]

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("email already in use")
        return User.objects.normalize_email(value)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("username already in use")
        return value

    def validate_password(self, value):
        return validate_simple_password(value)

    def create(self, validated_data):
        full_name = validated_data.pop("full_name", "").strip()
        user = User(
            username=validated_data["username"],
            email=validated_data.get("email"),
            is_active=False,
        )
        if full_name:
            user.first_name = full_name
        user.set_password(validated_data["password"])
        user.save()
        return user


class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=6, max_length=6)


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()


class GoogleAuthSerializer(serializers.Serializer):
    token = serializers.CharField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        return validate_simple_password(value)


class TokenWithProfileSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        data["full_name"] = user.first_name
        data["email"] = user.email
        data["needs_password_setup"] = not user.has_usable_password()
        return data
