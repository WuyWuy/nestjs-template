# PRD - Bo sung du lieu cho API Home Dashboard

Tai lieu nay mo ta cac yeu cau bo sung tren endpoint Home Dashboard hien co de Frontend co du du lieu hien thi man Home va combobox dia chi giao hang.

## 1. Muc tieu

- Bo sung `phone` vao object `user` trong response Home Dashboard de FE kiem tra nguoi dung da cap nhat so dien thoai hay chua.
- Bo sung `reviewCount` vao tung object `restaurant` de FE hien thi diem danh gia kem tong so luot danh gia.
- Bo sung mang `addresses` cung cap voi `user`, `categories`, `restaurants`, `counters` de FE do du lieu vao combobox dia chi khi user da dang nhap bang JWT.
- Khong tao endpoint Home moi. Chi nang cap endpoint Home Dashboard hien co.

## 2. Endpoint can bo sung

- **Endpoint hien co:** `GET /home/dashboard`
- **Neu app dang dung global prefix:** `GET /api/home/dashboard`
- **Authentication:** Optional JWT
- **Query hien co:** `lat`, `lng`

Endpoint nay van phai hoat dong cho guest. Khi khong co token, response khong duoc loi va `addresses` tra ve mang rong.

## 3. Response mong muon

```json
{
  "user": {
    "id": 1,
    "fullName": "Nguyen Van A",
    "avatarUrl": "https://example.com/avatar.png",
    "phone": "0901234567"
  },
  "categories": [
    {
      "id": 1,
      "name": "Burger",
      "imageUrl": "https://example.com/category.png"
    }
  ],
  "restaurants": [
    {
      "id": 101,
      "name": "Burger Town",
      "imageUrl": "https://example.com/restaurant.png",
      "averageRating": 4.8,
      "reviewCount": 120,
      "deliveryFee": 15000,
      "distance": 2.3,
      "tags": ["Burger"],
      "estimatedDeliveryTime": 25,
      "isLiked": true
    }
  ],
  "addresses": [
    {
      "id": 10,
      "title": "Home",
      "fullText": "123 Nguyen Hue, Ben Nghe, District 1, Ho Chi Minh City"
    },
    {
      "id": 11,
      "title": "Work",
      "fullText": "45 Vo Van Tan, Ward 6, District 3, Ho Chi Minh City"
    }
  ],
  "counters": {
    "cartItemCount": 2,
    "unreadMessageCount": 4
  }
}
```

## 4. Chi tiet bo sung

### 4.1. Bo sung `user.phone`

Hien tai model `User` da co truong `phone`. Home Dashboard can select them truong nay khi co `userId`.

Yeu cau:

- `user.phone` phai la string de FE co the dung logic `user.phone.isBlank()`.
- Neu DB dang luu `null`, BE nen map thanh chuoi rong `""`.
- Khi guest hoac token khong hop le theo optional auth, `user` tiep tuc la `null`.

Vi du:

```json
{
  "user": {
    "id": 1,
    "fullName": "Nguyen Van A",
    "avatarUrl": "https://example.com/avatar.png",
    "phone": ""
  }
}
```

### 4.2. Bo sung `restaurant.reviewCount`

Hien tai `RestaurantService.getAllRestaurants()` da tinh `ratingCount`. Home Dashboard can map gia tri nay sang field FE can la `reviewCount`.

Yeu cau:

- Moi restaurant trong `restaurants` phai co `reviewCount`.
- `reviewCount` la number integer.
- Neu nha hang chua co danh gia, `reviewCount` tra ve `0`.
- Khong thay the `averageRating`; FE can ca `averageRating` va `reviewCount`.

Ghi chu:

- Neu muon giu tuong thich voi cac noi khac dang dung `ratingCount`, co the giu `ratingCount` trong service noi bo va chi expose `reviewCount` o response Home Dashboard.

### 4.3. Bo sung `addresses`

Home Dashboard can tra ve mang `addresses` cung cap voi `user`, `categories`, `restaurants`, `counters`.

Nguon du lieu:

- Su dung du lieu dia chi cua user da co trong he thong.
- Endpoint quan ly dia chi da ton tai: `GET /user/address/all`.
- Co the tai su dung logic/query tu `UserService.getAllAddress(userId)` hoac query truc tiep bang Prisma trong `HomeService`.

Yeu cau response:

- Chi tra ve cac dia chi thuoc user dang dang nhap.
- Chi tra ve dia chi chua bi xoa mem: `UserAddress.deleteAt = null`.
- Moi item trong mang `addresses` gom:
  - `id`: id cua `UserAddress`, dung de FE biet nguoi dung dang chon address nao.
  - `title`: label hien thi trong combobox, vi du `Home`, `Work`, `Nha rieng`.
  - `fullText`: dia chi day du lay tu `Address.fullText`.
- Khong tra ve `latitude`.
- Khong tra ve `longitude`.
- Neu user da dang nhap nhung chua co dia chi, `addresses` tra ve `[]`.
- Neu guest, `addresses` tra ve `[]`.

Vi du item:

```json
{
  "id": 10,
  "title": "Home",
  "fullText": "123 Nguyen Hue, Ben Nghe, District 1, Ho Chi Minh City"
}
```

## 5. Khong nam trong pham vi

- Khong tao endpoint Home Dashboard moi.
- Khong can reverse geocoding tu `lat/lng`.
- Khong can bo sung `currentAddressName`.
- Khong tra ve toa do trong `addresses`.
- Khong thay doi schema database neu cac truong hien co da dap ung.
- Khong thay doi flow them/sua/xoa dia chi da co.

## 6. Acceptance Criteria

- Khi goi `GET /home/dashboard` khong co token:
  - `user` la `null`.
  - `addresses` la `[]`.
  - `categories`, `restaurants`, `counters` van tra ve nhu hien tai.
- Khi goi `GET /home/dashboard` co JWT hop le:
  - `user.phone` ton tai va luon la string.
  - `addresses` tra ve danh sach dia chi cua user dang dang nhap.
  - `addresses` khong chua `latitude` va `longitude`.
  - `counters` van duoc tinh theo user hien tai.
- Moi restaurant trong Home Dashboard co field `reviewCount`.
- `reviewCount` bang tong so danh gia cua nha hang va fallback ve `0` neu khong co danh gia.
- Cac test hien co cua `HomeService.getDashboard()` can duoc cap nhat de verify `phone`, `reviewCount`, va `addresses`.

## 7. Goi y trien khai

- Trong `HomeService.getDashboard()`:
  - Khi select user, them `phone: true`.
  - Map `phone: userDb.phone ?? ""`.
  - Khoi tao `addresses = []`.
  - Khi co `userId`, query `userAddress.findMany` voi `where: { userId, deleteAt: null }`.
  - Select toi thieu:
    ```ts
    {
      id: true,
      title: true,
      address: {
        select: {
          fullText: true,
        },
      },
    }
    ```
  - Map ve:
    ```ts
    {
      id: item.id,
      title: item.title,
      fullText: item.address?.fullText ?? "",
    }
    ```
  - Khi map restaurant, them:
    ```ts
    reviewCount: res.ratingCount ?? 0
    ```

## 8. Rui ro can luu y

- FE dang can `reviewCount`, nhung service hien co dang dung `ratingCount`; can map dung ten field o response Home Dashboard.
- `User.phone` trong DB la nullable, nen neu tra `null` FE Kotlin co the khong dung duoc logic `isBlank()` nhu mong muon.
- `UserService.getAllAddress()` hien dang tra object `address` day du, bao gom ca toa do. Home Dashboard khong nen expose nguyen object nay; can map lai field cho combobox.
