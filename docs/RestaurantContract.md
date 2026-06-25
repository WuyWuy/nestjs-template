# API Contract: Doanh thu Nhà hàng (Restaurant Revenue)

**Phiên bản:** 1.0  
**Ngày:** 2026-06-25  
**Base URL:** `/api`  
**Auth:** `Bearer JWT`  
**Roles:** `BUSINESS` (chủ nhà hàng) | `ADMIN` (xem mọi nhà hàng)

---

## 0. Quy tắc nghiệp vụ chung (Delivered Revenue)

Mọi chỉ số doanh thu (dashboard, summary, details) dùng **cùng một bộ filter**:

| # | Điều kiện | Chi tiết |
|---|-----------|----------|
| 1 | Order status | `CONFIRMED` — đơn hoàn tất (khách xác nhận / auto 24h) |
| 2 | Payment | Có ít nhất 1 payment với `paymentStatus = DONE` |
| 3 | Soft delete | `Order.deleteAt IS NULL` |
| 4 | Giá trị đơn | `Order.totalPrice` — Final Total lúc checkout (đã trừ voucher, đã cộng phí giao) |
| 5 | Hoa hồng nền tảng | `platformCommissionRate = 0.1` (10%) |
| 6 | Thu nhập NH | `restaurantNetRevenue = grossAmount × (1 - platformCommissionRate)` |

**Công thức commission (làm tròn 2 chữ số):**

```
platformCommission = round(grossAmount × 0.1, 2)
restaurantNetRevenue = round(grossAmount × 0.9, 2)
```

**Lọc thời gian (khi có `startDate`/`endDate`):** theo `Order.confirmedAt`.

**Phân quyền:** BUSINESS chỉ xem nhà hàng mình sở hữu; ADMIN xem được mọi `restaurantId`.

---

## 1. API Summary — Tổng doanh thu

### Endpoint

```
GET /api/restaurant/manage/:restaurantId/revenue
```

### Path params

| Param | Type | Mô tả |
|-------|------|--------|
| `restaurantId` | `number` | ID nhà hàng |

### Query params

| Param | Type | Required | Default | Mô tả |
|-------|------|----------|---------|--------|
| `startDate` | `string` (ISO 8601 hoặc `YYYY-MM-DD`) | No | — | Từ ngày (theo `confirmedAt`) |
| `endDate` | `string` (ISO 8601 hoặc `YYYY-MM-DD`) | No | — | Đến ngày (theo `confirmedAt`) |

Không truyền `startDate`/`endDate` → trả toàn bộ lịch sử.

### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "restaurantId": 7,
    "grossRevenue": 1250000.0,
    "platformCommissionRate": 0.1,
    "platformCommission": 125000.0,
    "restaurantNetRevenue": 1125000.0,
    "orderCount": 42,
    "filters": {
      "startDate": "2026-06-01T00:00:00.000Z",
      "endDate": "2026-06-30T23:59:59.999Z"
    }
  }
}
```

| Field | Type | Mô tả |
|-------|------|--------|
| `grossRevenue` | `number` | Tổng `totalPrice` các đơn đủ điều kiện |
| `platformCommissionRate` | `number` | Luôn `0.1` |
| `platformCommission` | `number` | Hoa hồng nền tảng |
| `restaurantNetRevenue` | `number` | Phần nhà hàng nhận (90%) |
| `orderCount` | `number` | Số đơn được tính |
| `filters` | `object` | Echo query đã áp dụng |

### Prisma `where` (BE reference)

```typescript
{
  restaurantId,
  status: OrderStatus.CONFIRMED,
  deleteAt: null,
  confirmedAt: { not: null /* + gte/lte nếu có filter */ },
  payments: {
    some: { paymentStatus: PaymentStatus.DONE },
  },
}
```

### Errors

| HTTP | Khi nào |
|------|---------|
| `401` | Chưa đăng nhập |
| `403` | BUSINESS không phải chủ nhà hàng |
| `404` | `restaurantId` không tồn tại |

---

## 2. API Details — Chi tiết từng đơn

### Endpoint

```
GET /api/restaurant/manage/:restaurantId/revenue-details
```

### Path params

| Param | Type | Mô tả |
|-------|------|--------|
| `restaurantId` | `number` | ID nhà hàng |

### Query params

| Param | Type | Required | Default | Mô tả |
|-------|------|----------|---------|--------|
| `limit` | `number` | No | `20` | Số bản ghi / trang (min: 1) |
| `offset` | `number` | No | `0` | Offset phân trang (min: 0) |
| `startDate` | `string` | No | — | Lọc theo `confirmedAt` |
| `endDate` | `string` | No | — | Lọc theo `confirmedAt` |

### Response `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "orderId": "ORD-10023",
      "totalAmount": 250000.0,
      "platformCommission": 25000.0,
      "restaurantNetRevenue": 225000.0,
      "completedAt": "2026-06-20T10:00:00.000Z",
      "paymentMethod": "CASH",
      "customerName": "Nguyen Van A"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

| Field | Type | Mô tả |
|-------|------|--------|
| `orderId` | `string` | Format `ORD-{id}` |
| `totalAmount` | `number` | `Order.totalPrice` |
| `platformCommission` | `number` | 10% của `totalAmount` |
| `restaurantNetRevenue` | `number` | 90% của `totalAmount` |
| `completedAt` | `string` (ISO) | `Order.confirmedAt` |
| `paymentMethod` | `string` | `CASH` \| `MOMO` (optional) |
| `customerName` | `string` | Tên khách (optional) |

**Lưu ý đặt tên:** Admin dùng `netRevenue` = 10% (góc nhìn admin). App nhà hàng dùng `restaurantNetRevenue` = 90%.

### Sort

`confirmedAt DESC`.

### Errors

Giống API Summary.

---

## 3. Đồng bộ với Admin API

| | Admin | Restaurant |
|---|-------|------------|
| Summary | `GET /api/admin/revenue` | `GET /api/restaurant/manage/:id/revenue` |
| Details | `GET /api/admin/dashboard/revenue-details` | `GET /api/restaurant/manage/:id/revenue-details` |
| Filter đơn | CONFIRMED + DONE | Giống + `restaurantId` |
| `totalAmount` | `totalPrice` | `totalPrice` |
| Commission | `netRevenue` (= 10%) | `platformCommission` (= 10%) |
| Thu nhập NH | — | `restaurantNetRevenue` (= 90%) |

**Đảm bảo nhất quán:**

```
SUM(restaurant.revenue-details[].totalAmount) === restaurant.revenue.grossRevenue

SUM(admin.revenue-details[].totalAmount WHERE restaurantId = X) === restaurant(X).revenue.grossRevenue
```

(cùng bộ filter thời gian)

---

## 4. Dashboard `revenue` — cần align

`GET /api/restaurant/generate-dashboard?restaurantId=` — field `revenue` phải dùng **cùng query** như `grossRevenue` (CONFIRMED + DONE + `deleteAt: null`).

---

## 5. Breaking changes so với API hiện tại

| Hiện tại | Contract mới |
|----------|--------------|
| Response thẳng object | Wrap `{ success: true, data: {...} }` |
| Không lọc payment | Bắt buộc `paymentStatus: DONE` |
| Không có `deleteAt: null` | Thêm filter |
| Không có `orderCount`, filter ngày | Thêm |
| Chưa có `revenue-details` | Endpoint mới |

---

## 6. Open questions (Phase 2)

| # | Câu hỏi | Đề xuất tạm |
|---|---------|------------|
| 1 | Voucher platform có trừ vào doanh thu NH? | Phase 1: dùng `totalPrice` như Admin |
| 2 | `deliveryFee` có tính vào doanh thu NH? | Phase 1: có (theo `totalPrice`) |
| 3 | Tỷ lệ hoa hồng cố định 10%? | Phase 1: constant `0.1` |

---

## 7. Checklist implement BE

- [x] `restaurant.controller.ts` — cập nhật `revenue`, thêm `revenue-details`
- [x] `restaurant.service.ts` — shared `buildRevenueOrderWhere()`, sửa summary, thêm details
- [x] `restaurant.dto.ts` — query + response DTOs
- [x] `restaurant.service.spec.ts` — test payment filter, pagination, commission
- [x] Align `generateRestaurantDashboard().revenue`
- [x] Shared constant `PLATFORM_COMMISSION_RATE = 0.1` (Admin + Restaurant)

---

## 8. Ví dụ curl

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/restaurant/manage/7/revenue"

curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/restaurant/manage/7/revenue?startDate=2026-06-01&endDate=2026-06-30"

curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/restaurant/manage/7/revenue-details?limit=20&offset=0"
```
