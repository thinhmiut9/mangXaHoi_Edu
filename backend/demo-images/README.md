Thư mục ảnh demo để seed lên Cloudinary.

Cách 1: chia thư mục theo loại ảnh:

- `backend/demo-images/users/avatars`
- `backend/demo-images/users/covers`
- `backend/demo-images/posts`

Cách 2: dùng chung 1 thư mục:

- `backend/demo-images/all`

Script sẽ ưu tiên thư mục chia loại; nếu thiếu sẽ tự fallback sang `all`.

Chỉ hỗ trợ các định dạng: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`.

Sau khi chép ảnh vào đúng thư mục, chạy:

```bash
cd backend
npm run db:seed:cloudinary-images
```

Nếu bạn đã có ảnh sẵn trên Cloudinary và chỉ muốn random gán vào DB (không upload thêm):

```bash
cd backend
npm run db:assign:cloudinary-random
```

Giới hạn theo prefix public_id (tuỳ chọn):

```bash
cd backend
CLOUDINARY_ASSIGN_PREFIX=edusocial/ npm run db:assign:cloudinary-random
```

Tùy chọn root ảnh khác:

```bash
cd backend
DEMO_IMAGES_ROOT=../my-images npm run db:seed:cloudinary-images
```
