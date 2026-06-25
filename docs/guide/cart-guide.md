# Hướng dẫn manual test Cart đa nhà hàng

## 1. Chuẩn bị database

Nếu có thể xóa toàn bộ dữ liệu development:

```bash
bunx prisma migrate reset
```

Nếu muốn giữ dữ liệu hiện tại:

```bash
bunx prisma migrate dev
bun prisma db seed
```

Khởi động backend:

```bash
bun run dev
```

Seed tạo sẵn:

- Customer 1: cart gồm Burger Town và Rice Express.
- Customer 2: cart gồm Rice Express và Gourmet World.
- Các cart item có default `foodSizeId` và `fullText`.

## 2. Đăng nhập

### Customer 1

```text
phone: 0900000003
password: customer123
```

### Customer 2

```text
phone: 0900000004
password: customer456
```

Request đăng nhập:

```http
POST /api/auth/login
```

```json
{
  "phone": "0900000003",
  "password": "customer123"
}
```

Lấy `accessToken` từ response và gửi kèm các request tiếp theo:

```text
Authorization: Bearer <accessToken>
```

## 3. Kiểm tra cart đa nhà hàng

Đăng nhập bằng Customer 1 và gọi:

```http
GET /api/cart
```

Kết quả mong đợi:

- `totalItems = 3`.
- `subtotal = 26`.
- `restaurantGroups.length = 2`.
- Burger Town có 2 Classic Cheeseburger.
- Rice Express có 1 Grilled Chicken Rice.
- `restaurant = null`.
- `items` vẫn chứa flat list của tất cả món.
- Mỗi item có `foodSizeId`, `sizeName` và `fullText`.

Kiểm tra badge:

```http
GET /api/home/counters
```

Kết quả mong đợi:

```text
cartItemCount = 3
```

## 4. Thêm món từ nhà hàng khác

1. Đăng nhập Customer 2 và gọi `GET /api/cart`.
2. Sao chép `foodId` và `foodSizeId` của một món thuộc Gourmet World.
3. Đăng nhập lại Customer 1 và gửi:

```http
POST /api/cart
```

```json
{
  "foodId": "<GOURMET_FOOD_ID>",
  "foodSizeId": "<GOURMET_FOOD_SIZE_ID>",
  "quantity": 1,
  "fullText": "Manual multi-restaurant test"
}
```

Kết quả mong đợi:

- Không nhận lỗi do cart đang chứa nhà hàng khác.
- `restaurantGroups.length = 3`.
- Burger Town và Rice Express vẫn còn nguyên.

Gửi lại cùng request để kiểm tra quantity của món được cộng dồn.

## 5. Xóa một nhóm nhà hàng

Lấy `restaurant.id` từ một group trong response `GET /api/cart`, sau đó gọi:

```http
DELETE /api/cart/restaurant/:restaurantId
```

Kết quả mong đợi:

- Chỉ group được chọn bị xóa.
- Các group khác không thay đổi.
- Gọi lại cùng endpoint vẫn trả HTTP `200`.

## 6. Checkout chỉ xóa nhà hàng vừa order

Chạy lại seed để khôi phục dữ liệu ban đầu, đăng nhập Customer 1 và gọi
`GET /api/cart`.

Sao chép `restaurantId`, `foodId` và `foodSizeId` của Burger Town rồi gửi:

```http
POST /api/orders
```

```json
{
  "restaurantId": "<BURGER_TOWN_ID>",
  "customAddress": {
    "title": "Manual Test",
    "latitude": 10.786749,
    "longitude": 106.690529,
    "fullText": "45 Vo Van Tan, District 3"
  },
  "orderFoods": [
    {
      "foodId": "<CHEESEBURGER_ID>",
      "foodSizeId": "<CHEESEBURGER_SIZE_ID>",
      "quantity": 2,
      "fullText": "No onions"
    }
  ],
  "paymentMethod": "CASH",
  "clearCartAfterOrder": false
}
```

Sau khi order thành công, gọi lại:

```http
GET /api/cart
```

Kết quả mong đợi:

- Group Burger Town đã bị xóa.
- Group Rice Express vẫn còn.
- `totalItems = 1`.

Có thể bỏ hẳn `clearCartAfterOrder`; hành vi mặc định cũng là chỉ xóa group
của nhà hàng vừa order.

## 7. Kiểm tra xóa toàn bộ cart sau checkout

Chạy lại seed và tạo order Burger Town như bước trước, nhưng gửi:

```json
{
  "clearCartAfterOrder": true
}
```

Sau đó gọi `GET /api/cart`. Kết quả mong đợi:

```json
{
  "totalItems": 0,
  "subtotal": 0,
  "restaurant": null,
  "restaurantGroups": [],
  "items": []
}
```

## 8. Kiểm tra validation khi checkout

### Food không thuộc nhà hàng

Dùng `restaurantId` của Burger Town nhưng gửi `foodId` thuộc Rice Express.

Kết quả mong đợi: HTTP `400`.

```text
Foods do not belong to the selected restaurant
```

### Quantity không khớp cart

Gửi quantity lớn hơn quantity hiện có trong cart.

Kết quả mong đợi: HTTP `400`.

```text
Cart item mismatch or insufficient quantity
```

### Cart không có món của nhà hàng

Gửi order cho một nhà hàng không có item tương ứng trong cart.

Kết quả mong đợi: HTTP `400`.

```text
No items from this restaurant in cart
```

## 9. Kiểm tra reorder theo cơ chế merge

Chạy lại seed và đăng nhập Customer 1:

1. Gọi `GET /api/orders?status=history`.
2. Chọn order đã giao của Burger Town.
3. Gọi:

```http
POST /api/orders/:orderId/reorder
```

Kết quả mong đợi:

- Các item Rice Express vẫn còn trong cart.
- Item Burger Town được cộng dồn hoặc tạo mới.
- Response có `addedCount`.
- `skippedItems` là mảng rỗng với dữ liệu seed hiện tại.

## 10. Khôi phục dữ liệu giữa các test case

Seed dùng cơ chế replace cart items nên có thể chạy lại để đưa cart về trạng
thái ban đầu:

```bash
bun prisma db seed
```

Sau khi seed:

- Customer 1 có tổng quantity là `3`, thuộc 2 nhà hàng.
- Customer 2 có tổng quantity là `4`, thuộc 2 nhà hàng.
