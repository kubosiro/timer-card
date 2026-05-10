import logging
from homeassistant.components.sensor import SensorEntity
from homeassistant.util import dt as dt_util
from . import DOMAIN

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass, entry, async_add_entities):
    """Set up the timer sensors from a config entry."""
    target_entity_id = entry.data["entity_id"]
    name = entry.data["name"]
    
    entities = [SmartTimerSensor(hass, entry, target_entity_id, name)]
    
    # Add Master sensor if not already present in the system
    # Note: For simplicity, we create it with the first entry. 
    # In a multi-instance setup, HA handles cleanup if the entry is removed.
    if not hass.data[DOMAIN].get("master_sensor_added"):
        entities.append(TimerMasterSensor(hass))
        hass.data[DOMAIN]["master_sensor_added"] = True
        
    async_add_entities(entities)

class SmartTimerSensor(SensorEntity):
    """Sensor that tracks a specific timer."""
    
    def __init__(self, hass, entry, target_entity_id, name):
        self._hass = hass
        self._entry = entry
        self._target_entity_id = target_entity_id
        self._attr_name = f"{name} Timer"
        self._attr_unique_id = f"smart_timer_{entry.entry_id}"
        self._attr_icon = "mdi:timer-outline"

    @property
    def device_info(self):
        """Link sensor to the integration device."""
        return {
            "identifiers": {(DOMAIN, self._entry.entry_id)},
            "name": self._entry.title,
            "manufacturer": "Antigravity Pro",
            "model": "Smart Timer Entity",
            "sw_version": "2.4.5",
        }

    @property
    def state(self):
        """Return active if the target entity has an active timer."""
        active_timers = self._hass.data[DOMAIN].get("active_timers", {})
        return "active" if self._target_entity_id in active_timers else "idle"

    @property
    def extra_state_attributes(self):
        """Return timer details."""
        active_timers = self._hass.data[DOMAIN].get("active_timers", {})
        info = active_timers.get(self._target_entity_id, {})
        return {
            "target_entity": self._target_entity_id,
            "end_time": info.get("end_time"),
            "duration": info.get("duration")
        }

    async def async_added_to_hass(self):
        """Register callbacks."""
        self.async_on_remove(
            self._hass.bus.async_listen("smart_timer_updated", self._update_callback)
        )

    def _update_callback(self, event):
        """Update the sensor if its target entity was updated."""
        if event.data.get("entity_id") == self._target_entity_id:
            self.async_write_ha_state()

class TimerMasterSensor(SensorEntity):
    """Sensor that tracks all active timers."""
    
    def __init__(self, hass):
        self._hass = hass
        self._attr_name = "Smart Timer Master"
        self._attr_unique_id = "smart_timer_master"
        self._attr_icon = "mdi:timer-off-outline"

    @property
    def device_info(self):
        """Link master sensor to a global integration device."""
        return {
            "identifiers": {(DOMAIN, "master")},
            "name": "Smart Timer System",
            "manufacturer": "Antigravity Pro",
            "model": "Core Logic",
        }

    @property
    def state(self):
        """Return the number of active timers."""
        active_timers = self._hass.data[DOMAIN].get("active_timers", {})
        return len(active_timers)

    @property
    def extra_state_attributes(self):
        """Return all active timers as attributes."""
        active_timers = self._hass.data[DOMAIN].get("active_timers", {})
        return {"timers": active_timers}

    async def async_added_to_hass(self):
        """Register callbacks."""
        self.async_on_remove(
            self._hass.bus.async_listen("smart_timer_updated", self._update_callback)
        )

    def _update_callback(self, event):
        """Update the sensor when any timer is changed."""
        self.async_write_ha_state()
