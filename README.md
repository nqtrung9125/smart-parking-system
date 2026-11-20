# Smart Parking System

Ứng dụng quản lý bãi đỗ xe cho môn Lập trình web nâng cao. React và Vite phục vụ giao diện, ASP.NET Core Web API phục vụ nghiệp vụ, PostgreSQL lưu dữ liệu trong Docker.

## Cài đặt trên Windows

Cài **.NET SDK 10**, **Node.js 22.12 trở lên**, **Git** và **Docker Desktop**. Mở Docker Desktop trước khi chạy lệnh. Các lệnh bên dưới dùng PowerShell tại thư mục gốc dự án. [Tải .NET SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0) · [Yêu cầu Node.js của Vite](https://v8.vite.dev/guide/) · [Cài Docker Desktop](https://docs.docker.com/get-docker/desktop/)

### 1. Tải mã nguồn và kiểm tra công cụ

```powershell
git clone https://github.com/nqtrung9125/smart-parking-system.git
cd smart-parking-system

dotnet --version
node --version
docker compose version
```

Nếu đã clone dự án, mở đúng thư mục đó và dùng `git pull` để cập nhật nhánh đang làm.

### 2. Khởi động PostgreSQL

Trên bản clone mới, tạo mật khẩu ngẫu nhiên và lưu cấu hình Docker vào `smart-parking-db/.env`. Với bản đã có database, sử dụng thông tin trong file `.env` hiện có.

```powershell
$dbPassword = [guid]::NewGuid().ToString('N')
@(
    'POSTGRES_DB=parking_db'
    'POSTGRES_USER=parking_app'
    "POSTGRES_PASSWORD=$dbPassword"
) | Set-Content ./smart-parking-db/.env -Encoding ascii

docker compose --env-file ./smart-parking-db/.env -f ./smart-parking-db/compose.yaml up -d
docker compose --env-file ./smart-parking-db/.env -f ./smart-parking-db/compose.yaml ps
```

Chờ dịch vụ `postgres` báo `healthy`. Cổng PostgreSQL trên máy là **5433**. Docker lưu dữ liệu trong volume `parking_pgdata`.

### 3. Cấu hình API và tạo bảng

```powershell
$db = Get-Content ./smart-parking-db/.env -Raw | ConvertFrom-StringData
$connection = "Host=localhost;Port=5433;Database=$($db.POSTGRES_DB);Username=$($db.POSTGRES_USER);Password=$($db.POSTGRES_PASSWORD)"
dotnet user-secrets set "ConnectionStrings:ParkingDb" $connection --project ./backend/Parking.Api

dotnet user-secrets set "BootstrapAdmin:Email" "admin@example.test" --project ./backend/Parking.Api
$adminInput = Read-Host "Nhap mat khau Admin can tao" -AsSecureString
$adminPassword = [pscredential]::new('admin', $adminInput).GetNetworkCredential().Password
dotnet user-secrets set "BootstrapAdmin:Password" $adminPassword --project ./backend/Parking.Api

dotnet tool restore
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet tool run dotnet-ef database update --project ./backend/Parking.Api --startup-project ./backend/Parking.Api
```

Chọn mật khẩu Admin có chữ hoa, chữ thường, chữ số và ký tự đặc biệt. API tạo Admin khi khởi động lần đầu trong môi trường Development. File `.env` và User Secrets lưu trên máy cài đặt.

Muốn thử với dữ liệu Đà Nẵng, chạy lệnh sau trước khi mở API để sử dụng.

```powershell
dotnet run --project ./backend/Parking.Api --launch-profile http -- --seed-da-nang
```

### 4. Chạy API và frontend

**Terminal 1** tại thư mục gốc.

```powershell
dotnet dev-certs https --trust
dotnet run --project ./backend/Parking.Api --launch-profile https
```

Nếu dùng Visual Studio, mở `backend/Parking.Api/Parking.Api.csproj`, chọn profile **https** và nhấn **F5**. Dùng một trong hai cách chạy API để tránh trùng cổng.

**Terminal 2** tại thư mục gốc.

```powershell
Set-Content ./frontend/.env 'VITE_API_BASE_URL=https://localhost:7171' -Encoding ascii
Set-Location frontend
npm ci
npm run dev
```

| Thành phần | Địa chỉ |
| --- | --- |
| Trang web | [localhost:5173](http://localhost:5173/) |
| Kiểm tra API | [Danh sách bãi](https://localhost:7171/api/parking-lots) |
| OpenAPI | [Mô tả endpoint](https://localhost:7171/openapi/v1.json) |

Nếu dùng profile **http**, đổi `VITE_API_BASE_URL` thành `http://localhost:5181` và khởi động lại Vite. Giữ cùng profile khi chạy backend. Sau khi cập nhật code có migration mới, chạy lại lệnh `database update` rồi khởi động lại API.

### Lỗi thường gặp

| Trình trạng | Cách xử lý |
| --- | --- |
| `Failed to fetch` | Mở đường dẫn kiểm tra API ở trên, kiểm tra profile và địa chỉ trong `frontend/.env`, rồi khởi động lại Vite nếu đã sửa file. |
| Cổng 7171 đang được dùng | Dừng phiên API đang chạy rồi chạy lại ở Visual Studio hoặc terminal. |
| PostgreSQL từ chối đăng nhập | So khớp database, user, mật khẩu và cổng trong User Secrets với cấu hình Docker. Volume đã tạo sử dụng thông tin đăng nhập ban đầu. |
| API mới trả về 404 hoặc thiếu bảng | Build lại backend, chạy migration và khởi động lại API. |
| Nhân viên không thấy bãi | Đăng nhập Admin, mở **Nhân viên → Phân công bãi** và lưu bãi phụ trách. Sau khi vừa cấp vai trò Nhân viên, đăng nhập lại. |

## Ba tài khoản mẫu để chạy thử local

Các tài khoản dưới đây có hiệu lực sau khi tạo theo hướng dẫn. Dùng chúng cho bản cài đặt local phục vụ học tập.

| Vai trò | Email mẫu | Mật khẩu mẫu | Có thể thử |
| --- | --- | --- | --- |
| Admin | `admin@example.test` | `ParkingAdmin!4729` | Quản lý bãi, phân công nhân viên, xem doanh thu mọi bãi |
| Nhân viên | `staff@example.test` | `ParkingStaff!5731` | Duyệt đặt chỗ, nhận xe, trả xe và xem doanh thu bãi phụ trách |
| Khách hàng | `customer@example.test` | `ParkingCustomer!6843` | Đăng ký xe, đặt chỗ, xác nhận xe ra và thanh toán |

1. **Admin.** Khi chạy bước cấu hình API trên database mới, giữ email `admin@example.test` và nhập mật khẩu mẫu của Admin, sau đó khởi động API với profile **https**.
2. **Khách hàng và Nhân viên.** Mở **Đăng ký** hai lần, mỗi lần dùng email và mật khẩu tương ứng trong bảng. Nếu còn đăng nhập bằng tài khoản trước, đăng xuất trước khi đăng ký tài khoản kế tiếp. [Đăng ký trên máy local](http://localhost:5173/register)
3. **Phân công bãi.** Đăng nhập Admin, mở **Nhân viên**, cấp quyền cho `staff@example.test`, rồi bấm **Phân công bãi**. Chọn **Bãi xe Bạch Đằng** nếu đã nạp dữ liệu Đà Nẵng, hoặc chọn bãi bạn đã tạo. Đăng nhập lại bằng tài khoản Nhân viên để thấy bãi trong trang **Doanh thu**. [Đăng nhập trên máy local](http://localhost:5173/login)

## Dữ liệu Đà Nẵng và bộ học máy

Sau bước migration, chạy từ thư mục gốc:

```powershell
dotnet run --project backend/Parking.Api --launch-profile http -- --seed-da-nang
```

Lệnh này tạo 8 bãi ở Đà Nẵng với 254 vị trí và trạng thái mô phỏng. Với bản đã cài trước đó, lệnh bỏ hậu tố `(Demo)` khỏi đúng các bãi đã tạo, giữ nguyên mã bãi và dữ liệu liên quan. Có thể chạy lại mà không thêm trùng. Địa chỉ và mặt bằng dùng cho đồ án, không xác nhận một bãi xe đang hoạt động ngoài thực tế.

Bộ [dữ liệu học máy CSV](backend/Parking.Api/Data/Training/da-nang-occupancy.csv) gồm **17.472 dòng theo giờ**, 91 ngày, 8 bãi, có sức chứa và số chỗ có xe theo từng loại. Dữ liệu được sinh từ mẫu giờ cao điểm, ngày thường/cuối tuần và biến động ngẫu nhiên có thể tái tạo bằng `node scripts/generate-training-data.mjs`. CSV không chứa biển số hoặc thông tin tài khoản. API giữ lại 7 ngày cuối để đo sai số trên dữ liệu mô phỏng.

Kịch bản trình bày: tìm **Bạch Đằng** → mở chi tiết → chọn **3D** → chọn một ô trống → **Đặt chỗ**. Trang đặt chỗ mở sẵn đúng ô và góc xem, có thể đổi giữa 2D và 3D trước khi xác nhận. Mở **Tài khoản** từ góc phải để xem vai trò, email và OTP, hoặc cập nhật tên hiển thị và số điện thoại.

## Giao diện

| Vai trò | Trang |
| --- | --- |
| Mọi người | Trang chủ, tìm bãi, sơ đồ 2D/3D, dự báo chỗ trống, đăng ký và đăng nhập |
| Khách hàng | Hồ sơ, xe của tôi, đặt chỗ, tìm xe đang gửi trên sơ đồ 2D/3D, lịch sử và bảo mật |
| Nhân viên | Duyệt đặt chỗ tại bãi phụ trách, nhận xe, trả xe, ghi nhận thanh toán và xem doanh thu từng bãi được phân công |
| Quản trị | Dashboard, quản lý bãi và chỗ đỗ, phân công nhân viên, duyệt đặt chỗ và xem doanh thu mọi bãi |

Đăng nhập dùng Identity bearer token, hết hạn sau 30 phút, lưu trong `sessionStorage` của tab trình duyệt. Frontend gọi `/api/me` để lấy quyền; API kiểm tra quyền trên từng endpoint. Để bật OTP, đăng nhập và mở **Bảo mật**, xác nhận mật khẩu, quét QR trong ứng dụng xác thực rồi nhập mã 6 số. Cất mã khôi phục trước khi rời trang. Mỗi mã khôi phục chỉ dùng được một lần. OTP không cần dịch vụ SMS hoặc email.

Sơ đồ 3D sắp xếp vị trí từ mã chỗ. Xe màu ngọc lam đánh dấu ô được chọn hoặc xe của khách trong mục **Xe đang gửi**. Dự báo dùng k láng giềng gần nhất có trọng số cho 12 giờ tiếp theo, 7 ngày đầy đủ tiếp theo hoặc 4 tuần đầy đủ tiếp theo (thứ Hai đến Chủ Nhật, giờ Việt Nam). Chế độ ngày và tuần hiển thị trung bình và mức thấp nhất. Mô hình dựa trên thứ và giờ nên các tuần có thể giống nhau. API ưu tiên lịch sử vận hành nếu có ít nhất 20 lượt hoàn tất và trải dài 14 ngày, giữ 3 ngày gần nhất để kiểm tra. Khi chưa đủ lịch sử, 8 bãi Đà Nẵng dùng CSV và biểu đồ ghi rõ nguồn mô phỏng. Dự báo không tính lịch đặt sắp tới.

## Duyệt đặt chỗ

Khách gửi yêu cầu ở **Đặt chỗ**. Yêu cầu giữ ô trong khung giờ đã chọn trong lúc chờ duyệt. Nếu bị từ chối, bị hủy hoặc quá giờ đến mà chưa xác nhận, ô được mở lại cho khung giờ đó. Khách theo dõi trạng thái và lý do từ chối ở **Đặt chỗ của tôi**.

Admin mở **Nhân viên → Phân công bãi** để chọn các bãi nhân viên được duyệt yêu cầu. Admin duyệt được mọi bãi trong **Duyệt đặt chỗ**. Yêu cầu đã xác nhận xuất hiện khi tra lịch đặt ở cổng vào.

## Chuyển khoản QR

Mặc định ứng dụng có thể ghi nhận tiền mặt. Để bật VietQR, cấu hình tài khoản nhận của đơn vị vận hành bằng User Secrets trong thư mục backend:

```powershell
dotnet user-secrets set "VietQr:BankBin" "YOUR_SIX_DIGIT_BANK_BIN"
dotnet user-secrets set "VietQr:AccountNumber" "YOUR_ACCOUNT_NUMBER"
dotnet user-secrets set "VietQr:AccountName" "YOUR_ACCOUNT_NAME"
```

Khởi động lại API. Chủ xe mở **Xe đang gửi** để xem phí và xác nhận xe ra, rồi chọn cách thanh toán trên hóa đơn. Nhân viên có thể xác nhận xe ra tại **Trả xe & thu phí**, đồng thời đối soát số tiền và nội dung chuyển khoản. Khách có thể làm mới trạng thái để xem thời gian và phương thức thanh toán.

Trong **Số dư**, khách tạo yêu cầu nạp và chuyển đúng số tiền và nội dung trong mã VietQR. Admin mở **Duyệt nạp số dư**, đối chiếu sao kê rồi nhập số tiền thực nhận và mã giao dịch. Mỗi mã giao dịch chỉ dùng cho một lần đối soát, kể cả giao dịch trả phí qua VietQR. Khi số dư đủ, khách có thể chọn **Trả bằng số dư** trong hóa đơn phí gửi xe.

## Báo cáo doanh thu

Mở **Doanh thu**, chọn bãi và kỳ ngày, tháng hoặc năm. Kỳ ngày chia theo giờ, kỳ tháng chia theo ngày và kỳ năm chia theo tháng. Chọn một cột trên biểu đồ để xem số tiền theo phương thức thanh toán và đối chiếu hàng tương ứng trong bảng.

Hệ thống tính doanh thu theo giờ Việt Nam (UTC+7), dựa trên lúc ghi nhận thanh toán phí gửi xe. Tiền nạp số dư chỉ trở thành doanh thu khi khách dùng số dư để trả phí. API kiểm tra phân công trên mỗi yêu cầu báo cáo. Admin có thể chọn mọi bãi và nhân viên chọn được các bãi mình phụ trách.

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
