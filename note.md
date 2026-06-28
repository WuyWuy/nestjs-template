This template server includes: 
- Prisma Setup 
- Authentication 
- Validator, Interceptors, Guards  
- Scalar Api Reference  
- Email Services 

=== Noi dung can nang cap trong Template Nestjs 
- token.enum.ts : Change sub to id 
- tsconfig.json & tsconfig.build.json 
- trasnform interceptor: Add success to response 
- http-exception-filter: Add success to response 
- create response.body 
- Create hashing function (utility)  
- Create redis service for rate limit and so more 
- Update role.decorator.ts 
- role.guard.ts    



## Thay đổi email 
- Bước 1. Yêu cầu người dùng nhập số điện thoại và mật khẩu 
- Bước 2. Gửi OTP về số điện thoại người dùng 
- Bước 3. hập email mới, kèm với OTP gửi về để tiến hành đổi email 

## Thay đổi mật khẩu 
### Quên mật khẩu 
Sử dụng mật khẩu mặc định ? 
- Bước 1. Yêu cầu người dùng nhập email 
- Bước 2. Gửi mã xác nhận về email của người dùng 
- Bước 3. Đặt lại mật khẩu theo mật khẩu mặc định (Mật khẩu mặc định) 

### Thay đổi mật khẩu 
? 

## Thay đổi phone 
- Bước 1. Yêu cầu người dùng nhập email 
- Bước 2. Gửi email về tài khoản người dùng + (mã thay đổi mật khẩu)
- Bước 3. Nhập số điện thoại mới + mã gửi về email 

## Thêm mới một địa điểm 
- Ở giao diện Frontend, call về GGMap API, liên tục cập nhật 
- Khi người dùng chọn vào một address và bấm xác nhận. Gửi địa điểm này về cho Backend lưu trữ và tạo mối liên kết 
    + Tránh trùng lặp địa điểm: Kiểm tra tung độ và vĩ độ đc chọn có xấp xỉ với cái nào trong Database không, nhớ xấp xỉ nhỏ thôi (tầm 0.000001)