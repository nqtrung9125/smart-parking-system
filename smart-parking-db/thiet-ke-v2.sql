-- Lược đồ nghiệp vụ của ERD tiếng Việt. Dùng cho database thiết kế parking_thiet_ke_v2, hỗ trợ tạo mới và nâng cấp bản 13 bảng.
BEGIN;
CREATE SCHEMA IF NOT EXISTS bai_xe_v2;
SET LOCAL search_path TO bai_xe_v2, pg_catalog;

-- Sequence cấp số an toàn khi có nhiều yêu cầu đồng thời.
-- Độ rộng là số chữ số tối thiểu, tránh cắt mất số khi sequence tăng.
CREATE OR REPLACE FUNCTION bai_xe_v2.dinh_dang_so(so bigint, do_rong integer) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
    SELECT lpad(so::text, greatest(do_rong, length(so::text)), '0')
$$;

CREATE OR REPLACE FUNCTION bai_xe_v2.ma_theo_ngay(tien_to text, thu_tu bigint) RETURNS text
LANGUAGE sql STABLE STRICT AS $$
    SELECT tien_to || '-' || to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYYMMDD')
        || '-' || bai_xe_v2.dinh_dang_so(thu_tu, 6)
$$;

CREATE SEQUENCE IF NOT EXISTS so_tai_khoan;
CREATE SEQUENCE IF NOT EXISTS so_bai;
CREATE SEQUENCE IF NOT EXISTS so_xe;
CREATE SEQUENCE IF NOT EXISTS so_dat_cho;
CREATE SEQUENCE IF NOT EXISTS so_luot_gui;
CREATE SEQUENCE IF NOT EXISTS so_thanh_toan;
CREATE SEQUENCE IF NOT EXISTS so_nap;

CREATE TABLE IF NOT EXISTS tai_khoan (
    ma_tai_khoan varchar(24) PRIMARY KEY DEFAULT ('TK-' || bai_xe_v2.dinh_dang_so(nextval('so_tai_khoan'), 6)),
    email varchar(256) NOT NULL
);

CREATE TABLE IF NOT EXISTS ho_so_tai_khoan (
    ma_tai_khoan varchar(24) PRIMARY KEY REFERENCES tai_khoan,
    ten_hien_thi varchar(80),
    dien_thoai varchar(20),
    dia_chi varchar(255),
    dien_thoai_dang_nhap varchar(16) UNIQUE,
    cccd_da_ma_hoa text
);

CREATE TABLE IF NOT EXISTS vai_tro (
    ma_vai_tro varchar(24) PRIMARY KEY,
    ten_vai_tro varchar(256) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS gan_vai_tro (
    ma_tai_khoan varchar(24) REFERENCES tai_khoan,
    ma_vai_tro varchar(24) REFERENCES vai_tro,
    PRIMARY KEY (ma_tai_khoan, ma_vai_tro)
);

CREATE TABLE IF NOT EXISTS bai_do (
    ma_bai varchar(24) PRIMARY KEY DEFAULT ('BAI-DN-' || bai_xe_v2.dinh_dang_so(nextval('so_bai'), 4)),
    ten_bai varchar(120) NOT NULL,
    dia_chi varchar(255) NOT NULL,
    luc_tao timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS phan_cong_bai (
    ma_nhan_vien varchar(24) REFERENCES tai_khoan,
    ma_bai varchar(24) REFERENCES bai_do,
    PRIMARY KEY (ma_nhan_vien, ma_bai)
);

CREATE TABLE IF NOT EXISTS o_do (
    ma_o varchar(24) PRIMARY KEY,
    ma_bai varchar(24) NOT NULL REFERENCES bai_do,
    ky_hieu_tai_bai varchar(20) NOT NULL,
    loai_xe integer NOT NULL CHECK (loai_xe IN (1, 2)),
    dang_khai_thac boolean NOT NULL DEFAULT true,
    UNIQUE (ma_bai, ky_hieu_tai_bai)
);

CREATE TABLE IF NOT EXISTS phuong_tien (
    ma_xe varchar(24) PRIMARY KEY DEFAULT ('XE-' || bai_xe_v2.dinh_dang_so(nextval('so_xe'), 6)),
    ma_chu_xe varchar(24) NOT NULL REFERENCES tai_khoan,
    bien_so varchar(15) NOT NULL UNIQUE,
    loai_xe integer NOT NULL CHECK (loai_xe IN (1, 2)),
    luc_tao timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (ma_xe, ma_chu_xe)
);

CREATE TABLE IF NOT EXISTS dat_cho (
    ma_dat_cho varchar(24) PRIMARY KEY DEFAULT bai_xe_v2.ma_theo_ngay('DC', nextval('so_dat_cho')),
    ma_khach varchar(24) NOT NULL REFERENCES tai_khoan,
    ma_xe varchar(24) NOT NULL,
    ma_o varchar(24) NOT NULL REFERENCES o_do,
    gio_den_du_kien timestamptz NOT NULL,
    gio_ra_du_kien timestamptz NOT NULL,
    trang_thai integer NOT NULL DEFAULT 1,
    luc_tao timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    luc_xet_duyet timestamptz,
    ly_do_tu_choi varchar(300),
    don_gia_gio numeric(12,2),
    muc_phi_ra_som numeric(12,2) NOT NULL DEFAULT 0,
    muc_phi_tre_moi_ngay numeric(12,2) NOT NULL DEFAULT 0,
    muc_phu_phi numeric(12,2) NOT NULL DEFAULT 0,
    phi_uoc_tinh numeric(12,2),
    FOREIGN KEY (ma_xe, ma_khach) REFERENCES phuong_tien (ma_xe, ma_chu_xe),
    UNIQUE (ma_dat_cho, ma_xe, ma_o),
    CHECK (gio_ra_du_kien > gio_den_du_kien)
);

CREATE TABLE IF NOT EXISTS luot_gui_xe (
    ma_luot_gui varchar(24) PRIMARY KEY DEFAULT bai_xe_v2.ma_theo_ngay('LG', nextval('so_luot_gui')),
    ma_dat_cho varchar(24) UNIQUE,
    ma_xe varchar(24) NOT NULL REFERENCES phuong_tien,
    ma_o varchar(24) NOT NULL REFERENCES o_do,
    gio_vao timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    gio_ra timestamptz,
    so_gio_tinh_phi integer,
    phi_co_ban numeric(12,2),
    phi_ra_som numeric(12,2) NOT NULL DEFAULT 0,
    so_ngay_tre integer NOT NULL DEFAULT 0,
    phi_tre numeric(12,2) NOT NULL DEFAULT 0,
    phu_phi numeric(12,2) NOT NULL DEFAULT 0,
    tong_phi numeric(12,2),
    FOREIGN KEY (ma_dat_cho, ma_xe, ma_o) REFERENCES dat_cho (ma_dat_cho, ma_xe, ma_o),
    CHECK (gio_ra >= gio_vao),
    CHECK (tong_phi IS NULL OR (phi_co_ban IS NOT NULL AND tong_phi = phi_co_ban + phi_ra_som + phi_tre + phu_phi))
);
CREATE UNIQUE INDEX IF NOT EXISTS mot_luot_mo_moi_o ON luot_gui_xe (ma_o) WHERE gio_ra IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mot_luot_mo_moi_xe ON luot_gui_xe (ma_xe) WHERE gio_ra IS NULL;

CREATE TABLE IF NOT EXISTS thanh_toan (
    ma_thanh_toan varchar(24) PRIMARY KEY DEFAULT bai_xe_v2.ma_theo_ngay('TT', nextval('so_thanh_toan')),
    ma_luot_gui varchar(24) NOT NULL UNIQUE REFERENCES luot_gui_xe,
    so_tien numeric(12,2) NOT NULL CHECK (so_tien >= 0),
    phuong_thuc integer NOT NULL,
    ghi_chu varchar(80),
    luc_thanh_toan timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS thanh_toan_theo_thoi_diem ON thanh_toan (luc_thanh_toan);

CREATE TABLE IF NOT EXISTS yeu_cau_nap_tien (
    ma_nap varchar(24) PRIMARY KEY DEFAULT bai_xe_v2.ma_theo_ngay('NAP', nextval('so_nap')),
    ma_khach varchar(24) NOT NULL REFERENCES tai_khoan,
    ma_nguoi_duyet varchar(24) REFERENCES tai_khoan,
    so_tien numeric(12,2) NOT NULL CHECK (so_tien > 0),
    ma_ngan_hang varchar(6) NOT NULL,
    so_tai_khoan_nhan varchar(25) NOT NULL,
    ten_tai_khoan_nhan varchar(80) NOT NULL,
    noi_dung_chuyen_khoan varchar(25) NOT NULL UNIQUE,
    luc_tao timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    luc_duyet timestamptz,
    CHECK ((luc_duyet IS NULL) = (ma_nguoi_duyet IS NULL))
);

CREATE TABLE IF NOT EXISTS bien_lai_ngan_hang (
    ma_giao_dich_ngan_hang varchar(80) PRIMARY KEY,
    ma_thanh_toan varchar(24) UNIQUE REFERENCES thanh_toan,
    ma_nap varchar(24) UNIQUE REFERENCES yeu_cau_nap_tien,
    CHECK (num_nonnulls(ma_thanh_toan, ma_nap) = 1),
    CHECK (ma_giao_dich_ngan_hang <> '' AND ma_giao_dich_ngan_hang = upper(btrim(ma_giao_dich_ngan_hang)))
);
-- Mở rộng thiết kế cũ ngay trong giao dịch. Các đơn trước khi có cọc có mức cọc 0.
ALTER TABLE dat_cho
    ALTER COLUMN trang_thai SET DEFAULT 1,
    DROP CONSTRAINT IF EXISTS dat_cho_trang_thai_check,
    ADD CONSTRAINT dat_cho_trang_thai_check CHECK (trang_thai BETWEEN 1 AND 7),
    ADD COLUMN IF NOT EXISTS ma_yeu_cau_dat uuid,
    ADD COLUMN IF NOT EXISTS han_nhan_xe timestamptz
        CHECK (han_nhan_xe > gio_den_du_kien AND han_nhan_xe <= gio_ra_du_kien),
    ADD COLUMN IF NOT EXISTS tien_coc numeric(12,2) NOT NULL DEFAULT 0 CHECK (tien_coc >= 0),
    ADD COLUMN IF NOT EXISTS coc_da_thu numeric(12,2) CHECK (coc_da_thu BETWEEN 0 AND tien_coc),
    ADD COLUMN IF NOT EXISTS luc_chot_coc timestamptz
        CHECK ((luc_chot_coc IS NULL) = (coc_da_thu IS NULL));
CREATE UNIQUE INDEX IF NOT EXISTS dat_cho_ma_yeu_cau ON dat_cho (ma_khach, ma_yeu_cau_dat);
CREATE INDEX IF NOT EXISTS dat_cho_cho_nhan_xe ON dat_cho (han_nhan_xe) WHERE trang_thai = 1;

ALTER TABLE luot_gui_xe ADD COLUMN IF NOT EXISTS coc_khau_tru numeric(12,2) NOT NULL DEFAULT 0
    CHECK (coc_khau_tru >= 0 AND (coc_khau_tru = 0 OR
        (ma_dat_cho IS NOT NULL AND tong_phi IS NOT NULL AND coc_khau_tru <= tong_phi)));
ALTER TABLE thanh_toan
    DROP CONSTRAINT IF EXISTS thanh_toan_phuong_thuc_check,
    ADD CONSTRAINT thanh_toan_phuong_thuc_check CHECK (
        phuong_thuc BETWEEN 1 AND 4 OR (phuong_thuc = 5 AND so_tien = 0));

CREATE SEQUENCE IF NOT EXISTS so_gia_han;
CREATE TABLE IF NOT EXISTS gia_han_gui_xe (
    ma_gia_han varchar(24) PRIMARY KEY DEFAULT bai_xe_v2.ma_theo_ngay('GH', nextval('so_gia_han')),
    ma_luot_gui varchar(24) NOT NULL REFERENCES luot_gui_xe,
    gio_ra_cu timestamptz NOT NULL,
    gio_ra_de_nghi timestamptz NOT NULL CHECK (gio_ra_de_nghi > gio_ra_cu),
    luc_yeu_cau timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    trang_thai integer NOT NULL CHECK (trang_thai BETWEEN 1 AND 4),
    luc_xu_ly timestamptz,
    ma_nguoi_xu_ly varchar(24) REFERENCES tai_khoan,
    so_ngay_tre_da_tinh integer NOT NULL DEFAULT 0 CHECK (so_ngay_tre_da_tinh >= 0),
    phi_tre_da_tinh numeric(12,2) NOT NULL DEFAULT 0 CHECK (phi_tre_da_tinh >= 0),
    phi_uoc_tinh numeric(12,2) NOT NULL CHECK (phi_uoc_tinh >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS mot_gia_han_cho_xu_ly ON gia_han_gui_xe(ma_luot_gui) WHERE trang_thai = 1;

CREATE TABLE IF NOT EXISTS quan_sat_du_bao (
    ma_bai varchar(24) NOT NULL REFERENCES bai_do,
    loai_xe integer NOT NULL CHECK (loai_xe IN (1, 2)),
    luc_quan_sat timestamptz NOT NULL,
    moc_du_bao timestamptz NOT NULL CHECK (moc_du_bao > luc_quan_sat),
    suc_chua integer NOT NULL CHECK (suc_chua >= 0),
    so_o_dang_do integer NOT NULL CHECK (so_o_dang_do BETWEEN 0 AND suc_chua),
    so_o_da_dat integer NOT NULL CHECK (so_o_da_dat BETWEEN 0 AND suc_chua),
    PRIMARY KEY (ma_bai, loai_xe, luc_quan_sat, moc_du_bao)
);

-- Tổng hợp từng nguồn riêng để một lượt gửi không nhân đôi các khoản nạp hay cọc.
CREATE OR REPLACE VIEW so_du_khach_hang AS
WITH bien_dong AS (
    SELECT ma_khach, so_tien AS thay_doi, 0::numeric AS dang_giu
    FROM yeu_cau_nap_tien WHERE luc_duyet IS NOT NULL
    UNION ALL
    SELECT ma_khach, -coalesce(coc_da_thu, tien_coc),
           CASE WHEN luc_chot_coc IS NULL THEN tien_coc ELSE 0 END
    FROM dat_cho
    UNION ALL
    SELECT x.ma_chu_xe, -tt.so_tien, 0
    FROM thanh_toan tt JOIN luot_gui_xe lg USING (ma_luot_gui)
    JOIN phuong_tien x USING (ma_xe) WHERE tt.phuong_thuc = 4
)
SELECT tk.ma_tai_khoan AS ma_khach, coalesce(sum(bd.thay_doi), 0) AS so_du_kha_dung,
       coalesce(sum(bd.dang_giu), 0) AS coc_dang_giu
FROM tai_khoan tk LEFT JOIN bien_dong bd ON bd.ma_khach = tk.ma_tai_khoan
GROUP BY tk.ma_tai_khoan;

CREATE OR REPLACE VIEW khoan_thu_theo_bai AS
SELECT o.ma_bai, tt.luc_thanh_toan AS luc_thu, tt.phuong_thuc, tt.so_tien
FROM thanh_toan tt JOIN luot_gui_xe lg USING (ma_luot_gui)
JOIN o_do o USING (ma_o) WHERE tt.so_tien > 0
UNION ALL
SELECT o.ma_bai, dc.luc_chot_coc, 5, dc.coc_da_thu
FROM dat_cho dc JOIN o_do o USING (ma_o) WHERE dc.coc_da_thu > 0;
COMMIT;
