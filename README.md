# Petfeeder Card

Custom Lovelace card to control and view a pet feeder. Supports visual editing via the provided editor element (`petfeeder-card-editor`).

Installation (manual): copy `petfeeder-card.js` and `petfeeder-card-editor.js` to your `www` folder and add a resource in Lovelace.

Basic config example:

```yaml
type: 'custom:petfeeder-card'
title: 'My Feeder'
image: '/local/pet.png'
compact: false
status:
  - entity: sensor.wifi_signal
    icon: 'mdi:wifi'
    color_map: '{"connected":"#4caf50","disconnected":"#f44336"}'
menu:
  - name: Info
    content: 'Feeder info here.'
last_feed_entity: sensor.pet_last_feed
schedules:
  - 'sensor.feed_time_1'
  - '2026-04-17T08:00:00'
```
