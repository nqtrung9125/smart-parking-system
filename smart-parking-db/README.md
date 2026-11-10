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
