FROM python:3.10-slim

# 设置环境变量，确保日志即时输出
ENV PYTHONUNBUFFERED=1

WORKDIR /backend

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8034
CMD ["sh", "-c", "gunicorn --worker-class geventwebsocket.gunicorn.workers.GeventWebSocketWorker --workers ${GUNICORN_WORKERS:-3} --bind 0.0.0.0:${BACKEND_PORT:-8034} --timeout 120 server.app:app"]