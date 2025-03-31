# Setup

```bash
chmod +x setup.sh
./setup.sh
```

# Overview

## Initialization and Connection:

*   `__init__(self, port=None, baudrate=250000, num_channels=32, timeout=1)`: Initializes the controller, attempts to find the port automatically, and connects.
*   `_find_usb_serial_port(self)`: (Private) Attempts to automatically find the USB serial port.
*   `_connect(self)`: (Private) Establishes a serial connection to the device.
*   `disconnect(self)`: Closes the serial connection.

## Core DMX Control:

*   `send_dmx_packet(self, channel_values=None)`: Sends a DMX packet with specified channel values or the current state if none are provided.
*   `set_channel(self, channel, value)`: Sets the value of a single DMX channel and sends an update.
*   `get_channel_value(self, channel)`: Gets the current value of a specific DMX channel.

## Specific Laser Functions (Channels and Modes):

*   `set_lamp_mode(self, mode)`: Sets the ON/OFF lamp mode (Channel 1).
*   `set_pattern_size(self, laser_num, size_mode, value=None)`: Sets the pattern size/out-of-bounds mode (Channel 2 or 19).
*   `select_gallery(self, gallery_num)`: Selects the gallery (Channel 3).
*   `select_pattern(self, laser_num, pattern_index)`: Selects a pattern (Channel 4 or 21).
*   `set_pattern_zooming(self, laser_num, zoom_mode, value=None)`: Sets the pattern zooming mode (Channel 5 or 22).
*   `set_pattern_rotation(self, laser_num, rotation_mode, value=None)`: Sets the pattern rotation mode (Channel 6 or 23).
*   `set_horizontal_movement(self, laser_num, movement_mode, value=None)`: Sets the horizontal movement mode (Channel 7 or 24).
*   `set_vertical_movement(self, laser_num, movement_mode, value=None)`: Sets the vertical movement mode (Channel 8 or 25).
*   `set_horizontal_zooming(self, zoom_mode, value=None)`: Sets the horizontal zooming mode (Channel 9).
*   `set_vertical_zooming(self, zoom_mode, value=None)`: Sets the vertical zooming mode (Channel 10).
*   `set_forced_color(self, laser_num, mode, value=None)`: Sets the forced color mode (Channel 11 or 28).
*   `set_strobe_flash(self, mode, value=None)`: Sets the strobe/flash mode (Channel 12).
*   `set_node_highlighting(self, laser_num, mode, value=None)`: Sets the node highlighting mode (Channel 13 or 30).
*   `set_node_expansion(self, laser_num, expansion_value, delay_value=None)`: Sets the node expansion (Channel 14 or 31).
*   `set_gradual_drawing(self, laser_num, mode, manual_expansion_value=None)`: Sets the gradual drawing mode (Channel 15 or 32).
*   `set_distortion_degree(self, laser_num, degree)`: Sets the degree of distortion (Channel 16 or 17).
*   `set_second_lamp_pattern(self, pattern_value)`: Sets the second lamp pattern (Channel 18).
*   `set_pattern_library_selection(self, mode)`: Sets the pattern library selection mode (Channel 20).
*   `set_horizontal_flip(self, mode, value=None)`: Sets the horizontal flip mode (Channel 26).
*   `set_vertical_flip(self, mode, value=None)`: Sets the vertical flip mode (Channel 27).
*   `set_color_change(self, mode, value=None)`: Sets the color change mode (Channel 29).

## Utility Functions:

*   `blackout(self)`: Turns off all lasers.
*   `reset_all_channels(self)`: Resets all DMX channels to their default values.
*   `get_current_state(self)`: Returns the current state of all DMX channels.