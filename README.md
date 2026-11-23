# Smart Parking System

Smart Parking là đồ án quản lý bãi đỗ xe tại Đà Nẵng. Khách tìm ô trên bản đồ, xem phí và đặt cọc qua web hoặc chat. Nhân viên quản lý lượt xe tại bãi được phân công. Quản trị viên quản lý bãi, phân công nhân viên và theo dõi doanh thu.

**Công nghệ** · React + Vite · ASP.NET Core Web API (.NET 10) · EF Core · PostgreSQL 17 trong Docker · Gemini API

[Cài đặt](#cài-đặt-trên-windows) · [Ba tài khoản mẫu](#ba-tài-khoản-mẫu) · [Dùng thử](#dùng-thử-một-lượt-gửi-xe) · [Trợ lý AI](#bật-trợ-lý-ai) · [Xử lý lỗi](#xử-lý-lỗi-thường-gặp)

## Cài đặt trên Windows

Cài **PowerShell 7**, **Git**, **.NET SDK 10**, **Node.js 22.12 trở lên** và **Docker Desktop**. Mở Docker Desktop và chờ Docker Engine chạy. Các lệnh dùng PowerShell 7 từ thư mục gốc của repository. [PowerShell](https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows) · [.NET SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0) · [Yêu cầu của Vite](https://vite.dev/guide/) · [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/)

### 1. Tải mã nguồn và chạy PostgreSQL

```powershell
git clone --branch main https://github.com/nqtrung9125/smart-parking-system.git
Set-Location smart-parking-system

$dbEnv = './smart-parking-db/.env'
if (-not (Test-Path $dbEnv)) {
    @(
        'POSTGRES_DB=parking_db'
        'POSTGRES_USER=parking_app'
        "POSTGRES_PASSWORD=$([guid]::NewGuid().ToString('N'))"
    ) | Set-Content -LiteralPath $dbEnv -Encoding ascii
}

docker compose --env-file $dbEnv -f ./smart-parking-db/compose.yaml up -d --wait
```

PostgreSQL nhận kết nối ở cổng **5433** trên máy Windows. Docker giữ dữ liệu trong volume `parking_pgdata`. Khi cài lại dự án trên cùng máy, dùng file `.env` và mật khẩu đã tạo cho volume đó.

### 2. Cấu hình API, chạy migration và nạp dữ liệu

```powershell
$db = Get-Content ./smart-parking-db/.env -Raw | ConvertFrom-StringData
$connection = "Host=localhost;Port=5433;Database=$($db.POSTGRES_DB);Username=$($db.POSTGRES_USER);Password=$($db.POSTGRES_PASSWORD)"
@{
    'ConnectionStrings:ParkingDb' = $connection
    'BootstrapAdmin:Email' = 'admin@example.test'
    'BootstrapAdmin:Password' = (Read-Host -Prompt 'Nhap mat khau Admin local' -MaskInput)
} | ConvertTo-Json -Compress | dotnet user-secrets set --project ./backend/Parking.Api

dotnet tool restore
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet tool run dotnet-ef database update --project ./backend/Parking.Api --startup-project ./backend/Parking.Api
dotnet run --project ./backend/Parking.Api --launch-profile http -- --seed-da-nang
```

Nhập mật khẩu có chữ hoa, chữ thường, chữ số và ký tự đặc biệt. Để dùng đúng tài khoản mẫu bên dưới, nhập mật khẩu Admin trong bảng. Lần chạy đầu ở chế độ Development có thể tạo tài khoản Admin. Lệnh cuối nạp **8 bãi và 254 ô đỗ** ở Đà Nẵng rồi tự thoát. Dữ liệu mô phỏng phục vụ đồ án và có thể nạp lại mà không tạo bãi trùng.

### 3. Mở hai terminal để chạy ứng dụng

**Terminal 1 · Backend**

```powershell
dotnet dev-certs https --trust
dotnet run --project ./backend/Parking.Api --launch-profile https
```

Nếu dùng Visual Studio, mở `backend/Parking.Api/Parking.Api.csproj`, chọn profile **https** rồi nhấn **F5**. Chạy một phiên API trên cổng 7171.

**Terminal 2 · Frontend**

```powershell
Set-Content ./frontend/.env 'VITE_API_BASE_URL=https://localhost:7171' -Encoding ascii
npm ci --prefix frontend
npm run dev --prefix frontend -- --port 5173 --strictPort
```

| Mở trong trình duyệt | Kết quả cần thấy |
| --- | --- |
| [Trang chủ](http://localhost:5173/) | Danh sách bãi và bản đồ Đà Nẵng |
| [Kiểm tra API](https://localhost:7171/api/parking-lots) | Danh sách bãi dưới dạng JSON |
| [OpenAPI](https://localhost:7171/openapi/v1.json) | Đường dẫn, tham số và định dạng của từng API |

Sau khi kéo bản mới về, chạy lại migration ở bước 2 nếu dự án có migration mới. Chạy lại `npm ci --prefix frontend` nếu `package-lock.json` thay đổi.

Nếu dùng profile **http** để thử local, đặt `VITE_API_BASE_URL=http://localhost:5181` trong `frontend/.env`, khởi động lại Vite và kiểm tra API tại [cổng 5181](http://localhost:5181/api/parking-lots).

## Ba tài khoản mẫu

Các thông tin dưới đây dành cho môi trường local. Tạo tài khoản theo hướng dẫn để chúng có hiệu lực trên cơ sở dữ liệu của bạn.

| Vai trò | Email mẫu | Mật khẩu mẫu | Tạo tài khoản |
| --- | --- | --- | --- |
| Quản trị viên | `admin@example.test` | `ParkingAdmin!4729` | Tạo khi API khởi động ở Development với cấu hình trong bước 2. |
| Nhân viên | `staff@example.test` | `ParkingStaff!5731` | Đăng ký, sau đó Admin cấp vai trò và phân công bãi. |
| Khách hàng | `customer@example.test` | `ParkingCustomer!6843` | Đăng ký qua trang web. |

1. Tạo tài khoản Nhân viên và Khách hàng, đăng xuất sau mỗi lần đăng ký. [Trang đăng ký](http://localhost:5173/register)
2. Đăng nhập Admin, vào **Nhân viên**, cấp quyền cho `staff@example.test` rồi chọn **Phân công bãi**. Chọn **Bãi xe Cầu Rồng** để thử cùng kịch bản bên dưới. [Trang đăng nhập](http://localhost:5173/login)
3. Đăng nhập lại bằng tài khoản Nhân viên. **Lịch đặt theo bãi**, **Nhận xe**, **Trả xe & thu phí** và **Doanh thu** hiển thị bãi trong phạm vi được giao.

Sau khi lưu số điện thoại riêng trong **Hồ sơ tài khoản**, bạn có thể đăng nhập bằng số đó hoặc email. Trang **Bảo mật** cho phép bật OTP từ ứng dụng xác thực và tải mã khôi phục dùng một lần.

## Dùng thử một lượt gửi xe

1. **Khách hàng** mở **Xe của tôi**, thêm một xe máy, rồi vào **Tìm bãi theo giờ**. Chọn **Cầu Rồng**, giờ đến và giờ lấy xe. Mở sơ đồ 2D hoặc 3D để chọn ô.
2. **Nạp số dư** để giữ cọc. Khi bật VietQR theo hướng dẫn bên dưới, khách tạo yêu cầu nạp ở **Số dư**. Admin kiểm tra số tiền và mã giao dịch rồi duyệt ở **Duyệt nạp số dư**.
3. **Đặt cọc và xác nhận.** Hệ thống hiển thị phí dự kiến, tiền cọc bằng một giờ gửi và khoản dự kiến trả thêm. Hủy trước giờ hẹn được hoàn cọc. Hủy từ giờ hẹn hoặc vắng mặt sẽ mất cọc. Hạn nhận xe là giờ hẹn cộng tối đa 15 phút, trong giới hạn giờ lấy xe.
4. **Nhân viên** mở **Nhận xe** trong khung nhận xe của lịch. Sau khi nhân viên xác nhận xe vào, khách có thể xem **Tìm xe** trên sơ đồ, xin gia hạn và xem phí trước khi xe ra.
5. **Trả xe và thanh toán.** Hệ thống khấu trừ cọc khi chốt phí. Khách xem hóa đơn trong **Thanh toán**. Nhân viên và Admin có thể đối chiếu số tiền đã thu trong **Doanh thu** theo ngày, tháng hoặc năm.

### Bật VietQR

Chạy từ thư mục gốc với thông tin tài khoản nhận do đơn vị vận hành cấu hình, sau đó khởi động lại API.

```powershell
@{
    'VietQr:BankBin' = (Read-Host 'Ma BIN ngan hang 6 chu so')
    'VietQr:AccountNumber' = (Read-Host 'So tai khoan nhan')
    'VietQr:AccountName' = (Read-Host 'Ten tai khoan nhan')
} | ConvertTo-Json -Compress | dotnet user-secrets set --project ./backend/Parking.Api
```

Trên cơ sở dữ liệu trình bày, có thể nhập BIN `970422`, số tài khoản mẫu `0000000000` và tên `KIEM THU`. Tạo một yêu cầu nạp 50.000 đ bằng tài khoản khách, rồi duyệt bằng Admin với mã đối soát giả lập như `LOCAL-TEST-001`. Bỏ qua bước chuyển khoản trong kịch bản này. Khi vận hành thực tế, Admin cần đối chiếu sao kê trước khi duyệt. Doanh thu chỉ ghi các khoản đã thu, gồm phần cọc đã quyết toán và phí đã thanh toán.

## Bật trợ lý AI

Tạo khóa Gemini cho dự án Google AI Studio. Nhập khóa trong PowerShell tại thư mục gốc rồi khởi động lại API. [Tạo khóa](https://aistudio.google.com/api-keys)

```powershell
@{ 'Assistant:ApiKey' = (Read-Host -Prompt 'Gemini API key' -MaskInput) } |
    ConvertTo-Json -Compress |
    dotnet user-secrets set --project ./backend/Parking.Api
```

Mở **Trợ lý AI** ở góc dưới bên phải sau khi đăng nhập. Với tài khoản đã có xe và đủ tiền cọc, thử câu **“Đặt giúp mình chỗ cho xe máy gần Cầu Rồng, ngày mai từ 19:00 đến 22:00.”** Xem tên bãi, mã ô và báo giá, rồi bấm **Xác nhận đặt cọc** trong chat. Bạn nhận mã đặt chỗ khi hệ thống kiểm tra thành công.

| Vai trò | Câu hỏi để thử |
| --- | --- |
| Khách hàng | “Xe tôi đang đỗ ở đâu?” hoặc “Gia hạn thêm 2 tiếng thì bao nhiêu?” |
| Nhân viên | “Hôm nay các bãi tôi phụ trách có xe nào sắp đến?” |
| Quản trị viên | “Bãi nào có doanh thu cao nhất tháng này?” |

Model mặc định là `gemini-3.5-flash-lite`. Khi triển khai, lưu khóa ở backend bằng `Assistant__ApiKey`. Có thể đổi model qua `Assistant__Model`. Tin nhắn cần phân tích được gửi đến Gemini. Kết quả tra cứu từ tài khoản do backend trả thẳng về React. Giữ mật khẩu, CCCD và OTP ngoài nội dung chat.

## Xử lý lỗi thường gặp

| Trạng thái | Cách xử lý |
| --- | --- |
| Docker báo không kết nối được engine | Mở Docker Desktop, chờ engine chạy rồi chạy lại lệnh ở bước 1. |
| PostgreSQL báo sai mật khẩu | So khớp mật khẩu trong `smart-parking-db/.env` với User Secrets và cấu hình dùng khi volume được tạo. |
| Web báo `Failed to fetch` | Mở đường dẫn kiểm tra API để xác nhận HTTPS hoạt động. Kiểm tra cổng trong `frontend/.env` rồi khởi động lại Vite. |
| Cổng 7171 hoặc 5173 đang được dùng | Dừng phiên cũ đúng cổng rồi chạy lại từ terminal. |
| Admin mẫu đăng nhập thất bại | Dùng email và mật khẩu đã cấu hình khi tạo Admin. Đổi User Secrets sau đó không đổi mật khẩu của tài khoản đã tạo. |
| Nhân viên chưa thấy bãi | Kiểm tra vai trò và bãi được giao trong trang **Nhân viên**, rồi đăng nhập lại. |
| Không thể đặt cọc | Kiểm tra xe đã đăng ký, ô còn trống và số dư khả dụng. |
| Trợ lý báo chưa kết nối Gemini | Kiểm tra khóa trong User Secrets rồi khởi động lại API. Nếu trợ lý báo quá nhiều yêu cầu, chờ trước khi gửi lại. |

## Dành cho nhóm phát triển

- **Mã nguồn.** `frontend/src` chứa giao diện React. Backend nhóm chức năng theo nghiệp vụ trong `backend/Parking.Api/Features`. [Cấu trúc backend](backend/README.md)
- **Cơ sở dữ liệu.** API dùng EF Core migrations để dựng `parking_db`. Sơ đồ và SQL tiếng Việt được lưu riêng để phục vụ báo cáo. [Cấu hình PostgreSQL và ERD](smart-parking-db/README.md)
- **Học máy.** Dự báo KNN theo thứ và giờ có chế độ theo giờ, ngày và tuần. Khi lịch sử vận hành còn ít, bãi trong danh mục Đà Nẵng dùng CSV mô phỏng và gắn nhãn nguồn trên giao diện. [CSV huấn luyện](backend/Parking.Api/Data/Training/da-nang-occupancy.csv)
- **REST API.** Dùng OpenAPI để tra hợp đồng hiện tại. `POST /api/auth/login?useCookies=false` trả bearer token. `POST /api/assistant/messages` cần phiên đã đăng nhập. Khi khách bấm xác nhận, giao diện gọi cùng `POST /api/reservations` dùng cho biểu mẫu đặt chỗ.
- **Kiểm tra.** Chạy `dotnet build ./backend/Parking.Api`, `npm run build --prefix frontend` và `npm run lint --prefix frontend`. Để kiểm tra tích hợp, chạy script trên PostgreSQL riêng đã cập nhật migration, cấu hình `PARKING_TEST_ADMIN_EMAIL` và `PARKING_TEST_ADMIN_PASSWORD`, rồi gọi `./tests/smoke.ps1 -BaseUrl https://localhost:7171` khi API thử nghiệm chạy ở cổng đó. Script tạo dữ liệu trong database được cấu hình. [Script kiểm tra](tests/smoke.ps1)
