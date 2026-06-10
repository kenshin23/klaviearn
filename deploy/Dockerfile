FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server/app ./app
# --proxy-headers: trust X-Forwarded-For from nginx so the per-IP rate
# limiter sees real client IPs, not the proxy's.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8787", \
     "--proxy-headers", "--forwarded-allow-ips", "*"]
