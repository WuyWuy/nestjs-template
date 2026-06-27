# FoodDeliveryBE API Docs (for FE)

Tài liệu này được viết theo **contract thực tế từ code backend hiện tại** để FE call API ổn định và parse response đúng.

---

## 1) Base Info

- Base URL: `http://<host>:4000/api`
- Swagger UI: `GET /api/docs`
- Auth header:
  - `Authorization: Bearer <access_token>`
- Mặc định backend dùng:
  - `ValidationPipe({ transform: true, whitelist: true })`
  - Global response interceptor
  - Global HTTP exception filter

---

## 2) Response Contract (RẤT QUAN TRỌNG)

Backend có global interceptor `TransformInterceptor`, vì vậy phản hồi thường được bọc theo dạng:

### 2.1 Success chuẩn

```json
{
  "success": true,
  "data": {}
}
```

### 2.2 Success có phân trang (khi service trả `{ data, pagination }`)

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 100
  }
}
```

### 2.3 Trường hợp controller tự trả `success/message/data`

Một số endpoint controller tự return object có `success/message/data`, interceptor vẫn bọc thêm 1 lớp:

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Save search history successfully",
    "data": { "...": "..." }
  }
}
```

**=> FE cần parse theo endpoint, không assume tất cả đều cùng cấp.**

---

## 3) Error Contract

Khi lỗi HTTP exception, response theo filter:

```json
{
  "success": false,
  "path": "/api/auth/login",
  "notifi": "Cloudian Notification!!!",
  "statusCode": 400,
  "message": "Validation failed"
}
```

`message` có thể là:
- string
- string[]
- object tùy loại exception

---

## 4) Enum dùng chung

- `Role`: `ADMIN | BUSINESS | CUSTOMER`
- `OrderStatus`: `PENDING | CONFIRMED | PREPARING | DELIVERING | DELIVERED | CANCELLED`
- `PaymentMethod`: `MOMO | CASH`
- `PaymentStatus`: `UNPAID | FAILED | SOLVING | DONE`
- `VoucherType`: `PERCENT | MONEY`
- `VoucherStatus`: `APPLYING | ENDED`
- `NotificationType`: `SYSTEM | ORDER | PAYMENT | PROMOTION | CHAT`
- `RestaurantApprovalStatus`: `PENDING | APPROVED | REJECTED`

---

## 5) Auth APIs (`/auth`)

## `GET /auth/me` (Bearer)
- Auth: required
- Response data:
```json
{
  "success": true,
  "data": {
    "id": 10,
    "email": "user@example.com",
    "roles": ["CUSTOMER"]
  }
}
```

## `POST /auth/register`
- Body:
```json
{
  "email": "user@example.com",
  "password": "123456",
  "phone": "0901234567",
  "birthday": "2000-01-01",
  "name": "Nguyen Van A"
}
```
- Response: object đăng ký + trạng thái OTP (tùy service).

## `GET /auth/verify?otp=123456`
- Query: `otp` (string)
- Response: kết quả verify tài khoản.

## `POST /auth/login`
- Body:
```json
{
  "phone": "0901234567",
  "password": "123456"
}
```
- Response (thực tế thường có token):
```json
{
  "success": true,
  "data": {
    "accessToken": "jwt-access-token",
    "refreshToken": "jwt-refresh-token",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "roles": ["CUSTOMER"]
    }
  }
}
```

## `POST /auth/refresh`
- Body:
```json
{
  "refreshToken": "jwt-refresh-token"
}
```
- Response: access token mới.

## `POST /auth/change-password`
- Body (1 trong 2 email/phone):
```json
{
  "email": "user@example.com",
  "currentPassword": "123456",
  "newPassword": "1234567"
}
```

## `POST /auth/reset-email` (Bearer)
- Body:
```json
{
  "phone": "0901234567",
  "password": "123456"
}
```

## `GET /auth/reset-email/verify?email=...&otp=...`
- Query: `email`, `otp`

## `POST /auth/forgot-password`
- Body:
```json
{
  "email": "user@example.com"
}
```

## `POST /auth/verify-reset-otp`
- Body:
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```
- Response: thường trả reset token.

## `POST /auth/reset-password`
- Body:
```json
{
  "resetToken": "jwt-reset-token",
  "newPassword": "1234567"
}
```

## Social login
- `POST /auth/login-facebook`
- `POST /auth/login-google`
- `POST /auth/login-social`

Body social:
```json
{
  "provider": "google",
  "accessToken": "provider-token"
}
```
hoặc
```json
{
  "provider": "facebook",
  "code": "provider-auth-code"
}
```

---

## 6) User APIs (`/user`)

## `POST /user` (Bearer, multipart/form-data)
- Upload ảnh profile
- Field file: `data`
- Response:
```json
{
  "success": true,
  "data": {
    "url": "https://..."
  }
}
```

## `GET /user` (ADMIN)
- Response: danh sách users.

## `GET /user/profile` (Bearer)
- Response: profile hiện tại.

## `PUT /user/profile` (CUSTOMER/BUSINESS, multipart/form-data)
- Fields: `name?`, `phone?`, `birthday?`, `avatar?`(file)

### User Address sub APIs

## `POST /user/address` (CUSTOMER)
- Body:
```json
{
  "title": "Nhà riêng",
  "address": {
    "title": "Nhà riêng",
    "latitude": 10.776889,
    "longitude": 106.700806,
    "fullText": "123 Nguyen Hue, District 1, HCM"
  }
}
```

## `GET /user/address/all`
## `GET /user/address/:addressId`
## `PUT /user/address/:addressId`
## `DELETE /user/address/:addressId`

### User reviews
## `GET /user/reviews?limit=20&offset=0` (CUSTOMER)
- Lưu ý: endpoint này controller return sẵn object chứa `success/data`, interceptor sẽ bọc thêm.

---

## 7) Address APIs (`/address`)

## `POST /address`
- Body:
```json
{
  "title": "Nhà riêng",
  "latitude": 10.776889,
  "longitude": 106.700806,
  "fullText": "123 Nguyen Hue, District 1, HCM"
}
```

## `GET /address?limit=20&offset=0&keyword=...`
## `GET /address/search?...` (Bearer)
## `GET /address/:addressId` (Bearer)
## `PATCH /address/:addressId` (ADMIN)
## `DELETE /address/:addressId` (ADMIN)

---

## 8) Category APIs (`/categories`)

## `GET /categories`
- Query: `limit`, `offset`, `keyword`, `isActive`

## `GET /categories/:id`

## `POST /categories` (ADMIN/BUSINESS, multipart/form-data)
- Fields:
  - `name` (required)
  - `description` (required)
  - `image` (file)
  - `sortOrder`, `displayOrder`, `isActive`

## `PATCH /categories/:id` (ADMIN/BUSINESS, multipart/form-data)
## `DELETE /categories/:id` (ADMIN/BUSINESS)

---

## 9) Restaurant APIs (`/restaurant`)

### Business/Vendor

## `POST /restaurant/business/register` (CUSTOMER)
- Đổi role thành BUSINESS, client nên refresh token sau call thành công.

## `GET /restaurant/my` (ADMIN/BUSINESS)
## `POST /restaurant/manage` (ADMIN/BUSINESS, multipart)
## `PATCH /restaurant/manage/:restaurantId` (ADMIN/BUSINESS, multipart)
- file fields:
  - `image` (max 1)
  - `coverImage` (max 1)
- data fields:
  - `name`, `description`, `phone`, `addressId`, `deliveryFee`, `minimumOrder`, `estimatedDeliveryTime`

## `GET /restaurant/manage/:restaurantId/dashboard?range=day|week|month`
## `GET /restaurant/generate-dashboard?restaurantId=1`
## `GET /restaurant/manage/:restaurantId/revenue?startDate&endDate`
## `GET /restaurant/manage/:restaurantId/revenue-details?startDate&endDate&limit&offset`
## `PATCH /restaurant/manage/:restaurantId/status`
- Body:
```json
{
  "isOpen": true
}
```

### Public/Customer

## `GET /restaurant`
- Query:
  - `limit`, `offset`, `keyword`, `categoryId`
  - `latitude`, `longitude`
  - `minRating`, `sortBy`, `isActive`

## `GET /restaurant/detail/:restaurantId`
## `GET /restaurant/menu/:restaurantId?keyword=&categoryId=`
## `GET /restaurant/reviews/:restaurantId`

## `POST /restaurant/reviews/:restaurantId` (CUSTOMER)
- Body:
```json
{
  "orderId": 162432,
  "vote": 5,
  "comment": "Thuc an ngon",
  "tags": ["Delicious food", "Fast delivery"]
}
```
`tags` chỉ nhận các giá trị allowed:
- `Delicious food`
- `Fast delivery`
- `Careful packaging`
- `Friendly attitude`
- `Reasonable price`
- `Food arrived hot`
- `Fresh ingredients`
- `Accurate order`
- `Large portions`

## `PATCH /restaurant/reviews/:reviewId` (CUSTOMER)
## `DELETE /restaurant/reviews/:reviewId` (Bearer)
## `GET /restaurant/manage/:restaurantId/reviews` (ADMIN/BUSINESS)
## `POST /restaurant/reviews/:reviewId/reply` (ADMIN/BUSINESS)
```json
{
  "reply": "Cam on ban da ung ho"
}
```
## `GET /restaurant/manage/:restaurantId/stats/ratings` (ADMIN/BUSINESS)

---

## 10) Food APIs (`/food`)

## `GET /food`
- Query: `limit`, `offset`, `name`, `categoryId`, `restaurantId`, `minPrice`, `maxPrice`, `minRating`, `sortBy`

## `GET /food/ingredients`
## `GET /food/:id`

## `POST /food/:id/ratings` (CUSTOMER)
```json
{
  "vote": 5,
  "comment": "Ngon",
  "orderId": 1
}
```

## `GET /food/:id/ratings`

### Manage food

## `POST /food/manage` (ADMIN/BUSINESS, multipart/form-data)
## `PATCH /food/manage/:id` (ADMIN/BUSINESS, multipart/form-data)
- fields:
  - `name`, `description`, `categoryId`, `price`, `image(file)`, `label`, `restaurantId`, `isAvailable`
  - `sizes`: gửi chuỗi JSON, ví dụ:
    - `[{"sizeId":1,"price":9,"isDefault":true},{"sizeId":2,"price":12}]`
  - `ingredientIds`: gửi `1,2,3` hoặc JSON string array

## `DELETE /food/manage/:id` (ADMIN/BUSINESS)

---

## 11) Cart APIs (`/cart`) (CUSTOMER)

## `GET /cart`
- Response:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "items": [
      {
        "id": 10,
        "foodId": 1,
        "quantity": 2,
        "foodSizeId": 1
      }
    ],
    "totalAmount": 18
  }
}
```

## `POST /cart`
```json
{
  "foodId": 1,
  "quantity": 2,
  "foodSizeId": 1
}
```

## `PATCH /cart/:cartItemId`
```json
{
  "quantity": 3
}
```

## `DELETE /cart/:cartItemId`
## `DELETE /cart` (clear toàn bộ)

---

## 12) Order APIs (`/orders`)

## `POST /orders` (CUSTOMER)
- Body mẫu dùng địa chỉ lưu:
```json
{
  "restaurantId": 1,
  "voucherId": 1,
  "savedAddressId": 1,
  "orderFoods": [
    {
      "foodId": 1,
      "quantity": 2,
      "fullText": "No onions",
      "foodSizeId": 1
    }
  ],
  "note": "Please call before delivery",
  "paymentMethod": "CASH",
  "clearCartAfterOrder": true
}
```
- Body mẫu dùng địa chỉ mới:
```json
{
  "restaurantId": 1,
  "customAddress": {
    "title": "Nhà riêng",
    "latitude": 10.776889,
    "longitude": 106.700806,
    "fullText": "123 Nguyen Hue, District 1"
  },
  "orderFoods": [
    {
      "foodId": 2,
      "quantity": 1
    }
  ],
  "paymentMethod": "MOMO"
}
```

## `POST /orders/:orderId/reorder` (CUSTOMER)
## `GET /orders?limit=20&offset=0&status=PENDING`
## `GET /orders/:orderId`
## `GET /orders/:orderId/status`
## `DELETE /orders/:orderId`
## `POST /orders/:orderId/cancel`
## `POST /orders/:orderId/confirm-received` (CUSTOMER)
## `PATCH /orders/:orderId`
```json
{
  "status": "PREPARING"
}
```

---

## 13) Payment APIs (`/payment`)

## `POST /payment/check-payment`
```json
{
  "momoOrderId": "MOMO-ORDER-001",
  "status": "DONE"
}
```

## `GET /payment/:orderId`
## `PATCH /payment/manage/:paymentId/confirm` (ADMIN/BUSINESS)

---

## 14) Voucher APIs (`/vouchers`)

## `GET /vouchers` (ADMIN/BUSINESS)
- Query: `limit`, `offset`, `restaurantId`, `code`, `keyword`, `status`

## `GET /vouchers/code/:code?restaurantId=1`
## `GET /vouchers/suitable/:restaurantId?cost=50000` (Bearer)
## `GET /vouchers/:id`

## `POST /vouchers` (ADMIN/BUSINESS, multipart/form-data)
## `PATCH /vouchers/:id` (ADMIN/BUSINESS, multipart/form-data)
- fields:
  - `name`, `code`, `description`, `image(file)`
  - `sale`, `type`, `status`, `restaurantId`
  - `minimumOrderAmount`, `maximumDiscountAmount`
  - `startAt`, `endAt` (ISO date string)

## `DELETE /vouchers/:id` (ADMIN/BUSINESS)

---

## 15) Notification APIs (`/notification`)

Tất cả endpoint module này dùng Bearer.

## `POST /notification`
```json
{
  "title": "Order update",
  "body": "Your order is being prepared.",
  "type": "ORDER"
}
```

## `GET /notification/me?limit=20&offset=0&type=ORDER&read=true`
## `GET /notification/me/unread-count`
## `PATCH /notification/:notificationId/read`
## `PATCH /notification/read-all`
## `GET /notification/test` (test route)
## `DELETE /notification/:notificationId`
- Controller return:
```json
{
  "message": "Notification delete successfullt"
}
```
- Sau interceptor, FE sẽ nhận:
```json
{
  "success": true,
  "data": {
    "message": "Notification delete successfullt"
  }
}
```

---

## 16) Device APIs (`/device`)

## `POST /device` (Bearer)
```json
{
  "deviceToken": "fcm-device-token-example",
  "platform": "ios"
}
```

---

## 17) Search APIs (`/search`)

## `GET /search`
- Query:
  - `q` (required)
  - `lat`, `lng`
  - `limit`, `offset`
  - `sort`: `distance | rating | price_low_to_high`
  - `categoryId`

## `GET /search/suggestions?lat&lng&limit`
## `GET /search/trending?limit`
- Lưu ý: controller tự return object có `success/data`, interceptor sẽ bọc thêm một lớp `data`.

### History (Bearer)

## `GET /search/history`
## `POST /search/history`
```json
{
  "keyword": "bun cha"
}
```
## `DELETE /search/history`
## `DELETE /search/history/:id`

---

## 18) Favorite APIs (no controller prefix)

## `POST /restaurant/:restaurantId/like` (CUSTOMER)
## `GET /user/favorites/restaurants?limit=20&offset=0` (CUSTOMER)
## `GET /restaurant/:restaurantId/like-status` (Bearer)

---

## 19) Conversation APIs (`/conversation`)

## `GET /conversation/me` (Bearer)
## `GET /conversation/user/:userId` (ADMIN)
## `POST /conversation` (CUSTOMER)
```json
{
  "orderId": 1,
  "sellerId": 2
}
```

## `GET /conversation/detail?orderId=1&limit=20&offset=0`
## `GET /conversation/:conversationId?limit=20&offset=0`

## `POST /conversation/upload-image` (Bearer, multipart)
- file field: `file`
- response:
```json
{
  "success": true,
  "data": {
    "imageUrl": "https://..."
  }
}
```

## `PATCH /conversation/:conversationId/read`
- controller return:
```json
{
  "success": true,
  "message": "Marked all messages as read"
}
```
- interceptor bọc lại:
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Marked all messages as read"
  }
}
```

---

## 20) Home APIs (`/home`)

## `GET /home/counters` (Bearer)
- data thường gồm số lượng cart item và unread chat/message.

## `GET /home/dashboard?lat=10.77&lng=106.70`
- optional auth

---

## 21) Admin APIs (`/admin`) - ADMIN only

## `GET /admin/dashboard`
## `GET /admin/revenue`
## `GET /admin/dashboard/revenue-details?limit&offset&startDate&endDate`
## `GET /admin/users?limit&offset&role&keyword`

## `POST /admin/users/:userId/block`
```json
{
  "isBlocked": true,
  "reason": "Violation"
}
```

## `POST /admin/users/:userId/reset-password`
```json
{
  "sendEmail": true
}
```

## `PATCH /admin/restaurant/:restaurantId/status`
```json
{
  "isActive": true
}
```

## `PATCH /admin/restaurants/:restaurantId/approval`
```json
{
  "status": "APPROVED"
}
```

## `GET /admin/audit-logs?limit&offset&action&entityType&actorId`
## `GET /admin/payments?limit&offset&paymentStatus&method&userId&restaurantId`

## `PATCH /admin/payments/:paymentId`
```json
{
  "paymentStatus": "DONE"
}
```

---

## 22) Init / Health

## `GET /`
- API root

## `GET /email`
- gửi email test template

## `GET /health/liveness`
## `GET /health/readness` (đúng theo code hiện tại)

---

## 23) FE Parsing Recommendations (nên áp dụng ngay)

1. Viết helper parse:
- đọc `res.success`
- lấy payload chính từ `res.data`
- nếu `res.pagination` tồn tại thì dùng cho phân trang

2. Với các endpoint controller tự return `success/message/data`:
- payload thực ở `res.data.data` (không phải `res.data`)

3. Với endpoint trả primitive/string:
- interceptor bọc vào `res.data` (string)

4. Error handling:
- fallback theo `message` dạng string hoặc array
- luôn log thêm `path` để debug route

---

## 24) Ví dụ TS helper cho FE

```ts
type ApiEnvelope<T = any> = {
  success: boolean;
  data: T;
  pagination?: {
    limit: number;
    offset: number;
    total: number;
  };
};

export function unwrapData<T>(res: ApiEnvelope<T | { success?: boolean; data?: any }>): T {
  const d: any = res.data;
  if (d && typeof d === "object" && "data" in d && "success" in d) {
    return d.data as T; // case controller tự bọc success/data
  }
  return d as T;
}
```

---

Nếu cần, mình có thể làm tiếp bản `Apidocs.postman.md` (mapping thẳng sang collection request-by-request) để FE/QA import và test nhanh toàn bộ flow.
