from services.audit_service import log_audit
from services.jd_service import generate_jd_from_texts
from services.resume_service import compare_texts_to_jd

# Task wrapper functions for RQ to import

def task_generate_jd(user_id: str, inputs: dict):
    # inputs: {"prompt": ..., "options": ...}
    log_audit(user_id, 'job_generate_jd_started', details={'inputs_preview': str(inputs)[:100]})
    try:
        result = generate_jd_from_texts(inputs.get('texts', ''), inputs.get('options', {}))
        log_audit(user_id, 'job_generate_jd_completed', details={'result_preview': str(result)[:500]})
        return result
    except Exception as e:
        log_audit(user_id, 'job_generate_jd_failed', details={'error': str(e)})
        raise


def task_compare_texts(user_id: str, payload: dict):
    # payload: {"texts": [...], "jd": "..."}
    log_audit(user_id, 'job_compare_texts_started', details={'payload_preview': str(payload)[:200]})
    try:
        result = compare_texts_to_jd(payload.get('texts', []), payload.get('jd', ''))
        log_audit(user_id, 'job_compare_texts_completed', details={'result_preview': str(result)[:500]})
        return result
    except Exception as e:
        log_audit(user_id, 'job_compare_texts_failed', details={'error': str(e)})
        raise
