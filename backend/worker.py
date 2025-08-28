from rq import Worker, Queue, Connection
from services.job_queue import get_redis

listen = ['pessoa-jobs']
redis_conn = get_redis()

if __name__ == '__main__':
    with Connection(redis_conn):
        worker = Worker(list(map(Queue, listen)))
        worker.work()
