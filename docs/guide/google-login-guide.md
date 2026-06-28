# Hướng dẫn tích hợp và manual test đăng nhập Google

Tài liệu này mô tả luồng đăng nhập Google trên ứng dụng Android và API backend hiện tại. FE chỉ cần lấy **Google ID token** rồi gửi token đó cho BE; không gửi Google access token, authorization code hoặc Google user ID.

## 1. Tổng quan luồng xử lý

1. Người dùng chọn **Đăng nhập bằng Google** trên ứng dụng Android.
2. Google SDK/Credential Manager xác thực người dùng và trả về `idToken`.
3. FE gọi `POST /api/auth/login-google` và gửi `idToken` trong JSON body.
4. BE dùng Google Auth Library để kiểm tra chữ ký, thời hạn và `audience` của token.
5. BE lấy các thông tin `sub`, `email`, `name`, `given_name`, `picture` từ token đã xác thực.
6. BE tạo mới hoặc liên kết tài khoản, sau đó trả về `accessToken`, `refreshToken` và thông tin người dùng.

BE dùng `sub` của Google làm mã định danh tài khoản Google. Email chỉ được dùng để tìm và liên kết với tài khoản đã tồn tại.

## 2. Cấu hình Google OAuth

Trong cùng một Google Cloud project, cần tạo:

- **OAuth client loại Android**: cấu hình bằng package name và SHA-1 certificate fingerprint của ứng dụng. Cần khai báo đúng SHA-1 tương ứng với bản debug hoặc release đang test.
- **OAuth client loại Web application**: client ID này được dùng làm server client ID ở FE và `audience` khi BE xác thực ID token.

### Cấu hình BE

```env
GOOGLE_OAUTH_CLIENT_ID=<WEB_CLIENT_ID>
GOOGLE_OAUTH_CLIENT_SECRET=<WEB_CLIENT_SECRET>
```

Trong luồng `login-google` hiện tại:

- `GOOGLE_OAUTH_CLIENT_ID` là biến bắt buộc và phải đúng bằng Web client ID mà FE dùng để yêu cầu ID token.
- `GOOGLE_OAUTH_CLIENT_SECRET` không được dùng khi BE gọi `verifyIdToken`, nhưng vẫn chỉ được lưu ở BE và tuyệt đối không đưa vào source code hoặc ứng dụng FE.
- `google.provider.ts` còn đọc biến `GOOGLE_CLIENT_ID`. Nếu môi trường có khai báo biến này, nên đặt nó bằng chính `GOOGLE_OAUTH_CLIENT_ID` để tránh hai cấu hình khác nhau.
- BE không sử dụng biến `GOOGLE_ANDROID_APP_ID`. Thông tin Android client được cấu hình trên Google Cloud bằng package name và SHA-1.

### Cấu hình FE

FE cần lưu Web client ID dưới tên phù hợp với dự án, ví dụ `WEB_CLIENT_ID`, rồi truyền giá trị này vào `setServerClientId(...)` hoặc API tương đương của Google SDK.

```text
WEB_CLIENT_ID == GOOGLE_OAUTH_CLIENT_ID
```

Không đưa `GOOGLE_OAUTH_CLIENT_SECRET` vào ứng dụng FE.

## 3. FE lấy Google ID token

Với Credential Manager trên Android, cấu hình yêu cầu đăng nhập bằng Web client ID:

```kotlin
val googleIdOption = GetGoogleIdOption.Builder()
    .setFilterByAuthorizedAccounts(false)
    .setServerClientId(WEB_CLIENT_ID)
    .build()
```

Sau khi nhận credential hợp lệ, lấy ID token:

```kotlin
val googleCredential =
    GoogleIdTokenCredential.createFrom(credential.data)

val idToken = googleCredential.idToken
```

Tên class có thể khác nếu FE đang dùng framework hoặc Google SDK khác, nhưng kết quả gửi cho BE phải là **ID token dạng JWT**, thường gồm ba phần ngăn cách bởi dấu chấm:

```text
xxxxx.yyyyy.zzzzz
```

Không gửi các giá trị sau vào API này:

- Google access token, thường bắt đầu bằng `ya29...`;
- authorization code;
- `credential.id` hoặc Google user ID;
- Web client ID hay client secret.

## 4. Gọi API đăng nhập Google

### Request

```http
POST /api/auth/login-google
Content-Type: application/json
```

Local URL mặc định:

```text
http://localhost:4000/api/auth/login-google
```

Body:

```json
{
  "idToken": "<GOOGLE_ID_TOKEN>"
}
```

Ví dụ kiểm tra nhanh bằng cURL:

```bash
curl -X POST "http://localhost:4000/api/auth/login-google" \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<GOOGLE_ID_TOKEN>"}'
```

Không cần gửi access token của hệ thống trong header vì đây là API đăng nhập công khai.

### Response thành công

Endpoint `POST` hiện trả HTTP `201 Created`.

```json
{
  "accessToken": "<ACCESS_TOKEN>",
  "refreshToken": "<REFRESH_TOKEN>",
  "user": {
    "id": 1,
    "name": "Nguyen Van A",
    "email": "user@gmail.com",
    "phone": null,
    "birthday": "1970-01-01T00:00:00.000Z",
    "avatar": "https://lh3.googleusercontent.com/...",
    "active": true,
    "roles": ["CUSTOMER"]
  }
}
```

Với tài khoản Google mới, BE hiện đặt:

- `phone`: `null`;
- `birthday`: `1970-01-01T00:00:00.000Z` vì Google không cung cấp ngày sinh trong ID token;
- role mặc định: `CUSTOMER`;
- `active`: `true`;
- mật khẩu: BE tự sinh và hash, FE không nhận hoặc sử dụng giá trị này.

Nếu người dùng đã tồn tại, `phone`, `birthday` và các thông tin khác sẽ giữ theo dữ liệu hiện có trong database.

## 5. Cách BE tạo hoặc liên kết tài khoản

Sau khi ID token hợp lệ, BE xử lý theo thứ tự:

1. Nếu đã có identity với cặp `GOOGLE + sub`, BE đăng nhập đúng tài khoản đã liên kết.
2. Nếu chưa có identity nhưng đã có user cùng email, BE liên kết identity Google với user đó.
3. Nếu chưa có user cùng email, BE tạo user mới và identity Google.

Trong mọi trường hợp thành công, BE bảo đảm user có role `CUSTOMER`, tạo cặp token mới và lưu refresh token vào database.

FE không cần tách riêng API đăng ký và đăng nhập Google. Cả người dùng mới và người dùng cũ đều gọi cùng endpoint và nhận cùng một cấu trúc response.

## 6. FE sử dụng token của hệ thống

- Dùng `accessToken` cho các API yêu cầu đăng nhập:

```http
Authorization: Bearer <ACCESS_TOKEN>
```

- Lưu `refreshToken` trong vùng lưu trữ an toàn của thiết bị; không ghi token vào log.
- Khi cần làm mới phiên đăng nhập, gọi:

```http
POST /api/auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "<REFRESH_TOKEN>"
}
```

- Google ID token chỉ dùng để đăng nhập Google. Sau khi BE trả kết quả, FE phải dùng `accessToken` và `refreshToken` do BE cấp cho các API của hệ thống.

## 7. Quy trình manual testing

### Chuẩn bị

1. BE đã chạy và truy cập được `http://localhost:4000/api/docs`.
2. `GOOGLE_OAUTH_CLIENT_ID` của BE trùng với `WEB_CLIENT_ID` của FE.
3. Package name và SHA-1 của bản Android đang test đã được khai báo trong Android OAuth client.
4. Thiết bị hoặc emulator có Google Play services và đã đăng nhập tài khoản Google.
5. Khi test trên thiết bị thật, không dùng `localhost` làm địa chỉ BE; dùng IP LAN hoặc URL HTTPS mà thiết bị truy cập được.

### Test luồng thành công

1. Mở ứng dụng và chọn **Đăng nhập bằng Google**.
2. Chọn một tài khoản Google.
3. Kiểm tra FE nhận được `idToken` khác `null` và gửi đúng field `idToken`.
4. Kiểm tra API trả `201`, có `accessToken`, `refreshToken` và `user`.
5. Dùng `accessToken` gọi `GET /api/auth/me` với Bearer token để xác nhận phiên đăng nhập hoạt động.
6. Đăng nhập lại bằng cùng tài khoản Google và xác nhận `user.id` không thay đổi.
7. Gọi `/api/auth/refresh` bằng refresh token và xác nhận nhận được cặp token mới.

### Các trường hợp cần kiểm tra

| Trường hợp | Kết quả mong đợi |
| --- | --- |
| Google ID token hợp lệ, tài khoản mới | Tạo user mới, trả `201` và role `CUSTOMER` |
| Đăng nhập lại cùng tài khoản Google | Không tạo user mới, trả cùng `user.id` |
| Email đã tồn tại ở tài khoản local | Liên kết Google identity với user hiện có |
| Thiếu `idToken` hoặc gửi chuỗi rỗng | Request bị từ chối với lỗi validation `400` |
| `idToken` không phải chuỗi | Request bị từ chối với lỗi validation `400` |
| Token hết hạn, bị sửa hoặc sai `audience` | BE từ chối đăng nhập; không tạo user và không trả token hệ thống |
| Người dùng hủy hộp thoại Google | FE không gọi API và hiển thị trạng thái hủy phù hợp |
| Thiết bị mất mạng | FE hiển thị lỗi kết nối và cho phép thử lại |

## 8. Xử lý lỗi thường gặp

### FE nhận `idToken = null`

- Kiểm tra FE đã yêu cầu ID token bằng Web client ID.
- Kiểm tra không dùng nhầm Android client ID trong `setServerClientId`.
- Kiểm tra package name và SHA-1 của đúng build variant.

### Token bị BE từ chối

- So sánh `WEB_CLIENT_ID` của FE với `GOOGLE_OAUTH_CLIENT_ID` của BE; hai giá trị phải giống nhau hoàn toàn.
- Lấy ID token mới và thử lại vì ID token có thời hạn ngắn.
- Không dùng access token hoặc authorization code thay cho ID token.
- Không tái sử dụng token lấy từ một Google Cloud project khác.

### Android không hiển thị tài khoản

- Kiểm tra thiết bị/emulator có Google Play services.
- Kiểm tra thiết bị đã đăng nhập tài khoản Google.
- Nếu đang lọc tài khoản đã từng cấp quyền, thử lại với `setFilterByAuthorizedAccounts(false)`.

## 9. Lưu ý theo API hiện tại

- Contract thực tế của `POST /api/auth/login-google` chỉ nhận `{ "idToken": "..." }` theo `GoogleAuthDto`.
- Phần mô tả Swagger cũ có thể vẫn hiển thị `accessToken` hoặc `code`; không sử dụng hai field đó cho endpoint này.
- Không log hoặc gửi ID token, access token, refresh token và client secret qua các kênh trao đổi công khai.

## 10. Tài liệu tham khảo

- [Android Credential Manager - Implement Sign in with Google](https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation)
- [Google - Authenticate with a backend server](https://developers.google.com/identity/sign-in/android/backend-auth)
