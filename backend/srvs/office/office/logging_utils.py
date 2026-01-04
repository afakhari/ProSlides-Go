import threading

_state = threading.local()


def set_request_id(request_id):
    _state.request_id = request_id


def get_request_id():
    return getattr(_state, "request_id", "-")


class RequestIdFilter:
    def filter(self, record):
        record.request_id = get_request_id()
        return True
