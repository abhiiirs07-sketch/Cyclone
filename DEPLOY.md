# GeoCyclone India - Cloud Deployment Guide

This guide explains how to deploy and host the **GeoCyclone India** WebGIS dashboard on any cloud server or VPS provider (AWS, DigitalOcean, Render, GCP, Railway, Linode) to access it from anywhere in the world.

---

## Method 1: Deploy Anywhere Using Docker (Recommended)

Both backend and frontend services are packaged as Docker containers. Docker Compose handles reversing proxy headers automatically through Nginx.

### Prerequisites
Make sure your cloud VPS has **Docker** and **Docker Compose** installed:
```bash
# Verify installation
docker --version
docker compose version
```

### Steps to Deploy
1. **Transfer Files to Cloud Server**:
   Copy the project directory (`/cylon3`) to your remote server using Git, SCP, or SFTP.

2. **Spin Up Containers**:
   From the project root directory, run:
   ```bash
   docker compose up -d --build
   ```
   This compiles the React static bundle, copies the Nginx configuration, installs GIS packages on the Python image, and launches both services.

3. **Verify running containers**:
   ```bash
   docker compose ps
   ```

4. **Access Anywhere**:
   - **Frontend App**: Open `http://your-server-ip` or `http://your-domain.com` (running on standard HTTP port 80).
   - **Backend API**: Running on `http://your-server-ip:8000` (proxied internally on port 80 through `/api` paths).

---

## Method 2: Deploy Frontend on Vercel / Netlify

If you prefer to host the frontend static files on free hosting platforms (Vercel, Netlify, or Github Pages) and run the backend elsewhere (e.g. Render, Railway, AWS):

### 1. Backend Deployment (FastAPI)
Deploy the `/backend` folder to a service like **Render** or **Railway**:
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Take note of your public backend URL (e.g., `https://geocyclone-api.onrender.com`).

### 2. Frontend Deployment (React + Vite)
Configure Vite to point to your public backend URL instead of localhost:
- In `frontend/src/App.tsx`, update `API_BASE`:
  ```typescript
  const API_BASE = "https://your-backend-api-url.onrender.com";
  ```
- Build the static pages:
  ```bash
  cd frontend
  npm run build
  ```
- Deploy the resulting `/dist` folder to **Vercel**, **Netlify**, or **GitHub Pages**.
