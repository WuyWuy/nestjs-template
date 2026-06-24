# HƯỚNG DẪN TIẾN HÀNH MANUAL TESTING CHO PAYMENT 

Lưu ý: Ở bên dưới chỉ là các hướng do tui (Khả An) tiến hành test. Vì vậy thằng TL hay GT mà test thì có thể mấy cái id như orderId, paymentId sẽ thay đổi, nhớ cần thận chứ đừng bê nguyên cái body trong docs này dán dô API docs (chắc đủ thông minh để hiểu)

## **KỊCH BẢN 1: THANH TOÁN QUA VÍ MOMO (DÙNG WEBHOOK GIẢ LẬP)**

Kịch bản này mô phỏng luồng Khách hàng đặt món, chọn thanh toán MoMo, hệ thống tạo hóa đơn chờ và sau đó nhận được tín hiệu báo thanh toán thành công từ cổng MoMo.

### Bước 1: Đăng nhập Khách hàng để lấy Access Token
Gửi request đăng nhập bằng tài khoản Customer 1:
* **HTTP Method & URL**: `POST http://localhost:4000/api/auth/login`
* **Headers**: `Content-Type: application/json`
* **Body**:
  ```json
  {
    "phone": "0900000003",
    "password": "customer123"
  }
  ```
* **Kết quả**: Sao chép chuỗi `accessToken` trả về trong Response để sử dụng cho bước tiếp theo.

![alt text](image-11.png)

### Bước 2: Khách hàng tạo đơn hàng thanh toán MoMo
* **HTTP Method & URL**: `POST http://localhost:4000/api/orders`
* **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer <TOKEN_CUSTOMER_BUOC_1>`
* **Body**:
  ```json
  {
    "restaurantId": 1,
    "savedAddressId": 1,
    "orderFoods": [
      {
        "foodId": 1,
        "quantity": 2,
        "foodSizeId": 1
      }
    ],
    "paymentMethod": "MOMO",
    "note": "Kiểm thử thanh toán MoMo",
    "clearCartAfterOrder": true
  }
  ```
**Kết quả phản hồi**: Nhận về thông tin chi tiết đơn hàng vừa tạo. 
  ```json
  "paymentInformation": {
    "partnerCode": "MOMO",
    "orderId": 8,  // Cần lưu lại mã này
    "payUrl": "https://sandbox.momo.vn/mock-pay?orderId=12&amount=...",
    "resultCode": 0,
    "message": "Mock MoMo payment created..."
  }
  ```

*Ghi lại giá trị của orderId được trả về. Trong ví dụ trên là 8. Hệ thống Backend sẽ tiến hành giả lập một MomoID với cú pháp: MOMO-ORDER-${orderId}. Trong ví dụ trên, order có id là 12 nên bây giờ cứ tạm nhớ trong đầu, mã MOMO sẽ là MOMO-ORDER-8* 

![alt text](image-10.png)


### Bước 3: Xem chi tiết thanh toán ban đầu

Chúng ta có thể kiểm tra trạng thaisd của giao dịch thông qua một mã đơn hàng (orderId) 

* **HTTP Method & URL**: `GET http://localhost:4000/api/payment/8`

![alt text](image-12.png)

### Bước 4: Giả lập cổng thanh toán MoMo gọi Webhook thành công

Ở bước này chúng ta sẽ sử dụng MomoID để giả lập việc khách hàng đã quét mã và thanh toán thành công trên ứng dụng MoMo. 

* **HTTP Method & URL**: `POST http://localhost:4000/api/payment/check-payment`
* **Headers**: `Content-Type: application/json`
* **Body**:
  ```json
  {
    "momoOrderId": "MOMO-ORDER-8", // Khớp với momoOrderId nhận được ở Bước 2
    "status": "DONE"
  }
  ```
* **Kết quả**: Trả về thông tin thanh toán đã cập nhật thành công với trạng thái `"paymentStatus": "DONE"`.
* *(Bạn cũng có thể thử nghiệm truyền `"status": "FAILED"` để kiểm tra kịch bản thanh toán thất bại).*


![alt text](image-13.png)


### Bước 5: Kiểm tra lại trạng thái giao dịch
Gọi lại API xem chi tiết thanh toán của đơn hàng để xác minh dữ liệu đã thay đổi vĩnh viễn trong Database:
* **HTTP Method & URL**: `GET http://localhost:4000/api/payment/8`
* **Kết quả**: Xác minh trường `paymentStatus` đã chuyển sang giá trị `"DONE"`.

![alt text](image-14.png)


---

## KỊCH BẢN 2: THANH TOÁN TIỀN MẶT (CASH) & XÁC NHẬN THỦ CÔNG

Kịch bản này mô phỏng luồng đặt hàng thanh toán khi nhận hàng (COD). Trạng thái thanh toán ban đầu sẽ là chưa thanh toán, sau đó chủ cửa hàng hoặc admin sẽ bấm xác nhận khi đã nhận tiền mặt từ shipper/khách hàng.

### Bước 1: Khách hàng tạo đơn hàng thanh toán tiền mặt (CASH)
* **HTTP Method & URL**: `POST http://localhost:4000/api/orders`
* **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer <TOKEN_CUSTOMER_O_KICH_BAN_1>`
* **Body**:
  ```json
  {
    "restaurantId": 1, 
    "savedAddressId": 1,
    "orderFoods": [
      {
        "foodId": 1,
        "quantity": 1,
        "foodSizeId": 1
      }
    ],
    "paymentMethod": "CASH",
    "note": "Thanh toan tiền mặt khi nhận hàng"
  }
  ```
* **Kết quả**: Nhận về chi tiết đơn hàng mới. Ghi lại:
  - ID của đơn hàng (ví dụ: 9).
  - Lấy thông tin ID của Payment bằng cách gọi API xem chi tiết thanh toán của đơn hàng 9.

![alt text](image-15.png)


### Bước 2: Xem chi tiết thanh toán để lấy `paymentId`
* **HTTP Method & URL**: `GET http://localhost:4000/api/payment/13`
* **Kết quả**: Response trả về có thông tin giao dịch thanh toán:

```json
{
  "success": true,
  "data": {
    "id": 9,  //paymentId can ghi nho 
    "orderId": 9,
    "amount": 16,
    "method": "CASH",
    "paymentStatus": "UNPAID",
    "createdAt": "2026-06-24T16:09:16.786Z"
  }
}
```
  *(Ghi nhớ `paymentId` ở đây cũng là 9 luôn :).*

### Bước 3: Đăng nhập tài khoản Business (Chủ nhà hàng) để lấy Token
Đơn hàng thuộc nhà hàng `restaurantId: 1` (Burger Town), thuộc sở hữu của Business `0900000002`.

* **Body**:
  ```json
  {
    "phone": "0900000002",
    "password": "business123"
  }
  ```

![alt text](image-16.png)

Giữ lấy Access Token của nhà hàng này. 

### Bước 4: Gọi API xác nhận thanh toán bằng tài khoản Business

Đường link này sẽ được Admin hoặc là Bussiness (Nhà hàng) quản lý order này xử lý bằng tay. Vì vậy ở bước trên tôi mới yêu cầu lấy JWT Token của nhà hàng quản lý order này. Bây giờ chúng ta sẽ thêm vào Jwt Token của nhà hàng, cùng với paymentId. Vậy là đơn hàng đã được xác nhận thanh toán thành công. 


* **HTTP method& URL**: PATCH /api/payment/manage/{paymentId}/confirm
* **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <TOKEN_BUSINESS_BUOC_3>`
* **Body**: Không cần truyền body.

![alt text](image-17.png)


### Kiểm tra phân quyền (Ủy quyền lỗi - Authorization Test)
Để chứng minh cơ chế bảo mật hoạt động đúng, ta đăng nhập tài khoản Business 2 (là chủ của nhà hàng khác - Rice Express) để xác nhận thanh toán của đơn hàng Burger Town này:
1. Đăng nhập Business 2:
   - `POST /api/auth/login` với body:
     ```json
     {
       "phone": "0900000005",
       "password": "business123"
     }
     ```
   - Lấy `accessToken` của Business 2.
2. Gửi request xác nhận thanh toán:
   - `PATCH http://localhost:4000/api/payment/manage/8/confirm` (ID thanh toán Burger Town ở bước trước)
   - Headers: `Authorization: Bearer <TOKEN_BUSINESS_2>`
3. **Kết quả kỳ vọng**: Hệ thống trả về lỗi **`403 Forbidden`** với thông điệp: `"You are not allowed to manage this restaurant"`.
