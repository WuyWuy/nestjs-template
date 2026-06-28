# Backend Phase 2 Development Roadmap & Task Breakdown

Tài liệu này phân chia các phân hệ nâng cấp cho Backend thành 7 đầu Issue chính. Mỗi Issue chứa các nhiệm vụ (Tasks) cụ thể để lập trình viên dễ dàng theo dõi và triển khai code.

---

## Issue 1: Cập nhật Di cư Cơ sở dữ liệu (Prisma Database Migrations)
*Mục tiêu: Cập nhật schema Prisma và đồng bộ cấu trúc bảng cơ sở dữ liệu.*

- [ ] **Task 1.1: Tạo model `SearchHistory`**
  - Tạo file [search.prisma](file:///home/cloud/workspace/web/food-delivery/food-deliver-be/prisma/models/search.prisma) và định nghĩa bảng `SearchHistory` gồm các cột: `id` (Int, autoincrement), `userId` (Int), `keyword` (String), `createdAt` (DateTime).
  - Thiết lập unique constraint trên cặp `[userId, keyword]` và các index hỗ trợ tìm kiếm theo `userId`.
- [ ] **Task 1.2: Tạo model `UserFavoriteRestaurant`**
  - Tạo file [favorite.prisma](file:///home/cloud/workspace/web/food-delivery/food-deliver-be/prisma/models/favorite.prisma) và định nghĩa bảng `UserFavoriteRestaurant` gồm các cột: `id` (Int, autoincrement), `userId` (Int), `restaurantId` (Int), `createdAt` (DateTime).
  - Thiết lập unique constraint trên cặp `[userId, restaurantId]` và các index hỗ trợ.
- [ ] **Task 1.3: Cập nhật model `RestaurantRating` và `Order`**
  - Trong [restaurant.prisma](file:///home/cloud/workspace/web/food-delivery/food-deliver-be/prisma/models/restaurant.prisma), chỉnh sửa model `RestaurantRating`:
    - Thêm cột `orderId` (Int, unique) và liên kết 1-1 với model `Order`.
    - Thêm cột `tags` (Json, nullable) để lưu trữ mảng các tag đánh giá.
  - Trong [order.prisma](file:///home/cloud/workspace/web/food-delivery/food-deliver-be/prisma/models/order.prisma), thêm liên kết ngược `restaurantRating RestaurantRating?`.
- [ ] **Task 1.4: Cập nhật model `Message`**
  - Trong [chat.prisma](file:///home/cloud/workspace/web/food-delivery/food-deliver-be/prisma/models/chat.prisma), bổ sung trường `isRead` kiểu `Boolean` có giá trị mặc định là `false` vào model `Message`.
- [ ] **Task 1.5: Chạy Database Migration**
  - Biên dịch/tổng hợp các schema prisma lẻ (nếu dự án sử dụng công cụ gộp schema) và chạy lệnh tạo migration để đồng bộ DB:
    ```bash
    bun prisma migrate dev --name update_phase2_models
    ```

---

## Issue 2: Phân hệ Auth - Tách Quy trình Reset Password
*Mục tiêu: Tách API reset mật khẩu thành 2 giai đoạn: Xác thực OTP lấy Reset Token và Đặt lại mật khẩu.*

- [ ] **Task 2.1: Cập nhật DTO và Schema Validation**
  - Trong [auth.dto.ts](file:///home/cloud/workspace/web/food-delivery/food-deliver-be/src/modules/auth/dto/auth.dto.ts), tạo class `VerifyResetOtpDto` chứa: `email` (string, IsEmail) và `otp` (string, length 6).
  - Cập nhật `ResetPasswordData` để nhận: `resetToken` (string, IsNotEmpty) và `newPassword` (string, MinLength).
- [ ] **Task 2.2: Triển khai API Xác thực OTP**
  - Trong [auth.controller.ts](file:///home/cloud/workspace/web/food-delivery/food-deliver-be/src/modules/auth/auth.controller.ts), định nghĩa endpoint `POST /auth/verify-reset-otp` nhận body là `VerifyResetOtpDto`.
- [ ] **Task 2.3: Triển khai logic xác thực và cấp Reset Token**
  - Trong [auth.service.ts](file:///home/cloud/workspace/web/food-delivery/food-deliver-be/src/modules/auth/auth.service.ts), viết method `verifyResetOtp(data: VerifyResetOtpDto)`:
    - Tìm và kiểm tra bản ghi OTP reset password khớp với email, chưa sử dụng, chưa hết hạn.
    - Nếu hợp lệ, đánh dấu OTP đã sử dụng (`usedAt = new Date()`).
    - Sử dụng `JwtService` sinh ra một `resetToken` ngắn hạn (10 phút) có payload chứa `{ email: user.email, purpose: "RESET_PASSWORD" }` và ký bằng khóa bí mật.
- [ ] **Task 2.4: Nâng cấp API Đặt lại mật khẩu**
  - Sửa đổi method `resetPassword` trong `auth.service.ts`:
    - Giải mã và xác minh `resetToken` (signature, hết hạn, và purpose).
    - Cập nhật mật khẩu mới cho tài khoản.
    - Đăng xuất người dùng từ xa: cập nhật `usedAt = new Date()` cho toàn bộ Refresh Token của User trong bảng `AuthToken`.

---

## Issue 3: Phân hệ Search (Tìm kiếm & Gợi ý)
*Mục tiêu: Xây dựng Module Tìm kiếm mới phục vụ Tìm kiếm hợp nhất, gợi ý, lịch sử và xu hướng.*

- [ ] **Task 3.1: Khởi tạo module Search**
  - Tạo cấu trúc thư mục `src/modules/search` cùng các file: `search.module.ts`, `search.controller.ts`, `search.service.ts`.
  - Tạo file DTO `dto/search.dto.ts` để validate các query parameter của các endpoint tìm kiếm.
- [ ] **Task 3.2: Triển khai API Tìm kiếm hợp nhất (`GET /api/search`)**
  - Triển khai logic tìm kiếm song song `foods` và `restaurants` dựa trên từ khóa `q`.
  - Hỗ trợ tính khoảng cách bằng công thức Haversine nếu có `lat`/`lng`.
  - Hỗ trợ các bộ lọc sắp xếp `sort` (`distance`, `rating`, `price_low_to_high` chỉ cho food) và lọc theo `categoryId`.
  - Áp dụng phân trang độc lập cho cả 2 danh sách bằng `limit` và `offset`.
- [ ] **Task 3.3: Triển khai API Gợi ý mặc định (`GET /api/search/suggestions`)**
  - Triển khai gợi ý món ăn bán chạy dựa trên tổng số lượng trong `OrderFood` của các đơn hàng `DELIVERED`.
  - Triển khai gợi ý nhà hàng: thỏa mãn điểm đánh giá >= 4.5 hoặc có voucher hoạt động. Nếu có `lat/lng`, chỉ lọc các nhà hàng trong bán kính 10km xếp từ gần đến xa; nếu không có kết quả trong bán kính đó hoặc không có lat/lng, fallback gợi ý toàn hệ thống.
- [ ] **Task 3.4: Triển khai các API quản lý Lịch sử tìm kiếm**
  - `GET /api/search/history`: Lấy lịch sử của user hiện tại xếp mới nhất lên đầu.
  - `POST /api/search/history`: Lưu từ khóa tìm kiếm bằng lệnh Upsert (cặp `userId, keyword`).
  - `DELETE /api/search/history`: Xóa toàn bộ lịch sử của User hiện tại.
  - `DELETE /api/search/history/:id`: Xóa một bản ghi lịch sử cụ thể (kiểm tra quyền sở hữu).
- [ ] **Task 3.5: Triển khai API Từ khóa thịnh hành (`GET /api/search/trending`)**
  - Thống kê các từ khóa được lưu trong bảng `SearchHistory` trong vòng 7 ngày qua. Gom nhóm theo `keyword`, đếm số lượng, sắp xếp giảm dần và giới hạn theo `limit`.

---

## Issue 4: Phân hệ Rating & Review (Đánh giá)
*Mục tiêu: Cập nhật logic đánh giá theo đơn hàng, bổ sung tags cố định và thống kê Dashboard.*

- [ ] **Task 4.1: Cập nhật Validation DTO**
  - Tạo/Cập nhật các DTO trong [restaurant.dto.ts](file:///home/cloud/workspace/web/food-delivery/food-deliver-be/src/modules/restaurant/dto/restaurant.dto.ts):
    - Thêm `orderId` (IsInt, IsNotEmpty) và `tags` (IsArray, IsString) vào dữ liệu gửi lên.
    - Validate các tags phải nằm trong mảng: `["Món ăn ngon", "Giao hàng nhanh", "Đóng gói cẩn thận", "Thái độ tốt", "Giá cả hợp lý"]`.
- [ ] **Task 4.2: Nâng cấp API Gửi đánh giá mới**
  - Cập nhật method `createRestaurantRating` trong `restaurant.service.ts`:
    - Kiểm tra đơn hàng có tồn tại, thuộc sở hữu của User, khớp với nhà hàng được đánh giá.
    - Đảm bảo trạng thái đơn hàng là `DELIVERED`.
    - Kiểm tra đơn hàng này đã được đánh giá trước đó chưa.
    - Lưu bản ghi đánh giá kèm mảng tags (JSON) và liên kết `orderId`.
- [ ] **Task 4.3: Triển khai API Lấy danh sách đánh giá của tôi**
  - Thêm endpoint `GET /api/user/reviews` lấy danh sách đánh giá của người dùng hiện tại, trả về đầy đủ tên nhà hàng và thông tin phản hồi của nhà hàng (nếu có), hỗ trợ phân trang.
- [ ] **Task 4.4: Triển khai các API Cập nhật và Xóa đánh giá**
  - API `PATCH /api/restaurant/reviews/:reviewId` và `DELETE /api/restaurant/reviews/:reviewId` hỗ trợ khách hàng chỉnh sửa hoặc xóa đánh giá của mình (kiểm tra sở hữu).
- [ ] **Task 4.5: Triển khai các API quản lý dành cho nhà hàng**
  - API `GET /api/restaurant/manage/:restaurantId/reviews`: Lấy toàn bộ nhận xét của nhà hàng (Vendor View).
  - API `POST /api/restaurant/reviews/:reviewId/reply`: Cập nhật phản hồi (`reply` và `replyCreatedAt`) của chủ nhà hàng.
- [ ] **Task 4.6: Triển khai API Thống kê đánh giá tại Dashboard**
  - API `GET /api/restaurant/manage/:restaurantId/stats/ratings`: Tính điểm đánh giá trung bình, đếm tổng số review, đếm số lượng sao (1 đến 5 sao) và thống kê các tag phổ biến nhất (popularTags) sắp xếp giảm dần theo số lượng chọn.

---

## Issue 5: Phân hệ Chat / Conversation (Tin nhắn)
*Mục tiêu: Bổ sung số tin nhắn chưa đọc, thông tin định danh hiển thị trên Header và đánh dấu đã đọc.*

- [ ] **Task 5.1: Cập nhật API lấy danh sách hội thoại (`GET /api/conversation/me`)**
  - Cập nhật logic truy vấn: Lấy thêm `customer` (name, avatar), `seller` (name, avatar), và `restaurant` (id, name, image thông qua orderId).
  - Tính toán `unreadCount`: Đếm số tin nhắn trong cuộc hội thoại đó có `senderId != currentUserId` và `isRead == false`.
- [ ] **Task 5.2: Cập nhật API chi tiết cuộc hội thoại**
  - Cập nhật các API `/api/conversation/detail` và `/api/conversation/:conversationId` để trả về đầy đủ thông tin định danh nhà hàng, customer, seller và gắn cờ `who: "me" | "other"` cho từng tin nhắn.
- [ ] **Task 5.3: Triển khai API Đánh dấu đã đọc (`PATCH /api/conversation/:conversationId/read`)**
  - Viết logic cập nhật trường `isRead = true` cho toàn bộ tin nhắn nhận được (có `senderId != currentUserId` và `isRead == false`) thuộc cuộc hội thoại đó.

---

## Issue 6: Phân hệ Yêu thích Nhà hàng (Favorite Restaurants)
*Mục tiêu: Phát triển các API thích nhà hàng và tích hợp trạng thái yêu thích động.*

- [ ] **Task 6.1: Khởi tạo module Favorite**
  - Tạo cấu trúc thư mục `src/modules/favorite` cùng các file: `favorite.module.ts`, `favorite.controller.ts`, `favorite.service.ts`.
- [ ] **Task 6.2: Triển khai API Thích/Bỏ thích nhà hàng**
  - API `POST /api/restaurant/:restaurantId/like`: Tìm kiếm bản ghi thích của User đối với nhà hàng. Nếu đã thích thì xóa bản ghi (unlike), nếu chưa thích thì tạo mới (like).
  - Trả về trạng thái `isLiked` hiện tại và tổng số lượt thích (`totalLikes`) của nhà hàng đó.
- [ ] **Task 6.3: Triển khai API Lấy danh sách yêu thích và kiểm tra trạng thái**
  - `GET /api/user/favorites/restaurants`: Trả về danh sách các nhà hàng mà người dùng đã thích (có phân trang).
  - `GET /api/restaurant/:restaurantId/like-status`: Kiểm tra nhanh User hiện tại có đang thích nhà hàng này không.
- [ ] **Task 6.4: Tích hợp trạng thái `isLiked` vào danh sách nhà hàng hệ thống**
  - Cập nhật API khám phá nhà hàng (`GET /api/restaurant`): Nếu người dùng đã đăng nhập, thực hiện join kiểm tra với bảng `UserFavoriteRestaurant` để trả về trường `isLiked: true/false` tương ứng theo từng User.

---

## Issue 7: Phân hệ Home Dashboard & Counters
*Mục tiêu: Tạo endpoint gộp và các bộ đếm để trang chủ tải nhanh nhất.*

- [ ] **Task 7.1: Khởi tạo module Home**
  - Tạo cấu trúc thư mục `src/modules/home` cùng các file: `home.module.ts`, `home.controller.ts`, `home.service.ts`.
- [ ] **Task 7.2: Triển khai API Bộ đếm (`GET /api/home/counters`)**
  - Triển khai logic tính toán:
    - `cartItemCount`: Tổng số lượng (`quantity`) của toàn bộ các sản phẩm (`CartItem`) có trong giỏ hàng của User.
    - `unreadMessageCount`: Tổng số tin nhắn chưa đọc (`isRead == false` và `senderId != currentUserId`) trên toàn bộ các hội thoại đang hoạt động của người dùng.
- [ ] **Task 7.3: Triển khai API Dashboard Hợp nhất (`GET /api/home/dashboard`)**
  - Nhận tham số tọa độ `lat/lng` và token (tùy chọn).
  - Gọi đồng thời các dịch vụ để gộp và trả về dữ liệu của: thông tin cá nhân người dùng (`user`), danh sách danh mục (`categories`), danh sách nhà hàng gần nhất (`restaurants`) và các bộ đếm (`counters`). Nếu không có token, bỏ qua thông tin user và trả về bộ đếm bằng 0.
