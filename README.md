# Petfeeder Card

A custom Home Assistant Lovelace card for controlling and monitoring pet feeders via ESPHome or other Home Assistant entities. Includes visual editor support and responsive design.

## Features

- **Status indicators**: 4 configurable status slots with conditional icons and colors based on entity state
- **Pet picture**: Display a pet image in the center of the card
- **Menu dropdown**: Create custom menu items with dynamic content
- **Schedule tracking**: Display next feeding time from multiple schedule entities
- **Last feed time**: Show when the last feeding occurred
- **Visual editor**: Configure the card through Home Assistant UI
- **Responsive design**: Adapts to small screens with fixed margins
- **Compact mode**: Optional compact layout

## Installation via HACS

1. In Home Assistant, go to **HACS** → **Lovelace** → **⋮ (menu)** → **Custom repositories**
2. Add the repository: `https://github.com/m1xminus/petfeeder-card`
3. Select `JavaScript` as the category
4. Click **Create**
5. Click **Install**
6. Go to **Settings** → **Dashboards** → **Resources** → **+ Create Resource**
7. Set URL to `/hacsfiles/petfeeder-card/petfeeder-card.js` and type to `JavaScript Module`
8. Refresh your browser (Ctrl+Shift+R)

## Manual Installation

1. Copy `petfeeder-card.js` to `config/www/`
2. Add a resource in Home Assistant Lovelace:
   - **Settings** → **Dashboards** → **Resources** → **+ Create Resource**
   - URL: `/local/petfeeder-card.js`
   - Type: `JavaScript Module`
3. Refresh your browser

## Configuration

Add a card in your Lovelace dashboard:

```yaml
type: 'custom:petfeeder-card'
title: 'My Pet Feeder'
image: '/local/pet.jpg'
compact: false
status:
  - entity: sensor.wifi_status
    icon: 'mdi:wifi'
    color_map: '{"connected":"#4caf50","disconnected":"#f44336"}'
  - entity: sensor.power
    icon: 'mdi:power-plug'
  - null
  - null
menu:
  - name: Info
    content: 'Your feeder info here'
  - name: Logs
    content: 'Feeding logs'
  - name: Feed Now
    content: 'Click to feed manually'
last_feed_entity: sensor.last_feeding_time
schedules:
  - sensor.next_feed_time_1
  - sensor.next_feed_time_2
```

### Options

- **title**: Card title
- **image**: URL/path to pet image
- **compact**: Enable compact mode (boolean)
- **status**: Array of 4 status items (entity, icon, color_map, label)
  - Set to `null` to leave empty
  - `color_map`: JSON map of state → color (e.g., `{"connected":"#4caf50"}`)
- **menu**: Array of menu items with `name` and `content`
- **last_feed_entity**: Entity showing last feeding time
- **schedules**: Array of schedule entities or ISO datetime strings to find next feeding

## License

MIT
