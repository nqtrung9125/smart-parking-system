# PostgreSQL cho hệ thống bãi đỗ xe

Chạy trong thư mục này:

```powershell
docker compose up -d
docker compose ps
```

Kết nối từ máy Windows: `localhost:5433`. Tên database và tài khoản ở file `.env`.

Mở psql trong container:

```powershell
docker compose exec postgres psql -U parking_app -d parking_db
```

Dừng database (vẫn giữ dữ liệu):

```powershell
docker compose down
```

Không chạy `docker compose down -v` nếu muốn giữ dữ liệu.

## Bản thiết kế tiếng Việt

Mở [ERD tiếng Việt](erd-tieng-viet.md) hoặc [sơ đồ SVG](erd-tieng-viet.svg) để xem quan hệ của 15 bảng nghiệp vụ. Trong pgAdmin hoặc DBeaver, kết nối database `parking_thiet_ke_v2` và chạy toàn bộ [script SQL](thiet-ke-v2.sql). Khi cài trên máy mới, tạo database trống mang tên này trước. Script chạy trong một giao dịch và có thể chạy lại trên bản thiết kế cũ.

Trong schema `bai_xe_v2`, mở view `so_du_khach_hang` để xem số dư khả dụng và tiền cọc đang giữ. View `khoan_thu_theo_bai` cung cấp các khoản đã thu để tổng hợp doanh thu. Backend C# dùng database `parking_db` và bộ migration Entity Framework riêng.
