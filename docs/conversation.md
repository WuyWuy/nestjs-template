# Conversation Real-time Chat Spec

## 1. Thuật ngữ và khái niệm

- `Conversation`: phòng chat duy nhất giữa một `customerId` và một `sellerId`.
- `Room`: room của Socket.IO theo format `room-{conversationId}`.
- `Customer`: người mua, thường là người tạo conversation.
- `Seller`: người bán, là đối tượng chat với customer.
- `Join room`: thao tác client tham gia room trước khi nhận/gửi tin nhắn realtime.
- `text-chat`: tên event socket để gửi và nhận tin nhắn realtime.
- `exception`: event socket trả lỗi cho client.
- `JWT token`: access token dùng để xác thực cả REST API và Socket connection.

## 2. Thành phần chính

- REST API:
    - `conversation.controller.ts`
    - `conversation.service.ts`
- Realtime Socket:
    - `chat.gateway.ts`
    - `chat.service.ts`
    - `ws-exception.filter.ts`

## 3. Tổng quan luồng hoạt động

1. FE tạo hoặc lấy conversation theo `sellerId`.
2. FE mở socket kèm `Authorization: Bearer <access_token>`.
3. FE emit `join-room` với `conversationId`.
4. Backend kiểm tra user có thuộc conversation không.
5. FE emit `text-chat` để gửi tin.
6. Backend kiểm tra quyền, lưu DB, sau đó broadcast về room `room-{conversationId}`.
7. Các client trong room nhận lại event `text-chat` để cập nhật UI.

## 4. Luồng REST API (Conversation)

## 4.1. Tạo conversation

- Endpoint: `POST /conversation`
- Guard: `JwtAuthGuard`, `RolesGuard`
- Role yêu cầu: `CUSTOMER`
- Body: `CreateConversationDto` (chứa `sellerId`)

Logic chính trong service:

- Kiểm tra seller là owner của một restaurant.
- Tìm conversation theo cặp `customerId + sellerId`; nếu chưa có thì tạo mới.
- Trả về conversation đã có hoặc vừa tạo.

## 4.2. Lấy danh sách conversation của user

- Endpoint: `GET /conversation/user/:userId`
- Trả về các conversation mà user là `customer` hoặc `seller`.

## 4.3. Lấy chi tiết conversation theo order

- Endpoint: `GET /conversation/detail?orderId=...&limit=...&offset=...`
- Guard: `JwtAuthGuard`
- Backend dùng `orderId` để suy ra `customerId` và `sellerId`, sau đó tìm conversation theo cặp này.
- Trả về:
    - `conversation`
    - `messages` (sắp xếp `createdAt desc`)
- Message được map thêm trường:
    - `who = "me"` nếu `senderId == userId`
    - `who = "other"` nếu ngược lại

## 5. Luồng Realtime Socket

## 5.1. Kết nối socket

Khi client connect:

- Backend đọc header `authorization` trong handshake.
- Nếu token hợp lệ: decode JWT và gán vào `client.user`.
- Nếu thiếu/sai token:
    - emit `exception` với status `error`
    - ngắt kết nối.

## 5.2. Join room

- Event vào: `join-room`
- Payload: `{ conversationId }`

Backend xử lý:

- `chatService.validateConversation(userId, conversationId)`:
    - kiểm tra conversation tồn tại
    - kiểm tra user phải là `customer` hoặc `seller` của conversation
- Nếu hợp lệ: `client.join('room-{conversationId}')`

## 5.3. Gửi tin nhắn

- Event vào: `text-chat`
- Payload: `{ conversationId, content }`

Backend xử lý:

- Kiểm tra conversation tồn tại.
- Kiểm tra sender thuộc conversation.
- Lưu DB vào bảng `message`.
- Emit lại cho room:
    - Event ra: `text-chat`
    - Payload:

```json
{
    "data": {
        "id": 100,
        "conversationId": 20,
        "senderId": 5,
        "content": "Xin chao",
        "createdAt": "2026-05-07T10:20:00.000Z"
    },
    "status": "success"
}
```

## 5.4. Xử lý lỗi realtime

- Tất cả `WsException` được filter bởi `WebSocketExceptionFilter`.
- Backend emit event `exception` dạng:

```json
{
    "status": "error",
    "content": "Chat message is invalid"
}
```

## 6. Danh sách event Socket chuẩn

- Client -> Server:
    - `join-room`
    - `text-chat`
- Server -> Client:
    - `text-chat`
    - `exception`

## 7. Ví dụ FE Kotlin (Socket.IO)

Ví dụ minh họa tích hợp Android (Socket.IO Java client):

```kotlin
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject

val opts = IO.Options()
opts.extraHeaders = mapOf(
    "authorization" to listOf("Bearer $accessToken")
)

val socket: Socket = IO.socket("https://api.your-domain.com", opts)

socket.on(Socket.EVENT_CONNECT) {
    // Join room sau khi connect
    val joinPayload = JSONObject()
    joinPayload.put("conversationId", conversationId)
    socket.emit("join-room", joinPayload)
}

socket.on("text-chat") { args ->
    // args[0] la payload server broadcast
    val data = args[0] as JSONObject
    // update UI message list
}

socket.on("exception") { args ->
    val err = args[0] as JSONObject
    // show error toast/dialog
}

fun sendMessage(conversationId: Int, content: String) {
    val payload = JSONObject()
    payload.put("conversationId", conversationId)
    payload.put("content", content)
    socket.emit("text-chat", payload)
}

socket.connect()
```

## 8. Gợi ý sử dụng đúng ở FE

1. Luôn gọi API lấy chi tiết conversation trước để render lịch sử chat ban đầu.
2. Chỉ emit `text-chat` sau khi đã `join-room` thành công.
3. Bắt event `exception` để xử lý token hết hạn, không thuộc conversation, payload sai format.
4. Khi rời màn chat, có thể disconnect socket hoặc leave room tùy kiến trúc app.
