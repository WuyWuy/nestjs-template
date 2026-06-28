# PRD Phase 2 - Backend API Specifications & Upgrades

Tài liệu này tổng hợp các API hiện có và các yêu cầu bổ sung/chỉnh sửa cần thiết từ phía Backend để hoàn thiện và nâng cấp các phân hệ tính năng trên ứng dụng FoodDelivery.

---

## Phân hệ 1: Tìm kiếm & Gợi ý (Search Module)

## 1. Tìm kiếm hợp nhất (Unified Search)
Dùng khi User bắt đầu nhập từ khóa và nhấn tìm kiếm hoặc sau khi debounce từ ô tìm kiếm. Kết quả trả về chứa cả danh sách món ăn (`foods`) và nhà hàng (`restaurants`) thỏa mãn điều kiện.

- **Endpoint:** `GET /api/search`
- **Authentication:** Public (Không bắt buộc Token)
- **Query Parameters:**
  - `q` (string, required): Từ khóa tìm kiếm (tên món ăn, tên nhà hàng, hoặc label/tags).
  - `lat` (number, optional): Vĩ độ hiện tại của User để tính khoảng cách và sắp xếp.
  - `lng` (number, optional): Kinh độ hiện tại của User để tính khoảng cách và sắp xếp.
  - `limit` (number, default: 20): Số lượng bản ghi tối đa trả về cho mỗi loại (foods và restaurants riêng biệt).
  - `offset` (number, default: 0): Số bản ghi bỏ qua cho phân trang (áp dụng độc lập cho mỗi loại).
  - `sort` (string, optional): Tiêu chí sắp xếp. Hỗ trợ các giá trị:
    - `distance`: Sắp xếp theo khoảng cách từ gần đến xa (yêu cầu truyền `lat` và `lng`).
    - `rating`: Sắp xếp theo điểm đánh giá từ cao đến thấp.
    - `price_low_to_high`: Sắp xếp món ăn theo giá tăng dần (chỉ áp dụng cho `foods`, danh sách `restaurants` giữ thứ tự mặc định).
  - `categoryId` (number, optional): Lọc theo danh mục món ăn cụ thể.

- **Response Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "foods": [
      {
        "id": 1,
        "name": "Bún Chả Hà Nội",
        "price": 45000.0,
        "imageUrl": "https://example.com/buncha.jpg",
        "restaurantId": 101,
        "restaurantName": "Bún Chả Hương Liên",
        "rating": 4.8,
        "soldCount": 120,
        "promoTag": "Giảm 10%"
      }
    ],
    "restaurants": [
      {
        "id": 101,
        "name": "Bún Chả Hương Liên",
        "imageUrl": "https://example.com/huonglien.jpg",
        "averageRating": 4.8,
        "deliveryFee": 15000.0,
        "distance": 1.2,
        "tags": ["Bún chả", "Đặc sản"],
        "hasVoucher": true
      }
    ]
  }
}
```

- **Business Logic & Lọc dữ liệu:**
  - **Tìm kiếm Món ăn (Foods):**
    - Điều kiện tìm kiếm: Tên món ăn chứa từ khóa `q` (không phân biệt chữ hoa/thường) HOẶC label chứa `q`.
    - Lọc theo `categoryId` nếu có.
    - `restaurantName` và `restaurantId` lấy từ liên kết với bảng `Restaurant`.
    - `promoTag`: Lấy thông tin voucher đang hoạt động có phần trăm giảm lớn nhất của nhà hàng đó (ví dụ: "Giảm 20%").
    - `soldCount`: Tổng số lượng của món ăn này đã được giao thành công (tổng `quantity` trong `OrderFood` của các đơn hàng có trạng thái `DELIVERED`).
    - Sắp xếp:
      - Nếu `sort == 'distance'`: Sắp xếp theo khoảng cách từ địa chỉ nhà hàng đến `lat/lng` của user (tăng dần).
      - Nếu `sort == 'rating'`: Sắp xếp theo điểm đánh giá của món ăn (`Food.rating` hoặc trung bình cộng số sao, giảm dần).
      - Nếu `sort == 'price_low_to_high'`: Sắp xếp theo giá của món ăn (tăng dần).
      - Mặc định: Sắp xếp theo ngày cập nhật mới nhất.
    - Phân trang: Áp dụng `take: limit`, `skip: offset`.
  - **Tìm kiếm Nhà hàng (Restaurants):**
    - Điều kiện tìm kiếm: Tên nhà hàng chứa từ khóa `q` (không phân biệt chữ hoa/thường) HOẶC nhà hàng có món ăn thỏa mãn điều kiện tìm kiếm món ăn ở trên.
    - Lọc theo `categoryId` nếu có (nhà hàng có bán món thuộc danh mục đó).
    - `distance`: Khoảng cách thực tế tính bằng km nếu có truyền `lat/lng`.
    - `tags`: Danh sách tên các danh mục món ăn (Category) mà nhà hàng đó phục vụ.
    - `hasVoucher`: `true` nếu nhà hàng có ít nhất một voucher đang áp dụng (`status: APPLYING` và nằm trong khoảng thời gian hiệu lực), ngược lại là `false`.
    - Sắp xếp:
      - Nếu `sort == 'distance'`: Sắp xếp theo khoảng cách (tăng dần).
      - Nếu `sort == 'rating'`: Sắp xếp theo điểm đánh giá trung bình `averageRating` (giảm dần).
      - Nếu `sort == 'price_low_to_high'` hoặc mặc định: Sắp xếp theo ngày tạo mới nhất.
    - Phân trang: Áp dụng `take: limit`, `skip: offset`.

---

## 2. Gợi ý mặc định (Search Suggestions)
Dùng để hiển thị dữ liệu "Suggested Restaurants" và "Popular Fast Food" khi thanh search của người dùng còn trống.

- **Endpoint:** `GET /api/search/suggestions`
- **Authentication:** Public
- **Query Parameters:**
  - `lat` (number, optional): Vĩ độ hiện tại của User.
  - `lng` (number, optional): Kinh độ hiện tại của User.
  - `limit` (number, default: 10): Số lượng gợi ý tối đa cho mỗi mục.

- **Response Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "foods": [
      {
        "id": 1,
        "name": "Burger phô mai",
        "price": 5.5,
        "imageUrl": "https://example.com/burger.jpg",
        "restaurantId": 101,
        "restaurantName": "Burger Town",
        "rating": 4.8,
        "soldCount": 150,
        "promoTag": "Giảm 10%"
      }
    ],
    "restaurants": [
      {
        "id": 101,
        "name": "Burger Town",
        "imageUrl": "https://example.com/burger-town.jpg",
        "averageRating": 4.8,
        "deliveryFee": 1.5,
        "distance": 2.3,
        "tags": ["Burger", "Fast Food"],
        "hasVoucher": true
      }
    ]
  }
}
```

- **Business Logic:**
  - **Mục món ăn gợi ý (Foods):**
    - Lấy danh sách các món ăn bán chạy nhất hệ thống: Tính tổng số lượng bán (`quantity`) từ bảng `OrderFood` liên kết với các `Order` có trạng thái là `DELIVERED`.
    - Sắp xếp giảm dần theo số lượng bán (`soldCount`) và lấy số lượng tương ứng với `limit`.
  - **Mục nhà hàng gợi ý (Restaurants):**
    - Điều kiện lọc cơ bản: Nhà hàng đã được phê duyệt (`approved: true`) và (có ít nhất một Voucher đang hoạt động (`status: APPLYING` và thời gian hiện tại nằm trong khoảng `startAt` - `endAt`) HOẶC có điểm đánh giá trung bình `averageRating >= 4.5`).
    - Gợi ý theo vị trí (nếu có `lat/lng` truyền lên):
      - Chỉ lọc ra các nhà hàng thỏa mãn điều kiện lọc cơ bản nằm trong bán kính **10km** xung quanh tọa độ của người dùng (tính toán bằng công thức Haversine).
      - Sắp xếp các nhà hàng này theo khoảng cách tăng dần (gần nhất lên đầu).
      - *Trường hợp đặc biệt (Fallback):* Nếu không truyền tọa độ `lat/lng`, hoặc nếu có truyền nhưng không tìm thấy bất kỳ nhà hàng nào thỏa mãn trong bán kính 10km, hệ thống sẽ bỏ qua bộ lọc khoảng cách và gợi ý các nhà hàng thỏa mãn điều kiện lọc cơ bản trên toàn hệ thống (sắp xếp theo điểm đánh giá trung bình giảm dần hoặc ngày tạo mới nhất).

---

## 3. Search History (Lịch sử tìm kiếm)
Quản lý các từ khóa User đã tìm kiếm.

### Cấu trúc cơ sở dữ liệu đề xuất (Database Schema):
Thêm model `SearchHistory` vào DB:
```prisma
model SearchHistory {
    id        Int      @id @default(autoincrement())
    userId    Int
    user      User     @relation(fields: [userId], references: [id])
    keyword   String
    createdAt DateTime @default(now())

    @@unique([userId, keyword])
    @@index([userId])
}
```

### 3.1. Lấy danh sách lịch sử tìm kiếm (Get History)
- **Endpoint:** `GET /api/search/history`
- **Authentication:** Bắt buộc (Bearer Token)
- **Response Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "keyword": "bún chả",
      "createdAt": "2026-06-22T13:49:30Z"
    }
  ]
}
```
- **Logic:** Lấy danh sách lịch sử tìm kiếm của `userId` hiện tại từ bảng `SearchHistory`, sắp xếp theo `createdAt` giảm dần.

### 3.2. Lưu từ khóa vào lịch sử (Save History)
- **Endpoint:** `POST /api/search/history`
- **Authentication:** Bắt buộc (Bearer Token)
- **Body:**
```json
{
  "keyword": "bún chả"
}
```
- **Response Success (200 OK):**
```json
{
  "success": true,
  "message": "Save search history successfully",
  "data": {
    "id": 1,
    "keyword": "bún chả",
    "createdAt": "2026-06-22T13:49:30Z"
  }
}
```
- **Logic:**
  - Thực hiện Upsert trên cặp `(userId, keyword)`: nếu từ khóa chưa tồn tại thì tạo mới; nếu đã tồn tại thì cập nhật `createdAt = new Date()`.

### 3.3. Xóa toàn bộ lịch sử tìm kiếm (Clear All History)
- **Endpoint:** `DELETE /api/search/history`
- **Authentication:** Bắt buộc (Bearer Token)
- **Response Success (200 OK):**
```json
{
  "success": true,
  "message": "Clear search history successfully"
}
```
- **Logic:** Hard delete toàn bộ bản ghi trong bảng `SearchHistory` có `userId` bằng ID của user hiện tại.

### 3.4. Xóa một từ khóa cụ thể trong lịch sử (Delete Single Item)
- **Endpoint:** `DELETE /api/search/history/{id}`
- **Authentication:** Bắt buộc (Bearer Token)
- **Path Parameters:**
  - `id` (number): ID của bản ghi lịch sử tìm kiếm cần xóa.
- **Response Success (200 OK):**
```json
{
  "success": true,
  "message": "Delete history item successfully"
}
```
- **Logic:** Kiểm tra bản ghi lịch sử tìm kiếm có tồn tại và thuộc về `userId` hiện tại hay không. Nếu có, thực hiện hard delete bản ghi đó. Nếu không, trả về `403 Forbidden` hoặc `404 Not Found`.

---

## 4. Từ khóa thịnh hành (Trending Keywords)
- **Endpoint:** `GET /api/search/trending`
- **Authentication:** Public
- **Query Parameters:**
  - `limit` (number, default: 10): Số lượng từ khóa thịnh hành tối đa muốn lấy.
- **Response Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "keyword": "trà sữa",
      "searchCount": 150
    },
    {
      "keyword": "pizza",
      "searchCount": 98
    }
  ]
}
```
- **Logic:** 
  - Đếm và gom nhóm (groupBy) theo `keyword` trong bảng `SearchHistory` có `createdAt` trong vòng 7 ngày qua (tính từ thời điểm hiện tại trở về trước 7 ngày).
  - Sắp xếp theo số lượng (count) giảm dần và lấy ra số lượng bản ghi tương ứng với `limit`.

---

## 5. Yêu cầu chung về Dữ liệu (DTO)

Để UI hiển thị đồng nhất, BE cần đảm bảo Schema trả về chứa các thông tin sau:

### Food Object:
```json
{
  "id": "string/int",
  "name": "string",
  "price": 100.0,
  "imageUrl": "string",
  "restaurantId": "string",
  "restaurantName": "string",
  "rating": 4.5,
  "soldCount": 100,
  "promoTag": "string (null nếu không có)"
}
```

### Restaurant Object:
```json
{
  "id": "string/int",
  "name": "string",
  "imageUrl": "string",
  "averageRating": 4.8,
  "deliveryFee": 1.5,
  "distance": 2.3, // km
  "tags": ["Burger", "Fast Food"],
  "hasVoucher": true
}
```

## Phân hệ 2: Đánh giá & Phản hồi (Rating & Review)

Tài liệu này mô tả luồng hoạt động, cấu trúc cơ sở dữ liệu và danh sách chi tiết các API cho tính năng Đánh giá và Nhận xét dành cho cả Khách hàng (Customer) và Nhà hàng (Restaurant/Vendor).

---

## 1. Luồng nghiệp vụ (Workflow)

### A. Phía Khách hàng (Customer)
1. **Điều kiện:** Người dùng hoàn thành đơn hàng (Trạng thái đơn hàng là `DELIVERED`).
2. **Truy cập:** Vào màn hình `My Orders` -> `History` -> Chọn đơn hàng -> Nhấn nút `Rate`.
3. **Nhập liệu:** 
    - Chọn số sao đánh giá (từ 1 đến 5 sao).
    - Chọn các thẻ gợi ý (Tags) có sẵn (ví dụ: "Món ăn ngon", "Giao hàng nhanh", "Đóng gói cẩn thận", "Thái độ tốt").
    - Viết nhận xét (không bắt buộc).
4. **Xử lý:** Gọi API gửi đánh giá. Sau khi đánh giá thành công:
    - Lưu điểm đánh giá, bình luận và các thẻ tag.
    - Đơn hàng được liên kết với bản ghi đánh giá này. Nếu kiểm tra lại đơn hàng sẽ thấy trạng thái đã đánh giá.
5. **Quản lý:** Người dùng có thể xem lại các đánh giá đã viết tại màn hình `My Reviews` trong Profile cá nhân và có quyền cập nhật hoặc xóa đánh giá.

### B. Phía Nhà hàng (Restaurant/Vendor)
1. **Theo dõi:** Xem tổng điểm đánh giá trung bình và thống kê sao tại màn hình **Dashboard**.
2. **Quản lý:** Truy cập màn hình **Reviews** để xem danh sách chi tiết tất cả nhận xét của khách hàng.
3. **Phản hồi:** Chủ cửa hàng có thể phản hồi (Reply) lại đánh giá của khách để giải đáp hoặc cảm ơn.
4. **Cải thiện:** Dựa vào các Tags và bình luận để cải thiện chất lượng dịch vụ/món ăn.

---

## 2. Thay đổi Cơ sở dữ liệu (Database Schema)

Bổ sung trường `orderId` và `tags` vào model `RestaurantRating` và liên kết với model `Order`:

```prisma
model RestaurantRating {
    id             Int        @id @default(autoincrement())
    restaurantId   Int
    restaurant     Restaurant @relation(fields: [restaurantId], references: [id])
    userId         Int
    user           User       @relation(fields: [userId], references: [id])
    vote           Int
    comment        String     @default("") @db.Text
    reply          String?    @db.Text
    replyCreatedAt DateTime?
    createdAt      DateTime   @default(now())
    deleteAt       DateTime?

    // Bổ sung mới:
    orderId        Int        @unique
    order          Order      @relation(fields: [orderId], references: [id])
    tags           Json?      // Lưu mảng các tags dạng string (e.g. ["Món ăn ngon", "Giao hàng nhanh"])
}

model Order {
    // ... các trường hiện tại ...
    restaurantRating RestaurantRating?
}
```

---

## 3. Danh sách API chi tiết

### A. Nhóm API dành cho Khách hàng (Customer)

#### API 1: Gửi đánh giá mới cho nhà hàng
- **Method:** `POST`
- **Endpoint:** `/api/restaurant/reviews/:restaurantId`
- **Authentication:** Bắt buộc (Bearer Token - Customer)
- **Body:**
```json
{
  "orderId": 162432,
  "vote": 5,
  "comment": "Đồ ăn rất ngon, giao hàng siêu nhanh!",
  "tags": ["Món ăn ngon", "Giao hàng nhanh"]
}
```
- **Response Success (201 Created):**
```json
{
  "success": true,
  "message": "Create restaurant review successfully",
  "data": {
    "id": 12,
    "restaurantId": 101,
    "userId": 5,
    "vote": 5,
    "comment": "Đồ ăn rất ngon, giao hàng siêu nhanh!",
    "tags": ["Món ăn ngon", "Giao hàng nhanh"],
    "orderId": 162432,
    "createdAt": "2026-06-22T13:49:30Z"
  }
}
```
- **Logic & Validations:**
  - Kiểm tra đơn hàng (`orderId`) có tồn tại và thuộc về User đang đăng nhập hay không. Nếu không, trả về `403 Forbidden` hoặc `404 Not Found`.
  - Kiểm tra đơn hàng có đúng của nhà hàng `restaurantId` hay không.
  - Kiểm tra trạng thái đơn hàng: phải là `DELIVERED`. Nếu không, trả về `400 Bad Request` ("Only delivered orders can be rated").
  - Kiểm tra xem đơn hàng này đã được đánh giá trước đó chưa (bằng cách tìm bản ghi `RestaurantRating` có `orderId`). Nếu đã đánh giá, trả về `400 Bad Request` ("This order has already been rated").
  - **Xác thực Tags:** Các phần tử trong danh sách `tags` gửi lên bắt buộc phải thuộc danh sách được định nghĩa sẵn của hệ thống: `["Món ăn ngon", "Giao hàng nhanh", "Đóng gói cẩn thận", "Thái độ tốt", "Giá cả hợp lý"]`. Nếu có tag nào nằm ngoài danh sách này, trả về lỗi `400 Bad Request` ("Invalid review tags").
  - Tạo bản ghi mới trong bảng `RestaurantRating`, lưu trữ `tags` dưới dạng JSON array.

#### API 2: Lấy danh sách review của tôi (My Reviews)
- **Method:** `GET`
- **Endpoint:** `/api/user/reviews`
- **Authentication:** Bắt buộc (Bearer Token - Customer)
- **Query Parameters:**
  - `limit` (number, default: 20)
  - `offset` (number, default: 0)
- **Response Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "restaurantId": 101,
      "restaurantName": "Bún Chả Hương Liên",
      "vote": 5,
      "comment": "Đồ ăn rất ngon, giao hàng siêu nhanh!",
      "tags": ["Món ăn ngon", "Giao hàng nhanh"],
      "orderId": 162432,
      "createdAt": "2026-06-22T13:49:30Z",
      "reply": "Cảm ơn quý khách đã ủng hộ nhà hàng!",
      "replyCreatedAt": "2026-06-22T14:30:00Z"
    }
  ]
}
```
- **Logic:** Truy vấn các bản ghi `RestaurantRating` của `userId` hiện tại, kết hợp lấy thông tin tên nhà hàng (`Restaurant.name`), sắp xếp theo `createdAt` giảm dần.

#### API 3: Cập nhật đánh giá
- **Method:** `PATCH`
- **Endpoint:** `/api/restaurant/reviews/:reviewId`
- **Authentication:** Bắt buộc (Bearer Token - Owner of review)
- **Body:**
```json
{
  "vote": 4,
  "comment": "Đồ ăn vẫn ngon nhưng nay giao hơi chậm tí.",
  "tags": ["Món ăn ngon"]
}
```
- **Response Success (200 OK):**
```json
{
  "success": true,
  "message": "Update review successfully",
  "data": {
    "id": 12,
    "vote": 4,
    "comment": "Đồ ăn vẫn ngon nhưng nay giao hơi chậm tí.",
    "tags": ["Món ăn ngon"],
    "updatedAt": "2026-06-22T15:00:00Z"
  }
}
```
- **Logic:** Xác thực người gửi yêu cầu là chủ sở hữu của đánh giá (`userId == RestaurantRating.userId`). Tiến hành cập nhật.

#### API 4: Xóa đánh giá
- **Method:** `DELETE`
- **Endpoint:** `/api/restaurant/reviews/:reviewId`
- **Authentication:** Bắt buộc (Bearer Token - Owner of review or Admin)
- **Response Success (200 OK):**
```json
{
  "success": true,
  "message": "Delete review successfully"
}
```
- **Logic:** Thực hiện soft delete (cập nhật trường `deleteAt`) hoặc hard delete bản ghi đánh giá tương ứng.

#### API 5: Xem review của nhà hàng (Dành cho khách hàng)
- **Method:** `GET`
- **Endpoint:** `/api/restaurant/reviews/:restaurantId`
- **Authentication:** Public
- **Query Parameters:**
  - `limit` (number, default: 20)
  - `offset` (number, default: 0)
- **Response Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "restaurantId": 101,
    "name": "Bún Chả Hương Liên",
    "averageRating": 4.7,
    "ratingCount": 120,
    "ratings": [
      {
        "id": 12,
        "vote": 5,
        "comment": "Ngon và sạch sẽ.",
        "tags": ["Món ăn ngon"],
        "createdAt": "2026-06-22T13:49:30Z",
        "reply": "Cảm ơn quý khách!",
        "user": {
          "id": 5,
          "name": "Nguyen Van A",
          "avatar": "https://example.com/avatar.jpg"
        }
      }
    ]
  }
}
```

---

### B. Nhóm API dành cho Nhà hàng (Restaurant/Vendor)

#### API 6: Lấy danh sách review của nhà hàng (Vendor View)
- **Method:** `GET`
- **Endpoint:** `/api/restaurant/manage/:restaurantId/reviews`
- **Authentication:** Bắt buộc (Bearer Token - Owner/Admin of Restaurant)
- **Response Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "vote": 5,
      "comment": "Ngon tuyệt vời!",
      "tags": ["Món ăn ngon"],
      "createdAt": "2026-06-22T13:49:30Z",
      "reply": null,
      "user": {
        "id": 5,
        "name": "Nguyen Van A",
        "avatar": "https://example.com/avatar.jpg"
      },
      "orderId": 162432
    }
  ]
}
```
- **Logic:** Xác thực quyền sở hữu nhà hàng trước khi trả về danh sách đánh giá.

#### API 7: Phản hồi đánh giá (Reply to Review)
- **Method:** `POST`
- **Endpoint:** `/api/restaurant/reviews/:reviewId/reply`
- **Authentication:** Bắt buộc (Bearer Token - Owner/Admin of Restaurant)
- **Body:**
```json
{
  "reply": "Cảm ơn bạn đã phản hồi, nhà hàng sẽ cố gắng cải thiện dịch vụ hơn nữa!"
}
```
- **Response Success (200 OK):**
```json
{
  "success": true,
  "message": "Reply added successfully",
  "data": {
    "id": 12,
    "reply": "Cảm ơn bạn đã phản hồi, nhà hàng sẽ cố gắng cải thiện dịch vụ hơn nữa!",
    "replyCreatedAt": "2026-06-22T16:00:00Z"
  }
}
```
- **Logic:** Xác thực người gửi là chủ cửa hàng của đánh giá được trỏ tới. Cập nhật trường `reply` và `replyCreatedAt` trong bảng `RestaurantRating`.

#### API 8: Thống kê đánh giá tại Dashboard (Rating Stats)
- **Method:** `GET`
- **Endpoint:** `/api/restaurant/manage/:restaurantId/stats/ratings`
- **Authentication:** Bắt buộc (Bearer Token - Owner/Admin of Restaurant)
- **Response Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "averageRating": 4.5,
    "totalReviews": 100,
    "starCount": {
      "1": 2,
      "2": 3,
      "3": 5,
      "4": 10,
      "5": 80
    },
    "popularTags": [
      { "tag": "Món ăn ngon", "count": 45 },
      { "tag": "Giao hàng nhanh", "count": 30 }
    ]
  }
}
```
- **Logic:** Gom nhóm thống kê theo số lượng sao và các tag phổ biến của nhà hàng. Sau đó sắp xếp các tag có lượt chọn nhiều nhất lên đầu.
## Phân hệ 3: Trò chuyện & Nhắn tin (Conversation Chat)

Hệ thống Chat được xây dựng trên mô hình cuộc trò chuyện (Conversation) liên kết với một Đơn hàng (`orderId`). Mỗi cuộc trò chuyện diễn ra giữa Khách hàng (`customerId`) và Nhà bán hàng (`sellerId`).

---

## 1. Thay đổi Cơ sở dữ liệu (Database Schema)

Bổ sung trường `isRead` vào model `Message`:
```prisma
model Message {
    id             Int          @id @default(autoincrement())
    conversationId Int
    conversation   Conversation @relation(fields: [conversationId], references: [id])
    senderId       Int
    sender         User         @relation("ChatMessages", fields: [senderId], references: [id])
    content        String       @db.Text
    image          String       @default("")
    isRead         Boolean      @default(false) // Bổ sung mới để quản lý trạng thái đọc tin nhắn

    createdAt DateTime  @default(now())
    updatedAt DateTime  @updatedAt
    deleteAt  DateTime?

    @@index([senderId])
}
```

---

## 2. Danh sách API chi tiết

### API 1: Lấy danh sách hội thoại của tôi (Get My Conversations)
- **Endpoint:** `GET /api/conversation/me`
- **Authentication:** Bắt buộc (Bearer Token)
- **Response Success (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "orderId": 162432,
      "customerId": 5,
      "sellerId": 2,
      "createdAt": "2026-06-22T13:49:30Z",
      "updatedAt": "2026-06-22T14:00:00Z",
      "customer": {
        "id": 5,
        "name": "Nguyen Van A",
        "avatar": "https://example.com/avatar.jpg"
      },
      "seller": {
        "id": 2,
        "name": "Chủ Quán Bún Chả",
        "avatar": "https://example.com/seller-avatar.jpg"
      },
      "restaurant": {
        "id": 101,
        "name": "Bún Chả Hương Liên",
        "image": "https://example.com/restaurant-logo.jpg"
      },
      "lastMessage": {
        "id": 45,
        "content": "Dạ đơn hàng của bạn đang được chuẩn bị ạ.",
        "senderId": 2,
        "createdAt": "2026-06-22T14:00:00Z",
        "image": "",
        "isRead": false
      },
      "unreadCount": 1
    }
  ]
}
```
- **Logic:**
  - Lấy danh sách cuộc trò chuyện của User hiện tại (vai trò khách hàng hoặc nhà bán hàng).
  - Kết hợp thông tin:
    - Khách hàng (`customer`: id, name, avatar).
    - Nhà bán hàng (`seller`: id, name, avatar).
    - Nhà hàng (`restaurant`: id, name, image) qua liên kết: `Conversation.orderId` -> `Order.restaurantId` -> `Restaurant`.
  - Trả về tin nhắn mới nhất `lastMessage`.
  - Tính toán `unreadCount`: Đếm số lượng tin nhắn trong cuộc trò chuyện đó có `senderId != currentUserId` và `isRead == false`.

### API 2: Tạo cuộc hội thoại mới (Create Conversation)
- **Endpoint:** `POST /api/conversation`
- **Authentication:** Bắt buộc (Bearer Token - Customer)
- **Body:**
```json
{
  "orderId": 162432,
  "sellerId": 2
}
```
- **Response Success (201 Created):** Trả về thông tin cơ bản của `Conversation`.

### API 3: Xem chi tiết cuộc hội thoại theo Order ID
- **Endpoint:** `GET /api/conversation/detail`
- **Authentication:** Bắt buộc (Bearer Token)
- **Query Parameters:**
  - `orderId` (number, required)
  - `limit` (number, default: 20)
  - `offset` (number, default: 0)
- **Response Success (200 OK):** Trả về thông tin cuộc trò chuyện kèm danh sách các tin nhắn phân trang (có thông tin `who: "me" | "other"`, thông tin `customer`, `seller` và `restaurant` để hiển thị trên Header chat).

### API 4: Xem chi tiết cuộc hội thoại theo Conversation ID
- **Endpoint:** `GET /api/conversation/:conversationId`
- **Authentication:** Bắt buộc (Bearer Token)
- **Query Parameters:**
  - `limit` (number, default: 20)
  - `offset` (number, default: 0)
- **Response Success (200 OK):** Trả về thông tin cuộc trò chuyện kèm danh sách tin nhắn tương tự API 3.

### API 5: Đánh dấu đã đọc toàn bộ tin nhắn trong cuộc hội thoại (Mark As Read)
- **Endpoint:** `PATCH /api/conversation/:conversationId/read`
- **Authentication:** Bắt buộc (Bearer Token)
- **Response Success (200 OK):**
```json
{
  "success": true,
  "message": "Marked all messages as read"
}
```
- **Logic:** Cập nhật `isRead = true` cho tất cả tin nhắn trong cuộc hội thoại `conversationId` mà người gửi không phải là User hiện tại (`senderId != currentUserId`) và `isRead == false`.

---
## Phân hệ 4: Trang chủ Khách hàng (Customer Home Screen)

Tài liệu này tổng hợp các API cần thiết để vận hành màn hình chính (Home) phía khách hàng. Các yêu cầu về Banner và Logic lọc giờ mở cửa đã được loại bỏ để phù hợp với cấu trúc Database hiện tại.

---

## 1. API Thông tin người dùng (User Profile)
Dùng để hiển thị lời chào và tên người dùng (ví dụ: "Hey [Name], Good Morning!").

- **Endpoint:** `GET /api/user/profile`
- **Authentication:** Bắt buộc (Bearer Token)
- **Response Format:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "fullName": "string",
    "avatarUrl": "string"
  }
}
```

---

## 2. API Danh mục (Categories)
Lấy danh sách các danh mục món ăn hiển thị ở thanh cuộn ngang.

- **Endpoint:** `GET /api/categories`
- **Authentication:** Public
- **Query Parameters:**
  - `limit` (number, optional): Giới hạn số lượng (mặc định 10).
- **Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "name": "string",
      "imageUrl": "string"
    }
  ]
}
```

---

## 3. API Nhà hàng (Restaurants)
Lấy danh sách tất cả nhà hàng, sắp xếp theo khoảng cách nếu có tọa độ người dùng.

- **Endpoint:** `GET /api/restaurants`
- **Authentication:** Public
- **Query Parameters:**
  - `lat` (number, optional): Vĩ độ của user.
  - `lng` (number, optional): Kinh độ của user.
  - `limit` (number, optional): Số lượng bản ghi (mặc định 20).
- **Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "name": "string",
      "imageUrl": "string",
      "averageRating": 4.8,
      "deliveryFee": 1.5,
      "distance": 2.3, // đơn vị: km
      "tags": ["Fast Food", "Burger"],
      "estimatedDeliveryTime": 25 // đơn vị: phút
    }
  ]
}
```

---

## 4. API Bộ đếm (Home Counters)
Lấy số lượng item trong giỏ hàng và tin nhắn chưa đọc cho TopBar.

- **Endpoint:** `GET /api/home/counters`
- **Authentication:** Bắt buộc (Bearer Token)
- **Response Format:**
```json
{
  "success": true,
  "data": {
    "cartItemCount": 5,
    "unreadMessageCount": 2
  }
}
```

---

## 5. [Khuyên dùng] API Dashboard Hợp nhất
Gộp các thông tin trên vào 1 request để tối ưu tốc độ tải trang khi mở app.

- **Endpoint:** `GET /api/home/dashboard`
- **Authentication:** Optional (Nếu có token trả về thêm User & Counters).
- **Query Parameters:** `lat`, `lng`.
- **Response Format:** Trả về object chứa cả `user`, `categories`, `restaurants`, `counters`.

---

## Yêu cầu kỹ thuật đối với Backend:
1. **Tính toán khoảng cách:** Nếu Client gửi `lat/lng`, BE tính toán khoảng cách thực tế giữa User và Nhà hàng để trả về trường `distance`.
2. **Xử lý khi chưa đăng nhập:** API Dashboard phải hoạt động được khi không có Token (trả về null cho phần thông tin cá nhân).
3. **Đơn giản hóa logic:** Do DB không lưu giờ hoạt động, API sẽ trả về toàn bộ nhà hàng mà không cần lọc trạng thái Đóng/Mở cửa.

## Phân hệ 5: Khôi phục mật khẩu (Reset Password Flow)

Luồng quên mật khẩu và đặt lại mật khẩu được tách thành 3 bước độc lập để bảo mật và tối ưu trải nghiệm người dùng.

---

### 1. Yêu cầu gửi mã OTP quên mật khẩu
- **Endpoint:** `POST /api/auth/forgot-password`
- **Authentication:** Public
- **Body:**
```json
{
  "email": "user@example.com"
}
```
- **Response Success (200 OK):**
```json
{
  "success": true,
  "message": "Reset password OTP has been sent"
}
```
- **Logic:**
  - Kiểm tra xem email có tồn tại trên hệ thống không. Nếu không, trả về lỗi `400 Bad Request` ("Email has not been registered").
  - Hủy các OTP reset password cũ chưa sử dụng của User (cập nhật `usedAt`).
  - Sinh mã OTP gồm 6 chữ số, mã hóa (hashing) rồi lưu vào bảng `OTP` với type `RESET_PASSWORD_OTP` và thời gian hết hạn (`expiresAt`).
  - Gửi email chứa OTP cho người dùng.

---

### 2. Xác thực mã OTP quên mật khẩu
- **Endpoint:** `POST /api/auth/verify-reset-otp`
- **Authentication:** Public
- **Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```
- **Response Success (200 OK):**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "resetToken": "eyJhbGciOi..."
  }
}
```
- **Logic:**
  - Xác thực OTP: tìm bản ghi OTP khớp mã băm, có type `RESET_PASSWORD_OTP`, chưa sử dụng (`usedAt` là null), chưa quá hạn (`expiresAt` >= thời gian hiện tại).
  - Nếu OTP không hợp lệ hoặc hết hạn, trả về lỗi `400 Bad Request` ("OTP is invalid or expired").
  - Nếu OTP hợp lệ, cập nhật `usedAt = new Date()` cho bản ghi OTP này.
  - Sinh ra một `resetToken` dạng JWT có thời gian sống ngắn (ví dụ: 10 phút), chứa payload:
    ```json
    {
      "email": "user@example.com",
      "purpose": "RESET_PASSWORD"
    }
    ```
  - Ký token này bằng khóa bí mật (`ACCESS_SECRET_KEY` hoặc khóa cấu hình riêng). Trả `resetToken` về cho Client.

---

### 3. Đặt lại mật khẩu mới bằng Reset Token
- **Endpoint:** `POST /api/auth/reset-password`
- **Authentication:** Public
- **Body:**
```json
{
  "resetToken": "eyJhbGciOi...",
  "newPassword": "new_secure_password"
}
```
- **Response Success (200 OK):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```
- **Logic:**
  - Giải mã và xác thực `resetToken` (đảm bảo chữ ký đúng, chưa hết hạn, và trường `purpose` đúng bằng `"RESET_PASSWORD"`). Nếu sai hoặc hết hạn, trả về `400 Bad Request` hoặc `401 Unauthorized` ("Reset token is invalid or expired").
  - Lấy email từ token, băm mật khẩu mới (`newPassword`) và cập nhật mật khẩu mới của User trong cơ sở dữ liệu.
  - Đăng xuất User khỏi các phiên làm việc cũ: cập nhật `usedAt = new Date()` cho tất cả các Refresh Token đang hoạt động (`usedAt` là null) của User đó trong bảng `AuthToken`.

## Phân hệ 6: Yêu thích Nhà hàng (Favorite Restaurants)

Tài liệu này mô tả các API cần thiết để thực hiện tính năng "Yêu thích nhà hàng" cho người dùng trong ứng dụng FoodDelivery.

## 1. Cấu trúc cơ sở dữ liệu đề xuất (Database Schema)

Thêm model `UserFavoriteRestaurant` làm bảng trung gian liên kết `User` và `Restaurant`:

```prisma
model UserFavoriteRestaurant {
    id           Int        @id @default(autoincrement())
    userId       Int
    user         User       @relation(fields: [userId], references: [id])
    restaurantId Int
    restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
    createdAt    DateTime   @default(now())

    @@unique([userId, restaurantId])
    @@index([userId])
    @@index([restaurantId])
}
```

---

## 2. Các Endpoint

### 2.1. Thêm/Bớt nhà hàng vào danh sách yêu thích (Toggle Favorite)
Sử dụng để thêm hoặc xóa nhà hàng khỏi danh sách yêu thích của người dùng (Action đảo ngược trạng thái hiện tại).

- **URL**: `/api/restaurant/:restaurantId/like`
- **Method**: `POST`
- **Authentication**: Bắt buộc (Bearer Token - Customer)
- **Path Parameters**:
  - `restaurantId` (number): ID của nhà hàng.

- **Response Success (200 OK)**:
```json
{
  "success": true,
  "message": "Update favorite status successfully",
  "data": {
    "restaurantId": 123,
    "isLiked": true,
    "totalLikes": 1502
  }
}
```
- **Logic:**
  - Kiểm tra xem nhà hàng `restaurantId` có tồn tại không. Nếu không, trả về `404 Not Found`.
  - Tìm bản ghi `UserFavoriteRestaurant` tương ứng với `userId` hiện tại và `restaurantId`.
  - Nếu đã tồn tại: Thực hiện xóa bản ghi (unlike) và trả về `isLiked: false`.
  - Nếu chưa tồn tại: Tạo bản ghi mới (like) và trả về `isLiked: true`.
  - Tính toán `totalLikes` bằng cách đếm tổng số bản ghi trong bảng `UserFavoriteRestaurant` cho `restaurantId` này.

---

### 2.2. Lấy danh sách Nhà hàng đã yêu thích
Lấy danh sách các nhà hàng mà người dùng hiện tại đã nhấn "Like".

- **URL**: `/api/user/favorites/restaurants`
- **Method**: `GET`
- **Authentication**: Bắt buộc (Bearer Token - Customer)
- **Query Parameters**:
  - `limit` (number, optional): Số lượng bản ghi mỗi trang (Mặc định: 20).
  - `offset` (number, optional): Vị trí bắt đầu lấy (Mặc định: 0).

- **Response Success (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Rose Garden Restaurant",
      "image": "https://cdn.example.com/images/res1.jpg",
      "rating": 4.7,
      "deliveryFee": 0.0,
      "tags": ["Burger", "Chicken"],
      "isLiked": true
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0
  }
}
```
- **Logic:**
  - Truy vấn bảng `UserFavoriteRestaurant` của `userId` hiện tại, lấy kèm thông tin `Restaurant` chi tiết (kết hợp tính toán `averageRating` và `tags` từ món ăn tương tự API danh sách nhà hàng).
  - Trả về danh sách cùng thông tin phân trang.

---

### 2.3. Kiểm tra trạng thái yêu thích
Kiểm tra xem một nhà hàng cụ thể có đang được người dùng hiện tại yêu thích hay không (dùng khi truy cập vào trang chi tiết nhà hàng).

- **URL**: `/api/restaurant/:restaurantId/like-status`
- **Method**: `GET`
- **Authentication**: Bắt buộc (Bearer Token)
- **Path Parameters**:
  - `restaurantId` (number): ID của nhà hàng.

- **Response Success (200 OK)**:
```json
{
  "success": true,
  "data": {
    "isLiked": true
  }
}
```
- **Logic:**
  - Tìm bản ghi `UserFavoriteRestaurant` với `userId` và `restaurantId`. Trả về `isLiked: true` nếu tìm thấy, ngược lại trả về `isLiked: false`.

---

## 3. Ghi chú cho Backend
1. **Performance**: Khi lấy danh sách nhà hàng (All Restaurants), cần tiến hành `LEFT JOIN` hoặc kiểm tra sự tồn tại trong bảng `UserFavoriteRestaurant` theo `userId` đang đăng nhập để trả về đúng trạng thái `isLiked` động theo từng User.
2. **CORS**: Đảm bảo cấu hình cho phép các domain từ Frontend.
3. **DTO chuẩn hóa**: Toàn bộ dữ liệu trả về của các API yêu thích cần bọc trong cấu trúc BaseResponse chung `{ "success": boolean, "message": string, "data": any }`.
