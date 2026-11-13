# Smart Parking System

Backend ASP.NET Core Web API (.NET 10) và PostgreSQL cho bài tập lớn Lập trình web nâng cao. Frontend React sẽ được thêm ở giai đoạn tiếp theo.

## Chạy trên máy mới

1. Cài .NET SDK 10 và Docker Desktop.
2. Tạo `smart-parking-db/.env` theo các biến `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` của `smart-parking-db/compose.yaml`. Không commit file `.env`.
3. Trong `smart-parking-db`, chạy `docker compose up -d`.
4. Trong thư mục `backend/Parking.Api`, đặt connection string bằng User Secrets:

   ```powershell
   dotnet user-secrets set "ConnectionStrings:ParkingDb" "Host=localhost;Port=5433;Database=parking_db;Username=parking_app;Password=YOUR_PASSWORD"
   dotnet user-secrets set "BootstrapAdmin:Email" "admin@example.com"
   dotnet user-secrets set "BootstrapAdmin:Password" "USE_A_STRONG_PASSWORD"
   ```

5. Tại thư mục gốc, chạy:

   ```powershell
   dotnet tool restore
   $env:ASPNETCORE_ENVIRONMENT = "Development"
   dotnet tool run dotnet-ef database update --project backend/Parking.Api --startup-project backend/Parking.Api
   dotnet run --project backend/Parking.Api
   ```

Visual Studio 2026 có thể mở `backend/Parking.Api/Parking.Api.csproj`. Khi chạy bằng profile `https`, API ở `https://localhost:7171`; profile `http` ở `http://localhost:5181`. Cần tin cậy chứng chỉ phát triển với `dotnet dev-certs https --trust` nếu trình duyệt báo lỗi HTTPS.

## API chính

| Nhóm | Endpoint | Quyền |
| --- | --- | --- |
| Đăng ký, đăng nhập | `/api/auth/register`, `/api/auth/login` | Công khai |
| Bãi xe | `GET /api/parking-lots`; POST/PUT/DELETE cùng nhóm | Công khai để xem, Admin để sửa |
| Chỗ đỗ | `GET /api/parking-spots`; POST và PATCH `/{id}/active` | Công khai để xem, Admin/Staff để sửa |
| Xe | `GET /api/vehicles/mine`, `POST /api/vehicles` | Đã đăng nhập |
| Đặt chỗ | `GET /api/reservations/mine`, `POST /api/reservations`, `POST /{id}/cancel` | Đã đăng nhập |
| Gửi xe | `POST /api/parking-sessions/check-in`, `POST /{id}/check-out`, `GET /active` | Admin/Staff |
| Lịch sử gửi xe | `GET /api/parking-sessions/mine` | Đã đăng nhập |
| Thanh toán | `POST /api/payments/parking-session/{id}` | Admin/Staff |
| Thống kê | `GET /api/dashboard/summary` | Admin/Staff |
| Nhân viên | `POST /api/admin/staff`, `DELETE /api/admin/staff/{id}` | Admin |
| Hồ sơ đăng nhập | `GET /api/me` | Đã đăng nhập |
| Tra xe và lịch đặt | `GET /api/vehicles/search?plate=`, `GET /api/reservations/active?plate=` | Admin/Staff |
| Sơ đồ trạng thái | `GET /api/parking-spots/map?parkingLotId=` | Công khai |
| Thanh toán chưa thu | `GET /api/parking-sessions/unpaid` | Admin/Staff |

`/api/auth/login?useCookies=false` trả về Identity bearer token; gửi token trong `Authorization: Bearer ...`. Đây là token của ASP.NET Identity, **không phải JWT**. Tài khoản đăng ký thường không tự có quyền Admin hoặc Staff. Admin có thể gán hoặc thu hồi quyền Staff; người dùng cần đăng nhập lại để token nhận quyền mới. Tài khoản Admin ban đầu chỉ được tạo trong môi trường Development qua User Secrets.

Loại chỗ/xe: `1` = xe máy, `2` = ô tô. Thời gian đặt chỗ là UTC. Sơ đồ trả trạng thái `Available`, `Occupied`, `Reserved`, `Inactive` tại thời điểm gọi API. Phí mẫu: xe máy 5.000 đồng/giờ, ô tô 15.000 đồng/giờ, làm tròn lên tối thiểu một giờ. Thanh toán chỉ là ghi nhận tiền mặt hoặc thẻ **mô phỏng**, chưa kết nối cổng thanh toán. CORS hiện cho phép React Vite tại `http://localhost:5173`.

## Kiểm thử

`tests/smoke.ps1` chạy kiểm thử API với một database riêng đã được migration. Cần đặt hai biến môi trường `PARKING_TEST_ADMIN_EMAIL` và `PARKING_TEST_ADMIN_PASSWORD` của tài khoản Admin trong database kiểm thử, rồi chạy API tại `http://127.0.0.1:5188` và `./tests/smoke.ps1`. Bài kiểm thử tạo dữ liệu mẫu; không chạy vào database thật.

Mã nguồn không chứa mật khẩu PostgreSQL hay Admin. Chức năng OTP qua SMS/email và frontend React chưa được triển khai.
