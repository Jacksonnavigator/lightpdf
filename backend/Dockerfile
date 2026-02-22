FROM node:20-slim

# Install LibreOffice + dependencies directly in this container
# This is the key difference for Render — no Docker-in-Docker needed
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    fonts-liberation \
    fonts-dejavu \
    fontconfig \
    --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Create data directory
RUN mkdir -p /data && chmod 777 /data
# Create LibreOffice user profile directory
RUN mkdir -p /tmp/lo-profile && chmod 777 /tmp/lo-profile

EXPOSE 3000

CMD ["node", "server.js"]
