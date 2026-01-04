import pytest

from backend.srvs.office.office.utils.order_manager import OrderManager
from backend.srvs.office.tests.factories import QuizFactory, SlideFactory


@pytest.mark.django_db
def test_get_next_order_returns_one_for_empty_queryset():
    quiz = QuizFactory()
    queryset = quiz.slides.all()
    assert OrderManager.get_next_order(queryset) == 1


@pytest.mark.django_db
def test_get_next_order_returns_next_value():
    quiz = QuizFactory()
    SlideFactory(quiz=quiz, order=1)
    SlideFactory(quiz=quiz, order=3)

    queryset = quiz.slides.all()
    assert OrderManager.get_next_order(queryset) == 4


@pytest.mark.django_db
def test_shift_orders_moves_orders_up():
    quiz = QuizFactory()
    SlideFactory(quiz=quiz, order=10)
    SlideFactory(quiz=quiz, order=20)
    SlideFactory(quiz=quiz, order=30)

    OrderManager.shift_orders(quiz.slides.all(), from_order=15, shift_amount=1)

    orders = list(quiz.slides.order_by("order").values_list("order", flat=True))
    assert orders == [10, 21, 31]


@pytest.mark.django_db
def test_shift_orders_moves_orders_down():
    quiz = QuizFactory()
    SlideFactory(quiz=quiz, order=10)
    SlideFactory(quiz=quiz, order=20)
    SlideFactory(quiz=quiz, order=30)

    OrderManager.shift_orders(quiz.slides.all(), from_order=15, shift_amount=-1)

    orders = list(quiz.slides.order_by("order").values_list("order", flat=True))
    assert orders == [10, 19, 29]


@pytest.mark.django_db
def test_reorder_items_updates_order_values():
    quiz = QuizFactory()
    slide_a = SlideFactory(quiz=quiz, order=10)
    slide_b = SlideFactory(quiz=quiz, order=20)
    slide_c = SlideFactory(quiz=quiz, order=30)

    OrderManager.reorder_items(
        model_class=type(slide_a),
        parent_field="quiz",
        parent_id=quiz.id,
        new_order=[slide_c.id, slide_a.id, slide_b.id],
    )

    orders = list(
        quiz.slides.order_by("order").values_list("id", "order")
    )
    assert orders == [
        (slide_c.id, 1),
        (slide_a.id, 2),
        (slide_b.id, 3),
    ]


@pytest.mark.django_db
def test_reorder_items_rejects_mismatched_ids():
    quiz = QuizFactory()
    slide_a = SlideFactory(quiz=quiz, order=1)
    slide_b = SlideFactory(quiz=quiz, order=2)

    with pytest.raises(ValueError):
        OrderManager.reorder_items(
            model_class=type(slide_a),
            parent_field="quiz",
            parent_id=quiz.id,
            new_order=[slide_a.id],
        )
