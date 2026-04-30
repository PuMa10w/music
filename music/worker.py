import redis
import json
import time

def process_job(job_data):
    """Process audio separation job"""
    print(f"Processing job: {job_data}")
    # Here would be Demucs processing
    time.sleep(2)
    return {"status": "completed", "job_id": job_data.get("job_id")}

def main():
    r = redis.Redis(host='redis', port=6379, decode_responses=True)
    print("Worker started, waiting for jobs...")
    
    while True:
        try:
            # Blocking pop from queue
            job = r.blpop('audio_jobs', timeout=30)
            if job:
                queue_name, job_json = job
                job_data = json.loads(job_json)
                result = process_job(job_data)
                # Store result
                r.set(f"result:{job_data.get('job_id')}", json.dumps(result))
        except Exception as e:
            print(f"Error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
