# Petfeeder Card - m1xminus <a href="https://www.buymeacoffee.com/m1xminus" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" style="height: 30px !important;width: 117px !important;" ></a>

A custom Home Assistant Lovelace card for controlling and monitoring pet feeders via ESPHome or other Home Assistant entities. Includes visual editor support and responsive design.

<table border="0">
  <tr>
    <td width="350px">
      <img src="https://github.com/user-attachments/assets/3bc1628a-09b2-4cfc-9059-156f3e2240d3" alt="Normal View" width="350px"><br>
      <b>Normal View</b>
    </td>
    <td width="350px">
      <img src="https://github.com/user-attachments/assets/d497deb4-fc13-4846-85d5-984d5b2d9689" alt="Compact View" width="350px"><br>
      <b>Compact View</b>
    </td>
  </tr>
  <tr>
    <td width="350px">
      <img src="https://github.com/user-attachments/assets/39c3716f-563d-47ee-9150-46655eaa3168" alt="Schedule Editor" width="350px"><br>
      <b>Schedule Editor</b>
    </td>
    <td width="350px">
      <img src="https://github.com/user-attachments/assets/e9baf8e1-6cb2-4527-ba32-07371d7ec1c8" alt="Visual Editor" width="350px"><br>
      <b>Visual Editor</b>
    </td>
  </tr>
</table>

##  **This card was created for my pet feeder project. I tried to make it versatile so it adapts to other devices. If you are having any trouble please fill the issues with your make and model and what type of enteties it expose on your home assistant and what type of issues are you facing, i will do my best to fix it.** 


## Features

- **Status indicators**: 4 configurable status slots with conditional icons and colors based on entity state
- **Schedule Pie**: This center dial (on normal view) and the bars (compact view) represent the active schedules and change colors when they are delivered. If there was an error delivering the food, the pie that has fault lits red.
  This works with NTP from home assistant and a fail delivery sensor that my project has. if your project or device does not expose a fail food delivery it might not show it as fault
- **Pie and Card Custom color** - pick any color you want the pie to be, via visual editor.
- **Pet picture**: Display a pet image in the center of the card
- **Menu dropdown**: Create custom menu items with dynamic content
- **Schedule tracking**: Display next feeding time from multiple schedule entities
- **Last feed time**: Show when the last feeding occurred
- **Visual editor**: Configure the card through Home Assistant UI
- **Responsive design**: Adapts to small screens with fixed margins
- **Compact mode**: Optional compact layout
- **Language Support**: English and Portuguese language changable via visual editor. more languages to come

## Installation via HACS

1. In Home Assistant, go to **HACS** → **(menu)** → **Custom repositories**
2. Add the repository: `https://github.com/m1xminus/petfeeder-card`
3. Select `Dashboard` as the category
4. Click **Create**
5. Click **Install**

## Manual Installation

1. Copy `petfeeder-card.js` to `config/www/`
2. Add a resource in Home Assistant Lovelace:
   - **Settings** → **Dashboards** → **Resources** → **+ Create Resource**
   - URL: `/local/petfeeder-card.js`
   - Type: `JavaScript Module`
3. Refresh your browser

## Configuration

Add a card in your Lovelace dashboard, edit via visual editor!

### Options

- **title**: Card title
- **image**: URL/path to pet image
- **compact**: Enable compact mode 
- **status**: Array of 4 status items (entity, icon, color_map, label)
  - Set to `null` to leave empty
  - `color_map`: JSON map of state → color (e.g., `{"connected":"#4caf50"}`)
- **menu**: Array of menu items with `name` and `content`
- **last_feed_entity**: Entity showing last feeding time
- **schedules**: Array of schedule entities or ISO datetime strings to find next feeding
- **Manual feed**: Manual control for feeding. custom and 3 fixed options.
- **Settings**: Control panel, add sensors or buttons to your taste.
- **Visuals**: Header and content color and transparency control, enable or disable tab content animations

## License

MIT License
Copyright (c) 2026 m1xminus

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
