FROM python:3.10-slim

# 设置环境变量，确保日志即时输出
ENV PYTHONUNBUFFERED=1

WORKDIR /backend

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8034
CMD ["python", "./server/app.py"]