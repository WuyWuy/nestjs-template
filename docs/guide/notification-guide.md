# notification-guide.md

Mục đích: hướng dẫn Frontend gọi API thông báo và cách sử dụng 2 kênh `IN_APP` và `IN_DEVICE` (Firebase).

1) Tổng quan
- `IN_APP`: thông báo lưu trong DB và hiển thị trong mục thông báo (nút chuông).
- `IN_DEVICE`: gửi push qua Firebase (FCM) tới device token đã đăng ký.

2) Endpoint chính
- `POST /notification` — tạo và (tùy cấu hình) gửi thông báo.
  Body ví dụ:

```json
{
  "title": "Order update",
  "body": "Đơn hàng #123 đang được xử lý",
  "type": "ORDER"
}
```

- `GET /notification/me` — lấy thông báo của người dùng (pagination via query DTO).
- `GET /notification/me/unread-count` — lấy số thông báo chưa đọc.
- `PATCH /notification/:notificationId/read` — đánh dấu 1 thông báo đã đọc.
- `PATCH /notification/read-all` — đánh dấu tất cả đã đọc.
- `GET /notification/test` — endpoint test (dev only).

3) Gửi push device (FCM)
- Trước khi backend gửi được `IN_DEVICE`, frontend phải đăng ký device token:
  - `POST /device` (xem `DeviceController`) với body { deviceToken }
- Firebase credentials: repo có `firebase-credential.json` (bị .gitignore). Hoặc set biến môi trường `FIREBASE_*` theo `.env.example`.

4) Ví dụ luồng
- Khi có sự kiện (order, chat...), backend emit event `notification.send` → `NotificationService` tạo bản ghi `Notification` (IN_APP) và tạo `NotificationChannel` cho `DEVICE` nếu có device token và cố gắng gửi qua Firebase.

5) Lưu ý
- Nếu Firebase gửi thất bại, backend sẽ ghi trạng thái thất bại cho `NotificationChannel` nhưng vẫn giữ thông báo IN_APP.
- Để kiểm thử push locally, cần device token thật hoặc dùng Firebase testing tools.
