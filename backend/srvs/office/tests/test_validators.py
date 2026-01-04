import pytest
from django.core.exceptions import ValidationError

from backend.srvs.office.office.validators import (
    validate_positive_time,
    validate_reasonable_time,
)


@pytest.mark.parametrize("value", [0, -1, -10])
def test_validate_positive_time_rejects_non_positive_values(value):
    with pytest.raises(ValidationError):
        validate_positive_time(value)


@pytest.mark.parametrize("value", [1, 10, 300])
def test_validate_positive_time_accepts_positive_values(value):
    validate_positive_time(value)


@pytest.mark.parametrize("value", [301, 600, 1000])
def test_validate_reasonable_time_rejects_large_values(value):
    with pytest.raises(ValidationError):
        validate_reasonable_time(value)


@pytest.mark.parametrize("value", [1, 120, 300])
def test_validate_reasonable_time_accepts_reasonable_values(value):
    validate_reasonable_time(value)
