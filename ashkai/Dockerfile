# AshKai — single-container build. The backend serves the frontend's
# static files itself, so this one container is the whole app.
FROM node:20-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install --omit=dev

COPY backend ./backend
COPY frontend ./frontend

ENV PORT=8787
EXPOSE 8787

WORKDIR /app/backend
CMD ["node", "server.js"]
