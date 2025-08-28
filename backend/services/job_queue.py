from redis import Redis
from rq import Queue
from config.settings import settings

_redis = None
_q = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.REDIS_URL)
    return _redis


def get_queue() -> Queue:
    global _q
    if _q is None:
        _q = Queue('pessoa-jobs', connection=get_redis())
    return _q


def enqueue_job(func, *args, **kwargs):
    q = get_queue()
    return q.enqueue(func, *args, **kwargs)
