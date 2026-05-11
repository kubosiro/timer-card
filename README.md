# Smart Timer Card for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)

⏱️ **Unified Standalone Version (v6.0.0)** — Phiên bản duy nhất, mạnh mẽ và tinh gọn nhất cho Home Assistant.

![Smart Timer Card](https://img.shields.io/badge/version-6.0.0-blue)

## ✨ Tính năng

- 🎛️ **Hẹn giờ cho mọi thiết bị** — switch, light, fan, input_boolean
- ⏱️ **Countdown hiển thị giây** — `1h 5m 30s`
- 💾 **Bền vững qua restart HA** — lưu timer vào `input_text` helper
- 🔘 **Nút +/-** điều chỉnh thời gian linh hoạt
- 🎯 **Presets** — 1h, 2h, 4h, 6h, 8h
- 🎨 **Glassmorphism UI** — tự động thích ứng với theme HA
- 🧹 **Không rác** — xóa card là sạch hoàn toàn
- 🌐 **VI/EN** — giao diện tiếng Việt

## 📥 Cài đặt

### Qua HACS (khuyến nghị)

1. Mở HACS → **Frontend** → **⋮ Menu** → **Custom repositories**
2. Điền URL: `https://github.com/kubosiro/timer-card` → Category: **Lovelace**
3. Tìm **Smart Timer Card** → **Download**
4. **Clear cache trình duyệt** (Ctrl+Shift+R)

### Thủ công

1. Tải file [`timer-card.js`](https://raw.githubusercontent.com/kubosiro/timer-card/main/timer-card.js)
2. Copy vào thư mục `config/www/` của HA
3. Vào **Settings → Dashboards → Resources → Add Resource**:
   ```
   URL: /local/timer-card.js?v=6.0.0
   Type: JavaScript Module
   ```

## ⚙️ Cấu hình persistence (bền vững qua restart)

Để timer không mất khi restart HA:

1. Tạo 1 helper `input_text`:
   - **Settings → Devices & Services → Helpers → Create Helper → Text**
   - Name: `Smart Timer Data`
   - Max length: `2048`
   - **Chỉ cần tạo 1 lần dùng cho mọi card!**

2. Khi thêm card, chọn helper vừa tạo ở mục **"Lưu trữ bền vững"**

3. Badge `💾` trên card = persistence đang hoạt động

> ⚠️ Nếu không chọn helper, timer vẫn chạy bình thường nhưng sẽ mất khi refresh/restart HA.

## 🎮 Sử dụng

| Nút | Chức năng |
|-----|-----------|
| **Icon/Text** | Bật/tắt thiết bị |
| **-30 / -5 / -1** | Giảm thời gian |
| **+1 / +5 / +30** | Tăng thời gian |
| **Clear (nút tròn)** | Hủy hẹn giờ |
| **1h/2h/4h/6h/8h** | Hẹn giờ nhanh |

## 🏗️ Cấu trúc dự án

```
timer-card/
├── timer-card.js    ← Card chính (vanilla JS, 27KB)
├── hacs.json        ← HACS metadata
├── README.md        ← Tài liệu này
└── LICENSE          ← MIT
```

- **Không backend Python** — chỉ 1 file JS
- **Không cần restart HA** để cài đặt
- **Không helper bắt buộc** — persistence là tùy chọn

## 📝 Requirements

- Home Assistant 2023.5+
- Trình duyệt hiện đại (Chrome/Firefox/Edge/Safari)

## 📄 License

MIT © 2025 kubosiro
