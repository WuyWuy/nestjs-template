# HƯỚNG DẪN KIỂM THỬ THỦ CÔNG (MANUAL TEST) CHỨC NĂNG THANH TOÁN (PAYMENT)

Tài liệu này cung cấp chi tiết về các API thanh toán hiện tại trong hệ thống Backend và hướng dẫn từng bước để tiến hành kiểm thử thủ công (manual testing) bằng các công cụ như Postman hoặc cURL.

---

## 1. Tổng Quan Hệ Thống Thanh Toán (Payment System Overview)

Mối quan hệ giữa Đơn hàng (**Order**) và Giao dịch thanh toán (**Payment**) được quy định như sau:
* **Quan hệ 1-1**: Mỗi đơn hàng (Order) chỉ có tối đa một giao dịch thanh toán (Payment) tương ứng.
* **Khởi tạo**: Khi khách hàng tạo đơn hàng thành công qua API `POST /api/orders`, một bản ghi giao dịch thanh toán (`Payment`) sẽ được tự động tạo kèm theo với trạng thái ban đầu là `UNPAID`.
* **Phát triển & Kiểm thử**:
  - Đối với phương thức thanh toán **MoMo**: Hệ thống hỗ trợ kết nối với môi trường MoMo Sandbox. Trong trường hợp các cấu hình môi trường MoMo (`MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`) chưa được thiết lập hoặc gặp lỗi kết nối, hệ thống sẽ tự động chuyển sang chế độ **Giả lập MoMo (Mock Response)** để không làm gián đoạn luồng kiểm thử.
  - Đối với phương thức thanh toán **Tiền mặt (Cash)**: Trạng thái thanh toán mặc định là `UNPAID`. Khi người giao hàng thu tiền hoặc đơn hàng hoàn thành, chủ nhà hàng (Business Owner) hoặc quản trị viên (Admin) sẽ xác nhận thanh toán thủ công trên hệ thống.

### Các Phương Thức Thanh Toán (PaymentMethod)
* `MOMO`: Thanh toán trực tuyến qua ví điện tử MoMo.
* `CASH`: Thanh toán bằng tiền mặt khi nhận hàng (Cod).

### Các Trạng Thái Thanh Toán (PaymentStatus)
* `UNPAID`: Chưa thanh toán (Trạng thái mặc định ban đầu).
* `FAILED`: Thanh toán thất bại.
* `SOLVING`: Đang xử lý sự cố.
* `DONE`: Đã thanh toán thành công.

---

## 2. Chi Tiết Các API Thanh Toán

Hệ thống cung cấp 3 API chính phục vụ cho nghiệp vụ thanh toán (với tiền tố mặc định của toàn bộ endpoint là `/api`):

| HTTP Method | API Path | Auth Required | Phân quyền (Roles) | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| **POST** | `/api/payment/check-payment` | Không | Công khai (Webhook/IPN) | Nhận cập nhật trạng thái thanh toán từ cổng thanh toán MoMo (hoặc từ DEV giả lập). |
| **GET** | `/api/payment/:orderId` | Không | Công khai | Xem chi tiết thông tin thanh toán theo mã đơn hàng (`orderId`). |
| **PATCH** | `/api/payment/manage/:paymentId/confirm` | Có | `ADMIN`, `BUSINESS` | Xác nhận giao dịch thanh toán thủ công (thường dùng cho Cash). |

### Chi tiết tham số và định dạng dữ liệu từng API

### 2.1. Webhook cập nhật trạng thái MoMo (`POST /api/payment/check-payment`)
* **Mô tả**: Đây là endpoint IPN (Instant Payment Notification) nhận dữ liệu callback từ MoMo. Khi kiểm thử thủ công, chúng ta dùng API này để giả lập trạng thái trả về từ MoMo.
* **Request Body (JSON)**:
  ```json
  {
    "momoOrderId": "string",
    "status": "PaymentStatus" // DONE hoặc FAILED
  }
  ```
  > [!NOTE]  
  > Hệ thống phân tích `momoOrderId` theo cấu trúc: nếu chứa ký tự `-` (ví dụ: `mock-12` hoặc `partnerCode-12`), ID thực tế của đơn hàng (Order ID) sẽ là phần tử cuối cùng sau dấu `-` (ở đây là `12`).
* **Response thành công (`201 Created`)**:
  ```json
  {
    "id": 5,
    "orderId": 12,
    "method": "MOMO",
    "amount": "150.00",
    "paymentStatus": "DONE",
    "createdAt": "2026-06-24T15:00:00.000Z",
    "updatedAt": "2026-06-24T15:05:00.000Z",
    "deleteAt": null
  }
  ```

### 2.2. Xem chi tiết thanh toán (`GET /api/payment/:orderId`)
* **Mô tả**: Lấy thông tin thanh toán của đơn hàng cụ thể dựa trên `orderId` (ID dạng số).
* **Path Parameter**: `orderId` (ID của đơn hàng trong cơ sở dữ liệu, ví dụ: `/api/payment/12`).
* **Response thành công (`200 OK`)**:
  ```json
  {
    "id": 5,
    "orderId": 12,
    "amount": 150000,
    "method": "MOMO",
    "paymentStatus": "UNPAID",
    "createdAt": "2026-06-24T15:00:00.000Z"
  }
  ```

### 2.3. Xác nhận thanh toán thủ công (`PATCH /api/payment/manage/:paymentId/confirm`)
* **Mô tả**: Cho phép Business (Chủ nhà hàng nhận đơn hàng đó) hoặc Admin xác nhận đơn hàng đã thanh toán thành công (chuyển `paymentStatus` sang `DONE`).
* **Path Parameter**: `paymentId` (ID của bản ghi thanh toán, lấy từ API chi tiết thanh toán hoặc chi tiết đơn hàng).
* **Headers**: `Authorization: Bearer <JWT_TOKEN>`
* **Cơ chế Phân quyền (Authorization)**:
  - Tài khoản có quyền `ADMIN` được xác nhận thanh toán cho mọi đơn hàng.
  - Tài khoản có quyền `BUSINESS` chỉ được xác nhận thanh toán nếu nhà hàng thực hiện đơn hàng đó do chính Business này làm chủ (`ownerId === actorId`). Nếu không phải chủ nhà hàng, hệ thống sẽ trả về lỗi `403 Forbidden`.
* **Phản ứng phụ (Side-effects)**: 
  - Gửi thông báo tự động (Notification) về ứng dụng cho khách hàng báo thanh toán thành công.
  - Lưu nhật ký hệ thống (Audit Log) với hành động `CONFIRM_PAYMENT`.
* **Response thành công (`200 OK`)**:
  ```json
  {
    "id": 5,
    "orderId": 12,
    "method": "CASH",
    "amount": 120000,
    "paymentStatus": "DONE",
    "createdAt": "2026-06-24T15:00:00.000Z",
    "updatedAt": "2026-06-24T15:10:00.000Z",
    "deleteAt": null
  }
  ```

---

## 3. Dữ Liệu Kiểm Thử Mặc Định (Seed Data)

Bạn có thể sử dụng các tài khoản đã được cài đặt sẵn trong cơ sở dữ liệu (từ file seed) để thực hiện kiểm thử:

| Loại Tài Khoản | Số Điện Thoại | Mật Khẩu | Vai Trò (Roles) | Ghi Chú |
| :--- | :--- | :--- | :---: | :--- |
| **Quản trị viên (Admin)** | `0900000001` | `admin123` | `ADMIN` | Quản trị toàn hệ thống. |
| **Đối tác/Nhà hàng 1 (Business)** | `0900000002` | `business123` | `BUSINESS` | Chủ nhà hàng **Burger Town** và **Gourmet World**. |
| **Đối tác/Nhà hàng 2 (Business)** | `0900000005` | `business123` | `BUSINESS` | Chủ nhà hàng **Rice Express**. |
| **Khách hàng 1 (Customer)** | `0900000003` | `customer123` | `CUSTOMER` | Có địa chỉ đã lưu (`savedAddressId` thường là `1` hoặc `2`). |
| **Khách hàng 2 (Customer)** | `0900000004` | `customer456` | `CUSTOMER` | Dùng để đặt các đơn hàng khác. |

---
