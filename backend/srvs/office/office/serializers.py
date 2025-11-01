from rest_framework import serializers
from django.core.exceptions import ValidationError
from .models import Quiz, PickAnswerQuestion, Option


class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'text', 'is_correct', 'order']

    def validate_order(self, value):
        """اعتبارسنجی order"""
        if value <= 0:
            raise serializers.ValidationError(
                "Order must be greater than zero.")
        return value


class PickAnswerQuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, read_only=True)

    class Meta:
        model = PickAnswerQuestion
        fields = ['id', 'quiz', 'title', 'order', 'question_text', 'options']

    def validate_order(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Order must be greater than zero.")
        return value


class PickAnswerQuestionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PickAnswerQuestion
        fields = ['id', 'title', 'order',
                  'question_text']

    def validate_order(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Order must be greater than zero.")
        return value

    def validate(self, data):
        """اعتبارسنجی یکتایی order در کوئیز"""
        quiz = self.context.get('quiz')
        order = data.get('order')

        if quiz and order:
            existing = PickAnswerQuestion.objects.filter(
                quiz=quiz, order=order)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)

            if existing.exists():
                raise serializers.ValidationError({
                    'order': f'A question with order {order} already exists in this quiz.'
                })

        return data


class QuizDetailSerializer(serializers.ModelSerializer):
    slides = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = ['id', 'title', 'created_by', 'created_at', 'slides']

    def get_slides(self, obj):
        questions = PickAnswerQuestion.objects.filter(
            quiz=obj).order_by('order')
        return PickAnswerQuestionSerializer(questions, many=True).data


class QuizSerializer(serializers.ModelSerializer):
    slides_count = serializers.IntegerField(
        source='slides.count', read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Quiz
        fields = ['id', 'title', 'created_by', 'created_at', 'slides_count']
        read_only_fields = ['created_by', 'created_at']


class QuizUpdateSerializer(serializers.ModelSerializer):
    """سریالایزر مخصوص آپدیت - created_by در آپدیت required نیست"""
    class Meta:
        model = Quiz
        fields = ['id', 'title']
