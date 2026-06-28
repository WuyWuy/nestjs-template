# User Address API — Hướng dẫn tích hợp FE

Tài liệu mô tả các thay đổi mới nhất cho API địa chỉ đã lưu của user (`/api/user/address/*`).

## Tóm tắt thay đổi

| Trước | Sau |
|-------|-----|
| Chỉ role `CUSTOMER` | **`CUSTOMER` và `BUSINESS`** đều dùng được |
| Field `deliveryNote` trên object `address` | **`addressDetail`** trên **UserAddress** (cùng cấp với `title`) |
| `PUT /user/address/:id` có thể gửi `fullText`, `lat`, `lng` lẻ | **`PUT` chỉ sửa `title` + `addressDetail`** |
| Không có endpoint đổi vị trí map | **`PUT /user/address/:id/location`** — gửi bundle từ Google Maps / Photon |
| `PUT .../location` chỉ 3 field (thiếu `title`) | **Bắt buộc 4 field**: `title` + `fullText` + `latitude` + `longitude` — `title` → `Address.title` (Photon) |

---

## Khái niệm

### Hai lớp dữ liệu

```
UserAddress                    Address (shared / chuẩn hóa từ Google)
├── id                         ├── fullText      ← read-only trên màn edit
├── title (tên gợi nhớ)        ├── latitude      ← read-only trên màn edit
├── addressDetail (user nhập)  └── longitude     ← read-only trên màn edit
└── address → join Address
```

- **`fullText`, `latitude`, `longitude`, `Address.title` (Photon)**: lấy từ **Google Maps / Photon** khi user search/chọn địa chỉ. FE **không cho sửa text trực tiếp** trên form edit.
- **`addressDetail`**: user tự nhập thêm chi tiết vị trí (tầng, căn, ngõ, cổng…) vì Google Maps thường không đủ chi tiết. **Có thể sửa bất cứ lúc nào** qua `PUT /user/address/:id`.
- **`title` (UserAddress)**: tên gợi nhớ do user đặt ("Nhà", "Công ty") — sửa qua `PUT /user/address/:id`.
- **`address.title` (Address)**: tên địa điểm từ Photon/map — chỉ đổi khi gọi `PUT /user/address/:id/location` (gửi field `title` trong body).

### `:addressId` trong URL

Luôn là **`UserAddress.id`**, **không phải** `Address.id`.

---

## Auth

Tất cả endpoint yêu cầu:

```
Authorization: Bearer <access_token>
```

Role được phép: **`CUSTOMER`**, **`BUSINESS`**.

---

## Endpoints

Base path: `/api/user`

### 1. Thêm địa chỉ — `POST /user/address`

**Flow FE:**
1. User search Google Maps → nhận `fullText`, `latitude`, `longitude`
2. User nhập (optional) `addressDetail`, `title`
3. Gửi request

**Body:**
```json
{
  "title": "Nhà riêng",
  "addressDetail": "Chung cư ABC, tầng 12, căn 1203",
  "address": {
    "title": "Nhà riêng",
    "latitude": 10.776889,
    "longitude": 106.700806,
    "fullText": "123 Nguyen Hue, Ben Nghe, District 1, Ho Chi Minh City"
  }
}
```

**Response:**
```json
{
  "id": 5,
  "title": "Nhà riêng",
  "addressDetail": "Chung cư ABC, tầng 12, căn 1203",
  "address": {
    "id": 10,
    "title": "Nhà riêng",
    "latitude": 10.776889,
    "longitude": 106.700806,
    "fullText": "123 Nguyen Hue, Ben Nghe, District 1, Ho Chi Minh City"
  }
}
```

---

### 2. Danh sách — `GET /user/address/all`

**Response:** mảng các object giống response thêm địa chỉ ở trên.

---

### 3. Chi tiết — `GET /user/address/:addressId`

`:addressId` = `UserAddress.id`

---

### 4. Cập nhật tên & chi tiết — `PUT /user/address/:addressId`

**Chỉ** cho phép sửa `title` và/hoặc `addressDetail`.

**Không gửi** `fullText`, `latitude`, `longitude` tại endpoint này — backend sẽ không xử lý các field map qua PUT thường.

**Body ví dụ:**
```json
{
  "title": "Văn phòng",
  "addressDetail": "Tòa B, tầng 8, cửa bên phải thang máy"
}
```

**Màn edit FE gợi ý:**
- Hiển thị `address.fullText` + map preview → **read-only**
- Input `addressDetail` → editable
- Input `title` → editable
- Nút **"Đổi địa chỉ"** → mở Google Maps search → gọi endpoint location (mục 5)

---

### 5. Đổi vị trí map — `PUT /user/address/:addressId/location`

Dùng khi user chọn **địa chỉ mới** từ Google Maps / Photon (không phải sửa text tay).

**Body bắt buộc cả 4 field (bundle từ map service):**
```json
{
  "title": "Học viện Chính trị Quốc gia Hồ Chí Minh",
  "fullText": "135 Nguyễn Thái Học, Ba Đình, Hà Nội",
  "latitude": 21.0447918,
  "longitude": 105.7883504
}
```

| Field trong body | Lưu vào | Ghi chú |
|------------------|---------|---------|
| `title` | **`Address.title`** | Tên địa điểm từ Photon/map (vd. tên thành phố, POI) |
| `fullText` | `Address.fullText` | Địa chỉ đầy đủ từ map |
| `latitude`, `longitude` | `Address.latitude`, `Address.longitude` | Tọa độ pin |

**Hai loại `title` — không nhầm lẫn:**

| | `UserAddress.title` | `Address.title` |
|--|---------------------|-----------------|
| Nguồn | User đặt ("Nhà", "Work") | Photon / map khi search |
| Sửa qua | `PUT /user/address/:id` | `PUT /user/address/:id/location` (field `title` trong body) |
| Khi đổi map | **Giữ nguyên** | **Cập nhật** từ Photon |

**Hành vi:**
- Tạo hoặc tái sử dụng bản ghi `Address` theo bundle map (gồm `title` Photon mới)
- Gán lại `addressId` cho `UserAddress`
- **Giữ nguyên** `UserAddress.title` và `addressDetail`

**Lỗi thường gặp (đã fix):** Nếu FE chỉ gửi `fullText` + tọa độ mà **không gửi `title`**, `Address.title` sẽ không khớp địa điểm mới. Luôn gửi `title` từ kết quả Photon (`pinned.title` / `selectedAddress.title`).

---

### 6. Xóa — `DELETE /user/address/:addressId`

Soft delete (`deleteAt` trên `UserAddress`).

**Response:**
```json
{
  "message": "User address deleted successfully",
  "id": 5
}
```

---

## Đặt hàng (Order) — thay đổi liên quan

### Địa chỉ đã lưu (`savedAddressId`)

Khi tạo order, nếu user **không** gửi `note`, backend copy `addressDetail` từ `UserAddress` vào `Order.note` để shipper đọc.

### Địa chỉ tạm (`customAddress`)

`customAddress` chỉ chứa dữ liệu map (giống `CreateAddressDto`):

```json
{
  "customAddress": {
    "title": "Home",
    "latitude": 10.77,
    "longitude": 106.70,
    "fullText": "District 1, Ho Chi Minh City"
  },
  "addressDetail": "Cổng phụ, block B"
}
```

Field **`addressDetail`** ở root body order (không nằm trong `customAddress`) — chỉ dùng khi đặt hàng one-off, không lưu sổ địa chỉ.

### Ưu tiên `Order.note`

1. `note` (user nhập khi đặt hàng) — cao nhất  
2. `addressDetail` (custom one-off)  
3. `addressDetail` từ địa chỉ đã lưu  

---

## Breaking changes — FE cần sửa

| Cũ | Mới |
|----|-----|
| `address.deliveryNote` | **`addressDetail`** (top-level trên UserAddress response) |
| `PUT` body `{ "address": { "deliveryNote": "..." } }` | **`{ "addressDetail": "..." }`** |
| `PUT` body `{ "address": { "fullText", "latitude", "longitude" } }` | **`PUT .../location`** với bundle map (`title` + `fullText` + `lat` + `lng`) |
| Chỉ CUSTOMER | **CUSTOMER + BUSINESS** |
| `customAddress.deliveryNote` khi đặt hàng | **`addressDetail`** ở root body order |

---

## Database migration

Chạy migration trước khi test:

```bash
npx prisma migrate deploy
# hoặc dev:
npx prisma migrate dev
npx prisma generate
```

Migration thêm cột `UserAddress.addressDetail` (VARCHAR 500) và gỡ cột `Address.deliveryNote` nếu tồn tại từ bản draft trước.

---

## Phân biệt với địa chỉ quán (Restaurant)

| | User saved address | Restaurant address |
|--|-------------------|-------------------|
| Bảng liên kết | `UserAddress` | `Restaurant.addressId` |
| API | `/api/user/address/*` | Module restaurant |
| Mục đích | Địa chỉ giao hàng cá nhân | Vị trí nhà hàng |

User role **BUSINESS** vẫn dùng `/user/address/*` cho địa chỉ **cá nhân** của họ; không thay đổi địa chỉ quán trên `Restaurant`.

---

## Swagger

Xem chi tiết tại `/api/docs` (tag **03. User**) khi `NODE_ENV !== production`.
