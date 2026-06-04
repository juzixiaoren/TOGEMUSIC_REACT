FROM python:3.10-slim

# 设置环境变量，确保日志即时输出
ENV PYTHONUNBUFFERED=1

WORKDIR /backend

# 安装Node.js和Chromium依赖（用于Puppeteer登录）
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends \
    nodejs \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 设置Puppeteer使用系统Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# 安装Puppeteer Node.js包
RUN cd server/utils/puppeteer_scripts && npm init -y && npm install puppeteer

EXPOSE 8034
CMD ["sh", "-c", "gunicorn --worker-class geventwebsocket.gunicorn.workers.GeventWebSocketWorker --workers ${GUNICORN_WORKERS:-3} --bind 0.0.0.0:${BACKEND_PORT:-8034} --timeout 120 server.app:app"]