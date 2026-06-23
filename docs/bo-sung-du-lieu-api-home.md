# Bổ sung dữ liệu cho API Home

## 2. Bổ sung trường `phone` vào Object User

Trong `HomeViewModel.kt`, ứng dụng hiện sử dụng logic:

```kotlin
isPhoneMissing = user.phone.isBlank()
```

Nếu Object User không có trường `phone`, ứng dụng sẽ không thể kiểm tra và nhắc người dùng cập nhật số điện thoại.

### Yêu cầu

Bổ sung trường sau vào Object User:

```text
phone: String
```

### Mục đích

- Kiểm tra người dùng đã cập nhật số điện thoại hay chưa.
- Hiển thị thông báo nhắc người dùng bổ sung số điện thoại khi trường `phone` bị trống.
- Đảm bảo tương thích với logic hiện tại trong `HomeViewModel.kt`.

---

## 3. Bổ sung trường `reviewCount` cho Restaurant

UI của các ứng dụng giao đồ ăn thường hiển thị điểm đánh giá kèm tổng số lượt đánh giá, ví dụ:

```text
4.8 (100+ đánh giá)
```

API hiện tại chỉ trả về trường `averageRating`, vì vậy Frontend chưa thể hiển thị đầy đủ mức độ uy tín của nhà hàng.

### Yêu cầu

Bổ sung trường sau vào Object Restaurant:

```text
reviewCount: Int
```

### Mục đích

- Hiển thị tổng số lượt đánh giá của nhà hàng.
- Giúp người dùng đánh giá độ uy tín của nhà hàng.
- Kết hợp với `averageRating` để hiển thị thông tin như:

```text
4.8 (120 đánh giá)
```

---

## 4. Bổ sung thông tin địa chỉ hiện tại

Màn hình Home có phần hiển thị địa điểm giao hàng như `Home`, `Work`,... API hiện nhận vào `lat` và `lng`, nhưng chưa trả về tên địa chỉ để Frontend hiển thị.

### Yêu cầu tùy chọn

Bổ sung trường sau vào phần `data` của response:

```text
currentAddressName: String
```

### Ví dụ

```text
123 Đường ABC, Quận 1, TP. Hồ Chí Minh
```

### Mục đích

- Hiển thị địa chỉ thực tế trên TopBar.
- Tránh việc Frontend chỉ hiển thị giá trị mặc định như `Home`.
- Giúp người dùng xác nhận chính xác địa điểm giao hàng hiện tại.

---

## Tổng hợp các trường cần bổ sung

| Object/Response | Trường | Kiểu dữ liệu | Mức độ |
|---|---|---:|---|
| User | `phone` | `String` | Bắt buộc |
| Restaurant | `reviewCount` | `Int` | Bắt buộc |
| Home Response Data | `currentAddressName` | `String` | Tùy chọn |
