# be-guide.md

Hướng dẫn thiết lập và chạy backend ở môi trường development.

1) Yêu cầu
- Node.js (hoặc Bun) và `npm`/`bun`
- PostgreSQL (hoặc DB tương thích) và biến môi trường `DATABASE_URL`
- File cấu hình Firebase (tùy dùng) `firebase-credential.json` (đã có trong repo nhưng bị .gitignore)

2) Thiết lập nhanh

Sao chép file môi trường và chỉnh:

# 1. Khởi chạy phụ trợ (Postgres, MinIO, v.v.)
docker-compose up -d

# 2. Thêm file env và credential
cp .env.example .env
# đặt firebase-credential.json vào repo (hoặc đường dẫn config)

# 3. Cài dependencies
bun install

# 4. Tạo client Prisma + migrate nếu cần
bunx prisma generate
bunx prisma migrate dev --name init

# 5. Chạy dev
bun run --bun --watch src/main.ts
# hoặc: npm run dev

3) Biến môi trường quan trọng (tham khảo `.env.example`)
- `PORT` — port server (mặc định 4000)
- `DATABASE_URL` — chuỗi kết nối database
- `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` — nếu dùng push (FCM)
- `MINIO_*` — cấu hình MinIO cho upload file

4) Lưu ý vận hành khi phát triển
- Buckets MinIO nên được tạo khi module MinIO khởi tạo (repo có logic tạo bucket).
- Nếu dùng Firebase, đặt `firebase-credential.json` theo đường dẫn cấu hình hoặc set biến môi trường tương ứng.
- Để seed dữ liệu, xem `prisma/seed`.

5) Thông tin hữu ích
- API docs có sẵn tại `http://localhost:4000/api/docs` sau khi server chạy.
