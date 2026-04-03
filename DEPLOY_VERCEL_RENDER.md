# EduSocial Deploy Checklist (Vercel + Render)

Tai lieu nay chi de chuan bi deploy, khong thay doi logic web dang chay local.

## 1) Frontend len Vercel

1. Vao Vercel -> `Add New Project` -> import repository.
2. Chon:
   - Framework: `Vite`
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. Them Environment Variables (Production):
   - `VITE_API_URL=https://<ten-service-render>.onrender.com`
   - `VITE_SOCKET_URL=https://<ten-service-render>.onrender.com`
4. Deploy.

Da co san file ho tro route SPA:
- `frontend/vercel.json`

## 2) Backend len Render

1. Vao Render -> `New` -> `Web Service` -> connect repo.
2. Chon:
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`
   - Health Check Path: `/api/health`
3. Them bien moi truong theo file:
   - `backend/.env.render.example`
4. Deploy.

## 3) Neu backend da len Render xong

1. Cap nhat lai Vercel env:
   - `VITE_API_URL` = URL Render that
   - `VITE_SOCKET_URL` = URL Render that
2. Redeploy frontend.

## 4) Kiem tra sau deploy

1. Mo frontend: `https://<project>.vercel.app`
2. Test health backend: `https://<service>.onrender.com/api/health`
3. Dang nhap, feed, chat, thong bao.

## 5) Ghi chu quan trong

- Hien tai local dang on dinh va khong bi chinh logic trong buoc chuan bi nay.
- Truoc khi deploy that, can xac nhan endpoint strategy (API/socket) phu hop production.
- Neu ban muon, minh se lam tiep 1 turn "chuyen endpoint sang mode production" tren branch rieng de khong anh huong local.
