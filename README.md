# ⏱️ Smart Timer Pro

A premium, "Plug and Play" timer integration and card for Home Assistant. No more messy helper variables or complex automations—just simple, beautiful timing for any device.

## ✨ Features
- **Zero Configuration**: No `input_number`, `timer`, or `input_boolean` helpers required.
- **Multi-Device Support**: Configure separate timers for every switch, light, or fan in your home.
- **Dedicated Sensors**: Automatically generates a virtual timer sensor for each device (e.g., `sensor.living_room_fan_timer`).
- **Persistence**: Timers are saved and will resume automatically after a Home Assistant restart.
- **Premium UI Card**: A stunning Lovelace card with glassmorphism, animations, and quick presets.
- **Auto-Discovery**: Lovelace resources are registered automatically upon installation.

## 🚀 Installation

### via HACS (Recommended)
1. Open **HACS** -> **Integrations**.
2. Click the three dots in the top right -> **Custom repositories**.
3. Add `https://github.com/kubosiro/timer-card` with category **Integration**.
4. Click **Download** and restart Home Assistant.

### via UI (Config Flow)
1. Go to **Settings** -> **Devices & Services**.
2. Click **Add Integration** and search for **Smart Timer**.
3. Select the physical device you want to control and give it a name.
4. Repeat for as many devices as you need!

## 🎨 Dashboard Configuration
Add the custom card to your dashboard:

```yaml
type: custom:smart-timer-card
entity: switch.your_device
name: "My Smart Timer"
icon: mdi:fan # Optional
```

## 🛠️ Services
You can also set timers via service calls in your automations:

```yaml
service: smart_timer.set
data:
  entity_id: switch.your_device
  duration: 30 # Minutes (0 to clear)
```

---
*Created with ❤️ for the Home Assistant Community.*
