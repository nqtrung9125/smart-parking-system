# Smart Parking System

Backend ASP.NET Core Web API (.NET 10) và PostgreSQL cho Smart Parking. Giao diện React nằm trên nhánh `frontend` và `main`. [Hướng dẫn cài đặt toàn bộ hệ thống](https://github.com/nqtrung9125/smart-parking-system/blob/main/README.md)

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
   dotnet run --project backend/Parking.Api --launch-profile http
   ```

Visual Studio 2026 có thể mở `backend/Parking.Api/Parking.Api.csproj`. Khi chạy bằng profile `https`, API ở `https://localhost:7171`; profile `http` ở `http://localhost:5181`. Cần tin cậy chứng chỉ phát triển với `dotnet dev-certs https --trust` nếu trình duyệt báo lỗi HTTPS.

Sau khi chạy migration, có thể thêm các bãi mẫu tại Đà Nẵng bằng `dotnet run --project backend/Parking.Api --launch-profile http -- --seed-da-nang`. Dự báo ưu tiên lịch sử vận hành và dùng bộ CSV mô phỏng Đà Nẵng khi chưa đủ dữ liệu.

## API chính

| Nhóm | Endpoint | Quyền |
| --- | --- | --- |
| Đăng ký, đăng nhập | `/api/auth/register`, `/api/auth/login` | Công khai |
| Bãi xe | `GET /api/parking-lots`; POST/PUT/DELETE cùng nhóm | Công khai để xem, Admin để sửa |
| Chỗ đỗ | `GET /api/parking-spots`; POST và PATCH `/{id}/active` | Công khai để xem, Admin/Staff để sửa |
| Xe | `GET /api/vehicles/mine`, `POST /api/vehicles` | Đã đăng nhập |
| Đặt chỗ | `GET /api/reservations/mine`, `POST /api/reservations`, `POST /{id}/cancel` | Đã đăng nhập |
| Duyệt đặt chỗ | `GET /api/reservations/pending`, `POST /api/reservations/{id}/approve`, `POST /api/reservations/{id}/reject` | Admin hoặc Staff phụ trách bãi |
| Lịch xe vào theo bãi | `GET /api/reservations/arrivals` | Admin hoặc Staff phụ trách bãi |
| Gửi xe | `POST /api/parking-sessions/check-in`, `POST /{id}/check-out`, `GET /active` | Admin/Staff |
| Khách trả xe | `GET /api/parking-sessions/mine/{id}/checkout-quote`, `POST /api/parking-sessions/mine/{id}/check-out` | Chủ lượt gửi |
| Bảng giá và phí dự kiến | `GET /api/pricing`, `GET /api/pricing/estimate` | Công khai |
| Lịch sử gửi xe | `GET /api/parking-sessions/mine` | Đã đăng nhập |
| Tìm xe đang gửi | `GET /api/parking-sessions/mine/active` | Chủ xe, từ lúc nhân viên nhận xe đến khi xác nhận xe ra |
| Thanh toán | `POST /api/payments/parking-session/{id}` | Admin/Staff |
| Phí và lịch sử thanh toán | `GET /api/payments/mine` | Chủ xe |
| Số dư và nạp tiền | `GET /api/wallet/mine`, `POST /api/wallet/top-ups` | Chủ tài khoản |
| Duyệt nạp số dư | `GET /api/wallet/top-ups/pending`, `POST /api/wallet/top-ups/{id}/approve` | Admin |
| Trả phí bằng số dư | `POST /api/payments/parking-session/{id}/balance` | Chủ lượt gửi |
| Thống kê | `GET /api/dashboard/summary` | Admin/Staff |
| Báo cáo doanh thu | `GET /api/dashboard/revenue?lotId=1&period=month&date=2026-11-01` | Admin hoặc Staff phụ trách bãi |
| Nhân viên | `POST /api/admin/staff`, `PUT /api/admin/staff/{id}/lots`, `DELETE /api/admin/staff/{id}` | Admin |
| Hồ sơ tài khoản | `GET /api/me`, `PUT /api/me` (tên hiển thị, số liên hệ) | Chủ tài khoản |
| Tra xe và lịch đặt | `GET /api/vehicles/search?plate=`, `GET /api/reservations/active?plate=` | Admin/Staff |
| Sơ đồ trạng thái | `GET /api/parking-spots/map?parkingLotId=` | Công khai |
| Dự báo | `GET /api/parking-lots/{id}/forecast?period=hour\|day\|week&type=` | Công khai |
| OTP | `GET /api/security/authenticator`; POST `/setup`, `/enable`, `/disable` | Đã đăng nhập |
| Thông tin VietQR | `GET /api/payments/parking-session/{id}/transfer` | Chủ xe hoặc Admin/Staff, khi lượt gửi chưa thanh toán |
| Thanh toán chưa thu | `GET /api/parking-sessions/unpaid` | Admin/Staff |

`/api/auth/login?useCookies=false` trả về Identity bearer token; gửi token trong `Authorization: Bearer ...`. Đây là token của ASP.NET Identity, **không phải JWT**. Tài khoản đăng ký thường không tự có quyền Admin hoặc Staff. Admin có thể gán hoặc thu hồi quyền Staff; người dùng cần đăng nhập lại để token nhận quyền mới. Tài khoản Admin ban đầu chỉ được tạo trong môi trường Development qua User Secrets.

Loại chỗ xe gồm `1` cho xe máy và `2` cho ô tô. Một lượt đặt trước kéo dài tối đa 30 ngày. API nhận thời gian đặt chỗ theo UTC. Bảng giá hiển thị phí dự kiến khi khách chọn xe và thời gian đặt. Mức mặc định là 5.000 đồng/giờ cho xe máy và 15.000 đồng/giờ cho ô tô, làm tròn lên và tính tối thiểu một giờ theo thời gian đỗ thực tế.

Đơn mới lưu mức giá lúc đặt. Ra trước phút hẹn cộng 5.000 đồng mỗi lượt. Ra sau phút hẹn cộng 20.000 đồng cho mỗi 24 giờ trễ bắt đầu. Phụ phí đặt trước mặc định là 0 đồng. Có thể chỉnh các khóa `ParkingPricing:MotorbikeHourlyRate`, `ParkingPricing:CarHourlyRate`, `ParkingPricing:EarlyExitFee`, `ParkingPricing:LateDailyFee` và `ParkingPricing:ReservationSurcharge` trong cấu hình API. Đơn đặt đã có trước lần cập nhật dùng giá gửi theo giờ như trước.

## Kiểm thử

`tests/smoke.ps1` dùng PowerShell 7 và một database kiểm thử riêng đã chạy migration. Đặt `PARKING_TEST_ADMIN_EMAIL` và `PARKING_TEST_ADMIN_PASSWORD` theo Admin của database kiểm thử, chạy API tại `http://127.0.0.1:5188`, rồi chạy `./tests/smoke.ps1`. Bài kiểm thử tạo dữ liệu mẫu vào database đã cấu hình.

Có thể thêm cờ `-ConfiguredTransfer` khi API kiểm thử đã cấu hình tài khoản nhận **giả lập** để kiểm tra luồng ghi nhận chuyển khoản. Không thực hiện chuyển tiền trong bài kiểm thử.
