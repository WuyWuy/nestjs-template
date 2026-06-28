# Soft Delete

## 1. Tổng quan về Soft Delete

`Soft delete` là kỹ thuật **không xóa vật lý dữ liệu khỏi database** khi người dùng thực hiện thao tác xóa.
Thay vì `DELETE` record, hệ thống sẽ đánh dấu record đó là đã bị xóa bằng một cột thời gian, ví dụ: `deleteAt`.

- Nếu `deleteAt = null`: dữ liệu còn hiệu lực.
- Nếu `deleteAt != null`: dữ liệu đã bị soft delete.

Mục tiêu chính:
- Tránh mất dữ liệu vĩnh viễn do thao tác nhầm.
- Dễ phục hồi dữ liệu nếu cần.
- Hỗ trợ audit/lịch sử nghiệp vụ tốt hơn.

---

## 2. Những gì đã thay đổi, lý do thay đổi, và lợi ích

## 2.1. Những thay đổi đã thực hiện

Đã thêm cấu hình soft Delete extension vào bên trong Prisma. Điều này sẽ giúp hệ thống an toàn hơn khi xử lý nghiệp vụ. Đồng thời tránh trường hợp lặp `deleteAt` ở nhiều nơi trong đoạn code. 

- Sau này, mỗi câu lệnh query prisma sẽ mặc định chỉ lấy các trường (record) có deleteAt NULL (chưa bị xóa). Khi gọi hàm delete thì chỉ cần truyền id, nó sẽ tự động chuyển deleteAt của record có id tương ứng thành DateTime(). 

### Các thay đổi đã thực hiện chính trong code. 
1. **Thêm cột `deleteAt` vào các bảng cần soft delete** trong database (kiểu `DateTime?`, mặc định `null`).
2. **Thêm Prisma Client Extensions** trong `src/prisma/prisma.extension.ts`:
- Override `delete` -> chuyển thành `update({ deleteAt: new Date() })`.
- Override `deleteMany` -> chuyển thành `updateMany({ deleteAt: new Date() })`.
- Tự động lọc dữ liệu đã xóa cho các query đọc (`findUnique`, `findFirst`, `findMany`) bằng điều kiện `deleteAt: null`.
3. **Chuẩn hóa cách dùng Prisma qua `prismaService.client`** để đảm bảo extension luôn được áp dụng.
4. **Thêm wrapper transaction** `prismaService.transaction(async (tx) => ...)` để extension hoạt động nhất quán cả trong transaction.

## 4. Cách cái đặt 
### 4.1. Reset Database 

- Clone code mới về, phải **đảm bảo thư mục prisma/migrations là mới nhất theo source code** up lên. Nói chung là clone lại đi cho chắc rồi ghép code cũ vào :)) 

- Xóa thư mục generated cũ trong source code. 
- Chạy lần lượt các lệnh sau để reset database 
```bash 
bun prisma db migrate reset 
``` 

```bash 
bun prisma db push
``` 

```bash 
bun prisma generate 
``` 

- Seeding dữ liệu: 
```bash 
bun prisma db seed 
``` 
- Có thể kiểm tra database tại đường link: http://localhost:51212 
bằng cách chạy lệnh: 
```bash 
bun prisma studio 
```

### 4.1. Thêm UNIQUE_INDEX cho database 
- Sau khi đã có database thành công. Hãy mở Terminal tại thư mục root của project. Chạy lệnh sau: 
```bash 
docker exec -it <docker_image> psql -U username -d database_name < unique_index.sql 
```
## 3. Cú pháp mới và cách sử dụng

## 3.1. Query thường (normal queries)

**Cú pháp cũ:**
```ts
const users = await prismaService.user.findMany();
```

**Cú pháp mới:**
```ts
const users = await prismaService.client.user.findMany();   //Thêm một cái .client vào ngay sau biến prismaService 
```

Ghi chú: với cú pháp mới, extension sẽ tự động filter `deleteAt: null` cho các hàm đọc.

## 3.2. Transaction

**Cú pháp cũ:**
```ts
await prismaService.$transaction(async (tx) => {
  await tx.user.create({
    data: { name: 'A', email: 'a@example.com' },
  });
});
```

**Cú pháp mới:**
```ts
await prismaService.transaction(async (tx) => {
  await tx.user.create({
    data: { name: 'A', email: 'a@example.com' },  //Bỏ dấu $ đi ấy mà 
  });
});
```

## 3.3. Cú pháp `delete`

**Cú pháp cũ:**
```ts
await prismaService.client.user.delete({
  where: { id: 1 },
});
```

**Cú pháp mới:**
```ts
await prismaService.client.user.delete({ id: 1 });
```

## 3.4. Cú pháp `deleteMany`

**Cú pháp cũ:**
```ts
await prismaService.client.user.deleteMany({
  where: { role: 'CUSTOMER' },
});
```

**Cú pháp mới:**
```ts
await prismaService.client.user.deleteMany({ role: 'CUSTOMER' });
```

Lưu ý: với extension hiện tại, `delete/deleteMany` không dùng bọc `where` nữa, nên nếu giữ cú pháp cũ sẽ gặp lỗi kiểu `where does not exist in type ...`.
