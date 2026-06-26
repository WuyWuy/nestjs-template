# CHATAPP REALTIME GUIDE 
## 1. Luồng hoạt động 
- Khi tạo một hóa đơn thì reuse conversationId hiện có giữa customer và seller, nếu chưa có thì tạo mới.
- Mỗi conversation tương ứng với một cặp customer/seller duy nhất, không tương ứng riêng với từng hóa đơn.
- FE: Phát sự kiện join-room, cho user join vào room của đoạn hội thoại. 
- BE: Nhận và phản hồi lại sự kiện join-room. 



## Nhớ chú ý cái cột deleteAt. Chỉ thực hiện thao tác với các phần tử chưa bị xóa đi.
