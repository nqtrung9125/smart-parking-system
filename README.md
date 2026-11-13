# Smart Parking System

Ứng dụng quản lý bãi đỗ xe cho bài tập lớn Lập trình web nâng cao: ASP.NET Core Web API (.NET 10), React + Vite và PostgreSQL trong Docker.

## Chạy trên máy mới

1. Cài .NET SDK 10, Node.js 20.19+ hoặc 22.12+ và Docker Desktop.
2. Tạo `smart-parking-db/.env` theo các biến `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` của `smart-parking-db/compose.yaml`. Không commit file `.env`.
3. Trong `smart-parking-db`, chạy `docker compose up -d`.
4. Trong thư mục `backend/Parking.Api`, đặt connection string bằng User Secrets:

   ```powershell
   dotnet user-secrets set "ConnectionStrings:ParkingDb" "Host=localhost;Port=5433;Database=parking_db;Username=parking_app;Password=YOUR_PASSWORD"
   dotnet user-secrets set "BootstrapAdmin:Email" "admin@example.com"
   dotnet user-secrets set "BootstrapAdmin:Password" "USE_A_STRONG_PASSWORD"
   ```

5. Tại thư mục gốc, khôi phục công cụ và cập nhật cơ sở dữ liệu:

   ```powershell
   dotnet tool restore
   $env:ASPNETCORE_ENVIRONMENT = "Development"
   dotnet tool run dotnet-ef database update --project backend/Parking.Api --startup-project backend/Parking.Api
   ```

6. Mở hai terminal ở thư mục gốc và chạy API cùng React:

   ```powershell
   $env:ASPNETCORE_ENVIRONMENT = "Development"
   dotnet run --project backend/Parking.Api --launch-profile http
   ```

   ```powershell
   cd frontend
   npm ci
   npm run dev
   ```

   Mở `http://localhost:5173`. API dùng `http://localhost:5181`. Visual Studio 2026 có thể mở `backend/Parking.Api/Parking.Api.csproj` và chọn profile `http`. Nếu chạy profile `https`, API ở `https://localhost:7171`; đổi `VITE_API_BASE_URL` tương ứng và tin cậy chứng chỉ phát triển bằng `dotnet dev-certs https --trust`.

## Dữ liệu demo Đà Nẵng

Sau bước migration, chạy từ thư mục gốc:

```powershell
dotnet run --project backend/Parking.Api --launch-profile http -- --seed-da-nang
```

Lệnh này tạo 8 bãi gắn nhãn **(Demo)** ở Đà Nẵng, 254 vị trí, các trạng thái hiện tại và 35 ngày lịch sử mô phỏng. Chạy lại không thêm trùng bãi demo. Đây là dữ liệu minh họa, không dùng để tìm chỗ đỗ ngoài thực tế.

Kịch bản demo: tìm **Bạch Đằng** → mở chi tiết → chuyển sang **3D** và chọn một ô đỗ → đổi bộ lọc **Ô tô/Xe máy** để xem dự báo tương ứng. Với tài khoản khách, thêm xe cùng loại rồi đặt một vị trí trống; với tài khoản nhân viên, mở **Trả xe & thanh toán** để xem các lượt đang chờ thu phí.

## Giao diện

| Vai trò | Trang |
| --- | --- |
| Mọi người | Trang chủ, tìm bãi, sơ đồ 2D/3D, dự báo chỗ trống, đăng ký và đăng nhập |
| Khách hàng | Xe của tôi, đặt chỗ, lịch sử gửi xe và bảo mật tài khoản |
| Nhân viên | Nhận xe, trả xe và ghi nhận thanh toán tiền mặt hoặc chuyển khoản |
| Quản trị | Dashboard, quản lý bãi xe, chỗ đỗ, tài khoản nhân viên |

Đăng nhập dùng Identity bearer token, hết hạn sau 30 phút, lưu trong `sessionStorage` của tab trình duyệt. Frontend gọi `/api/me` để lấy quyền; API kiểm tra quyền trên từng endpoint. Để bật OTP, đăng nhập và mở **Bảo mật**, xác nhận mật khẩu, quét QR trong ứng dụng xác thực rồi nhập mã 6 số. Cất mã khôi phục trước khi rời trang. Mỗi mã khôi phục chỉ dùng được một lần. OTP không cần dịch vụ SMS hoặc email.

Sơ đồ 3D sắp xếp vị trí từ mã chỗ và không đại diện mặt bằng thực tế. Dự báo dùng k láng giềng gần nhất có trọng số để học số vị trí có xe theo giờ và ngày trong tuần, rồi ước tính số chỗ trống 12 giờ tới. Hệ thống chỉ hiển thị khi có ít nhất 20 lượt hoàn tất và lịch sử trải dài 14 ngày, kèm sai số kiểm tra trên 3 ngày lịch sử gần nhất. Dự báo không tính các lượt đặt trước trong tương lai.

## Chuyển khoản QR

Mặc định ứng dụng có thể ghi nhận tiền mặt. Để bật VietQR, cấu hình tài khoản nhận của đơn vị vận hành bằng User Secrets trong thư mục backend:

```powershell
dotnet user-secrets set "VietQr:BankBin" "YOUR_SIX_DIGIT_BANK_BIN"
dotnet user-secrets set "VietQr:AccountNumber" "YOUR_ACCOUNT_NUMBER"
dotnet user-secrets set "VietQr:AccountName" "YOUR_ACCOUNT_NAME"
```

Khởi động lại API. Nhân viên mở **Trả xe & thanh toán**, chọn **Chuyển khoản QR**, rồi kiểm tra số tiền và nội dung trong tài khoản nhận. Chỉ xác nhận sau khi đã đối soát và nhập mã giao dịch. Mã QR tạo tại ứng dụng; không gửi thông tin sang dịch vụ tạo ảnh. Chưa tích hợp webhook ngân hàng để tự động xác nhận.

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
| Dự báo | `GET /api/parking-lots/{id}/forecast?type=` | Công khai |
| OTP | `GET /api/security/authenticator`; POST `/setup`, `/enable`, `/disable` | Đã đăng nhập |
| Thông tin VietQR | `GET /api/payments/parking-session/{id}/transfer` | Admin/Staff |
| Thanh toán chưa thu | `GET /api/parking-sessions/unpaid` | Admin/Staff |

`/api/auth/login?useCookies=false` trả về Identity bearer token; gửi token trong `Authorization: Bearer ...`. Đây là token của ASP.NET Identity, **không phải JWT**. Tài khoản đăng ký thường không tự có quyền Admin hoặc Staff. Admin có thể gán hoặc thu hồi quyền Staff; người dùng cần đăng nhập lại để token nhận quyền mới. Tài khoản Admin ban đầu chỉ được tạo trong môi trường Development qua User Secrets.

Loại chỗ/xe: `1` = xe máy, `2` = ô tô. Thời gian đặt chỗ là UTC. Sơ đồ trả trạng thái `Available`, `Occupied`, `Reserved`, `Inactive` tại thời điểm gọi API. Phí mẫu: xe máy 5.000 đồng/giờ, ô tô 15.000 đồng/giờ, làm tròn lên tối thiểu một giờ. CORS hiện cho phép React Vite tại `http://localhost:5173`.

## Kiểm thử

`tests/smoke.ps1` chạy kiểm thử API với một database riêng đã được migration. Cần đặt hai biến môi trường `PARKING_TEST_ADMIN_EMAIL` và `PARKING_TEST_ADMIN_PASSWORD` của tài khoản Admin trong database kiểm thử, rồi chạy API tại `http://127.0.0.1:5188` và `./tests/smoke.ps1`. Bài kiểm thử tạo dữ liệu mẫu; không chạy vào database thật.

Có thể thêm cờ `-ConfiguredTransfer` khi API kiểm thử đã cấu hình tài khoản nhận **giả lập** để kiểm tra luồng ghi nhận chuyển khoản. Không thực hiện chuyển tiền trong bài kiểm thử.
