# CHATAPP REALTIME GUIDE 
## 1. Luồng hoạt động 
- Khi tạo một hóa đơn thì phải tiến hành tạo luôn một conversationId 
- Mỗi conversation tương ứng với một đoạn hội thoại. Khi nhấn vào biểu tượng khung chat cua hóa đơn. 
- FE: Phát sự kiện join-room, cho user join vào room của đoạn hội thoại. 
- BE: Nhận và phản hồi lại sự kiện join-room. 



## Nhớ chú ý cái cột deleteAt. Chỉ thực hiện thao tác với các phần tử chưa bị xóa đi. 