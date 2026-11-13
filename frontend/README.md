# Smart Parking frontend

Giao diện React + Vite của dự án Smart Parking. Chạy từ thư mục này:

```powershell
npm ci
npm run dev
```

Mở `http://localhost:5173`. API ASP.NET Core cần chạy tại `http://localhost:5181`. Nếu dùng cổng khác, tạo `frontend/.env` với `VITE_API_BASE_URL=http://localhost:PORT`; file `.env` không được commit. Chạy `npm run lint` và `npm run build` trước khi đưa thay đổi lên GitHub.

Các trang gồm trang chủ, sơ đồ bãi xe, đăng nhập/đăng ký, xe, đặt chỗ, lịch sử, nhận/trả xe và khu vực quản trị. Mọi thao tác ghi dữ liệu đều gọi API; quyền truy cập được kiểm tra lại ở backend.
