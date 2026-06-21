# database-guide.md

Mục đích: giải thích ngắn gọn công dụng các bảng/field chính để Frontend hiểu dữ liệu.

Lưu ý chung: các bảng thường có `id`, `createdAt`, `updatedAt`. Một số dùng `deletedAt` để soft-delete.

1) `User`
- `id`, `name`, `phone`, `email`, `role` (CUSTOMER/BUSINESS/ADMIN), `avatar`.

2) `Address` / `UserAddress`
- `Address`: mô tả địa chỉ (title, latitude, longitude, fullText).
- `UserAddress`: liên kết `userId` với `addressId` + `title` riêng của user.

3) `Cart` / `CartItem`
- `Cart`: mỗi user có 1 cart.
- `CartItem`: `foodId`, `quantity`, `foodSizeId`, `price` (sao lưu tại thời điểm thêm).

4) `Food`, `FoodSize`, `Category`
- `Food`: thông tin món (name, price, restaurantId, isActive).
- `FoodSize`: nếu có kích cỡ/biến thể giá.

5) `Order` và `OrderFood`
- `Order`: thông tin đơn (userId, address, total, status, paymentStatus).
- `OrderFood`: chi tiết món trong đơn.

6) `Conversation` / `Message`
- `Conversation`: phòng chat giữa 2 (hoặc nhiều) participants.
- `Message`: `conversationId`, `senderId`, `content`, `image`, `readAt`.

7) `Notification` / `NotificationChannel`
- `Notification`: bản ghi thông báo (title, body, type, recipientId).
- `NotificationChannel`: trạng thái gửi theo từng channel (`IN_APP`, `DEVICE`) và kết quả provider.

8) `Device`
- Lưu `deviceToken` cho FCM, liên kết `userId`.

9) `Restaurant`, `Payment`, `Voucher`
- `Restaurant`: thông tin vendor (name, address, status).
- `Payment`: ghi nhận giao dịch.
- `Voucher`: mã giảm giá + điều kiện sử dụng.

Nếu cần, tôi có thể tạo một bảng chi tiết (CSV/Markdown) ánh xạ toàn bộ trường của từng model Prisma.
