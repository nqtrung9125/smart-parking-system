# Tìm mã nguồn backend Smart Parking

Mở `Parking.Api/Parking.Api.csproj` trong Visual Studio. Bắt đầu từ `Program.cs` để xem thứ tự khởi động API, xác thực và các tác vụ chạy nền. Các bước cài PostgreSQL, cấu hình tài khoản và chạy dự án nằm trong [hướng dẫn chung](../README.md).

## Thư mục trong Parking.Api

| Thư mục | Nơi cần tìm khi sửa chức năng |
| --- | --- |
| `Features/Accounts` | Đăng ký, đăng nhập bằng email hoặc số điện thoại, hồ sơ và xác thực hai bước. |
| `Features/Assistant` | Nhận câu hỏi tiếng Việt, gọi Gemini và lấy dữ liệu hoặc báo giá theo quyền tài khoản. |
| `Features/ParkingLots` | Danh mục bãi, ô đỗ, sơ đồ, tìm bãi và truy vấn giới hạn phạm vi nhân viên được xem. |
| `Features/Staff` | Cấp quyền nhân viên và quản lý phân công bãi. |
| `Features/Vehicles` | Đăng ký xe, tra cứu biển số và quản lý xe của khách. |
| `Features/Reservations` | Đặt chỗ, giữ cọc, hủy lịch và xử lý khách vắng mặt. |
| `Features/ParkingSessions` | Nhận xe, trả xe, gia hạn và chốt phí lượt gửi. |
| `Features/Billing` | Biểu giá, ví, nạp tiền, đối soát chuyển khoản và ghi nhận thanh toán. |
| `Features/Reporting` | Tổng quan vận hành và doanh thu theo bãi, kỳ báo cáo. |
| `Features/Forecasting` | Đọc dữ liệu công suất, chạy mô hình và lưu quan sát để đánh giá dự báo. |
| `Data` | `ParkingDbContext` ánh xạ bảng PostgreSQL. `Seeding` chứa mã khởi tạo dữ liệu, `Training` chứa CSV cho mô hình. |
| `Migrations` | Lịch sử thay đổi cơ sở dữ liệu và bản chụp mô hình Entity Framework. |

Ví dụ, khi sửa phí trả xe trễ, bắt đầu ở `Features/Billing/ParkingPricing.cs`. Lần theo `ParkingSessionsController` để xem lúc chốt hóa đơn và `ParkingExtensionsController` để xem phí đã phát sinh được chuyển sang lần gia hạn thế nào.
