import serial
import serial.tools.list_ports
import time


class DmxController:
    """
    Low-level API for controlling a DMX512 laser projector via USB on macOS.
    """

    def __init__(self, port=None, baudrate=250000, num_channels=32, timeout=1):
        """
        Initializes the DmxController.

        Args:
            port (str, optional): The serial port to use (e.g., '/dev/tty.usbmodem14201').
                                  If None, it will try to auto-detect. Defaults to None.
            baudrate (int, optional): The baud rate for serial communication. Defaults to 250000.
            num_channels (int, optional): The number of DMX channels. Defaults to 32.
            timeout (float, optional): Timeout for serial communication in seconds. Defaults to 1.
        """

        self.baudrate = baudrate
        self.num_channels = num_channels
        self.timeout = timeout
        self.port = port
        self.serial_port = None
        self.current_state = [0] * self.num_channels  # Initialize all channels to 0

        if self.port is None:
            self.port = self._find_usb_serial_port()
            self.serial_port = serial.Serial(port=port, baudrate=self.baudrate)

        if self.port:
            self._connect()

    def _find_usb_serial_port(self):
        """
        Attempts to automatically find the USB serial port for the DMX device.

        Returns:
            str: The port name if found, otherwise None.
        """
        ports = serial.tools.list_ports.comports()
        for port in ports:
            # You might need to adjust the criteria based on your device's description
            if (
                "USB" in port.description.upper()
                or "SERIAL" in port.description.upper()
            ):
                print(f"Found potential DMX device at: {port.device}")
                return port.device
        print("Warning: Could not automatically find DMX device port.")
        return None

    def _connect(self):
        """
        Establishes a serial connection to the DMX device.
        """
        try:
            self.serial_port = serial.Serial(
                port=self.port, baudrate=self.baudrate, timeout=self.timeout
            )
            print(f"Connected to DMX device at {self.port}")
            time.sleep(2)  # Allow time for the device to initialize after connection
        except serial.SerialException as e:
            print(f"Error connecting to DMX device: {e}")
            self.serial_port = None

    def disconnect(self):
        """
        Closes the serial connection.
        """
        if self.serial_port:
            self.serial_port.close()
            print("Disconnected from DMX device.")
            self.serial_port = None
        else:
            print("Not connected to a DMX device.")

    def send_dmx_packet(self, channel_values=None):
        """
        Sends a DMX packet to the device.

        Args:
            channel_values (dict, optional): A dictionary where keys are channel numbers (1-based)
                                             and values are the desired values (0-255).
                                             If None, sends the current state. Defaults to None.
        """
        if not self.serial_port:
            print("Error: Not connected to a DMX device.")
            return

        if channel_values:
            for channel, value in channel_values.items():
                if 1 <= channel <= self.num_channels and 0 <= value <= 255:
                    self.current_state[channel - 1] = value
                else:
                    print(
                        f"Warning: Invalid channel ({channel}) or value ({value}). Skipping."
                    )

        # Construct the DMX packet: Start Code + Channel Data
        packet = bytearray([0x00])  # DMX start code is always 0
        packet.extend(self.current_state)

        try:
            self.serial_port.write(packet)
        except serial.SerialException as e:
            print(f"Error sending DMX packet: {e}")

    def set_channel(self, channel, value):
        """
        Sets the value of a single DMX channel and sends an update.

        Args:
            channel (int): The DMX channel number (1-based).
            value (int): The value to set (0-255).
        """
        self.send_dmx_packet({channel: value})

    def get_channel_value(self, channel):
        """
        Gets the current value of a specific DMX channel

        Args:
          channel (int): The DMX channel number (1-based).
        Returns:
          int: The current DMX channel value.
        """
        if 1 <= channel <= self.num_channels:
            return self.current_state[channel - 1]
        else:
            print(f"Warning: Invalid channel number: {channel}")
            return None

    # --- Specific Laser Functions ---

    def set_lamp_mode(self, mode):
        """
        Sets the ON/OFF lamp mode (Channel 1).

        Args:
            mode (str): 'off', 'manual', 'dynamic_sound', 'tune_program',
                        'sound_program', 'off_end'
        """
        modes = {
            "off": 0,
            "manual": (1, 99),  # Range for manual mode
            "dynamic_sound": (100, 199),  # Range for dynamic sound control
            "tune_program": (200, 219),  # Range for tuning program library
            "sound_program": (220, 249),  # Range for sound-control program library
            "off_end": (250, 255),  # Off at the end of the range
        }

        if mode not in modes:
            print(f"Invalid mode: {mode}. Choose from: {', '.join(modes.keys())}")
            return

        value = modes[mode]
        if isinstance(value, tuple):
            # If it's a range, you might want to choose a specific value or prompt the user
            print(
                f"Mode '{mode}' requires a value between {value[0]} and {value[1]}. Using the minimum value."
            )
            value = value[0]

        self.set_channel(1, value)

    def set_pattern_size(self, laser_num, size_mode, value=None):
        """
        Sets the out-of-bounds/pattern size for a given laser (Channel 2 or 19).

        Args:
            laser_num (int): The laser number (1 or 2).
            size_mode (str): 'parts_blank', 'returns', 'folds', 'crossing', 'blanking'.
            value (int, optional): A specific value within the mode's range (0-255). If None,
                                   a default value will be used based on the mode.
        """
        if laser_num not in (1, 2):
            print("Invalid laser number. Must be 1 or 2.")
            return

        channel = 2 if laser_num == 1 else 19

        modes = {
            "parts_blank": (0, 49),
            "returns": (50, 99),
            "folds": (100, 149),
            "crossing": (150, 199),
            "blanking": (200, 255),
        }

        if size_mode not in modes:
            print(
                f"Invalid size mode: {size_mode}. Choose from: {', '.join(modes.keys())}"
            )
            return

        mode_range = modes[size_mode]
        if value is None:
            value = mode_range[0]  # Default to the beginning of the range
            print(
                f"Using default value {value} for {size_mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
        elif not (mode_range[0] <= value <= mode_range[1]):
            print(
                f"Value {value} is out of range for {size_mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
            return

        self.set_channel(channel, value)

    def select_gallery(self, gallery_num):
        """
        Selects the gallery (Channel 3).

        Args:
            gallery_num (int): 0 for Beam gallery, 1 for Animation gallery.
        """
        if gallery_num == 0:
            self.set_channel(3, 0)  # Beam gallery
        elif gallery_num == 1:
            self.set_channel(3, 240)  # Animation gallery
        else:
            print("Invalid gallery number. Must be 0 or 1.")

    def select_pattern(self, laser_num, pattern_index):
        """
        Selects a pattern (Channel 4 or 21).

        Args:
            laser_num (int): The laser number (1 or 2).
            pattern_index (int): The index of the pattern (0 to play all in order, or a specific index).
        """
        channel = 4 if laser_num == 1 else 21
        self.set_channel(channel, pattern_index)

    def set_pattern_zooming(self, laser_num, zoom_mode, value=None):
        """
        Sets the pattern zooming mode for a given laser (Channel 5 or 22).

        Args:
            laser_num (int): The laser number (1 or 2).
            zoom_mode (str): 'static', 'zoom_in', 'zoom_out', 'flip_zooming'.
            value (int, optional): A specific value within the mode's range. If None,
                                    a default value will be used based on the mode.
        """
        channel = 5 if laser_num == 1 else 22

        modes = {
            "static": (0, 127),
            "zoom_in": (128, 159),
            "zoom_out": (160, 191),
            "flip_zooming": (192, 255),
        }

        if zoom_mode not in modes:
            print(
                f"Invalid zoom mode: {zoom_mode}. Choose from: {', '.join(modes.keys())}"
            )
            return

        mode_range = modes[zoom_mode]
        if value is None:
            value = mode_range[0]
            print(
                f"Using default value {value} for {zoom_mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
        elif not (mode_range[0] <= value <= mode_range[1]):
            print(
                f"Value {value} is out of range for {zoom_mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
            return

        self.set_channel(channel, value)

    def set_pattern_rotation(self, laser_num, rotation_mode, value=None):
        """
        Sets the pattern rotation mode for a given laser (Channel 6 or 23).

        Args:
            laser_num (int): The laser number (1 or 2).
            rotation_mode (str): 'static', 'dynamic_inversion'.
            value (int, optional): A specific value within the mode's range. If None,
                                   a default value will be used based on the mode.
        """

        channel = 6 if laser_num == 1 else 23

        modes = {
            "static": (0, 127),
            "dynamic_inversion": (
                128,
                255,
            ),  # This mode has two ranges in the CSV, assuming they both use same function
        }

        if rotation_mode not in modes:
            print(
                f"Invalid rotation mode: {rotation_mode}. Choose from: {', '.join(modes.keys())}"
            )
            return

        mode_range = modes[rotation_mode]
        if value is None:
            value = mode_range[0]
            print(
                f"Using default value {value} for {rotation_mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
        elif not (mode_range[0] <= value <= mode_range[1]):
            print(
                f"Value {value} is out of range for {rotation_mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
            return

        self.set_channel(channel, value)

    def set_horizontal_movement(self, laser_num, movement_mode, value=None):
        """
        Sets the horizontal movement mode for a given laser (Channel 7 or 24).

        Args:
            laser_num (int): The laser number (1 or 2).
            movement_mode (str): 'static', 'push_up', 'push_down', 'left_shift', 'right_shift'.
            value (int, optional): A specific value within the mode's range. If None,
                                   a default value will be used based on the mode.
        """
        channel = 7 if laser_num == 1 else 24

        modes = {
            "static": (0, 127),
            "push_up": (128, 159),
            "push_down": (160, 191),
            "left_shift": (192, 223),
            "right_shift": (224, 255),
        }

        if movement_mode not in modes:
            print(
                f"Invalid movement mode: {movement_mode}. Choose from: {', '.join(modes.keys())}"
            )
            return

        mode_range = modes[movement_mode]
        if value is None:
            value = mode_range[0]
            print(
                f"Using default value {value} for {movement_mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
        elif not (mode_range[0] <= value <= mode_range[1]):
            print(
                f"Value {value} is out of range for {movement_mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
            return

        self.set_channel(channel, value)

    def set_vertical_movement(self, laser_num, movement_mode, value=None):
        """
        Sets the vertical movement mode for a given laser (Channel 8 or 25).

        Args:
            laser_num (int): The laser number (1 or 2).
            movement_mode (str): 'static', 'right_push', 'left_push', 'move_up', 'move_down'.
            value (int, optional): A specific value within the mode's range. If None,
                                   a default value will be used based on the mode.
        """
        channel = 8 if laser_num == 1 else 25

        modes = {
            "static": (0, 127),
            "right_push": (128, 159),
            "left_push": (160, 191),
            "move_up": (192, 223),
            "move_down": (224, 255),
        }

        if movement_mode not in modes:
            print(
                f"Invalid movement mode: {movement_mode}. Choose from: {', '.join(modes.keys())}"
            )
            return

        mode_range = modes[movement_mode]
        if value is None:
            value = mode_range[0]
            print(
                f"Using default value {value} for {movement_mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
        elif not (mode_range[0] <= value <= mode_range[1]):
            print(
                f"Value {value} is out of range for {movement_mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
            return

        self.set_channel(channel, value)

    def set_horizontal_zooming(self, zoom_mode, value=None):
        """
        Sets the horizontal zooming mode (Channel 9).

        Args:
            zoom_mode (str): 'static', 'push_up_distortion', 'push_down_distortion', 'zooming', 'flip_zooming'.
            value (int, optional): A specific value within the mode's range. If None,
                                   a default value will be used based on the mode.
        """
        modes = {
            "static": (0, 127),
            "push_up_distortion": (128, 159),
            "push_down_distortion": (160, 191),
            "zooming": (192, 223),
            "flip_zooming": (224, 255),
        }

        if zoom_mode not in modes:
            print(
                f"Invalid zoom mode: {zoom_mode}. Choose from: {', '.join(modes.keys())}"
            )
            return

        mode_range = modes[zoom_mode]
        if value is None:
            value = mode_range[0]
            print(
                f"Using default value {value} for {zoom_mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
        elif not (mode_range[0] <= value <= mode_range[1]):
            print(
                f"Value {value} is out of range for {zoom_mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
            return

        self.set_channel(9, value)

    def set_vertical_zooming(self, zoom_mode, value=None):
        """
        Sets the vertical zooming mode (Channel 10).

        Args:
            zoom_mode (str): 'static', 'right_push_distortion', 'left_push_distortion', 'zoom', 'dynamic_flip_zooming'.
            value (int, optional): A specific value within the mode's range. If None,
                                   a default value will be used based on the mode.
        """
        modes = {
            "static": (0, 127),
            "right_push_distortion": (128, 159),
            "left_push_distortion": (160, 191),
            "zoom": (192, 223),
            "dynamic_flip_zooming": (224, 255),
        }

        if zoom_mode not in modes:
            print(
                f"Invalid zoom mode: {zoom_mode}. Choose from: {', '.join(modes.keys())}"
            )
            return

        mode_range = modes[zoom_mode]
        if value is None:
            value = mode_range[0]
            print(
                f"Using default value {value} for {zoom_mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
        elif not (mode_range[0] <= value <= mode_range[1]):
            print(
                f"Value {value} is out of range for {zoom_mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
            return

        self.set_channel(10, value)

    def set_forced_color(self, laser_num, mode, value=None):
        """
        Sets the forced color mode (Channel 11 or 28).

        Args:
            laser_num (int): The laser number (1 or 2).
            mode (str): 'primary', 'change_every_n'.
            value (int, optional): For 'change_every_n', the value of N.
        """
        channel = 11 if laser_num == 1 else 28

        if mode == "primary":
            self.set_channel(channel, 0)
        elif mode == "change_every_n":
            if value is None:
                print("For 'change_every_n' mode, you must specify a value for N.")
                return
            if not (1 <= value <= 255):
                print("Value for 'change_every_n' must be between 1 and 255.")
                return
            self.set_channel(channel, value)
        else:
            print("Invalid mode. Choose from 'primary', 'change_every_n'.")

    def set_strobe_flash(self, mode, value=None):
        """
        Sets the strobe/flash mode (Channel 12).

        Args:
            mode (str): 'off', 'strobe', 'random_flash', 'sound_strobe', 'sound_random_flash', 'on'.
            value (int, optional): For modes with a range, a specific value within that range.
        """
        modes = {
            "off": (0, 15),
            "strobe": (16, 131),
            "random_flash": (132, 147),
            "sound_strobe": (148, 199),
            "sound_random_flash": (200, 215),
            "on": (216, 255),
        }

        if mode not in modes:
            print(f"Invalid mode: {mode}. Choose from: {', '.join(modes.keys())}")
            return

        mode_range = modes[mode]
        if value is None:
            value = mode_range[0]
            print(
                f"Using default value {value} for {mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
        elif not (mode_range[0] <= value <= mode_range[1]):
            print(
                f"Value {value} is out of range for {mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
            return

        self.set_channel(12, value)

    def set_node_highlighting(self, laser_num, mode, value=None):
        """
        Sets the node highlighting mode (Channel 13 or 30).

        Args:
            laser_num (int): The laser number (1 or 2).
            mode (str): 'brighter', 'broken_lines', 'scanning_line'.
            value (int, optional): A specific value within the mode's range. If None,
                                   a default value will be used based on the mode.
        """
        channel = 13 if laser_num == 1 else 30

        modes = {
            "brighter": (0, 63),
            "broken_lines": (64, 127),
            "scanning_line": (
                128,
                223,
            ),  # The CSV lists 128-159, but with 224-255 reserved, it is likely a typo.
        }

        if mode not in modes:
            print(f"Invalid mode: {mode}. Choose from: {', '.join(modes.keys())}")
            return

        mode_range = modes[mode]
        if value is None:
            value = mode_range[0]
            print(
                f"Using default value {value} for {mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
        elif not (mode_range[0] <= value <= mode_range[1]):
            print(
                f"Value {value} is out of range for {mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
            return

        self.set_channel(channel, value)

    def set_node_expansion(self, laser_num, expansion_value, delay_value=None):
        """
        Sets the node expansion (Channel 14 or 31).

        Args:
            laser_num (int): The laser number (1 or 2).
            expansion_value (int): The expansion points value (0-255).
            delay_value (int, optional): The delay after full expansion (0-255).
                                          Required if CH15 is >= 128.
        """
        channel = 14 if laser_num == 1 else 31

        if not (0 <= expansion_value <= 255):
            print("Expansion value must be between 0 and 255.")
            return

        if self.get_channel_value(15 if laser_num == 1 else 32) >= 128:
            if delay_value is None:
                print("Delay value is required when CH15 is >= 128.")
                return
            if not (0 <= delay_value <= 255):
                print("Delay value must be between 0 and 255.")
                return
            self.set_channel(channel, delay_value)
        else:
            self.set_channel(channel, expansion_value)

    def set_gradual_drawing(self, laser_num, mode, manual_expansion_value=None):
        """
        Sets the gradual drawing mode (Channel 15 or 32).

        Args:
            laser_num (int): The laser number (1 or 2).
            mode (str): 'forward_manual', 'reverse_manual', 'dynamic_A', 'dynamic_B', 'dynamic_C', 'dynamic_D'.
            manual_expansion_value (int, optional):  Required for 'forward_manual' and 'reverse_manual' modes.
                                                    Must be used with channel 14.
        """
        channel = 15 if laser_num == 1 else 32

        modes = {
            "forward_manual": (0, 63),
            "reverse_manual": (64, 127),
            "dynamic_A": (128, 159),
            "dynamic_B": (160, 191),
            "dynamic_C": (192, 223),
            "dynamic_D": (224, 255),
        }

        if mode not in modes:
            print(f"Invalid mode: {mode}. Choose from: {', '.join(modes.keys())}")
            return

        mode_range = modes[mode]

        if mode in ("forward_manual", "reverse_manual"):
            if manual_expansion_value is None:
                print(f"Manual expansion value is required for '{mode}' mode.")
                return
            if not (
                0 <= manual_expansion_value <= (127 if mode == "forward_manual" else 63)
            ):
                print(f"Manual expansion value is out of range for '{mode}'.")
                return
            if laser_num == 1:
                if self.get_channel_value(14) == 0:
                    print("Must set channel 14 before using manual expansion.")
                    return
            elif laser_num == 2:
                if self.get_channel_value(31) == 0:
                    print("Must set channel 31 before using manual expansion.")
                    return

            self.set_channel(channel, manual_expansion_value)
        else:
            self.set_channel(channel, mode_range[0])

    def set_distortion_degree(self, laser_num, degree):
        """
        Sets the degree of distortion (Channel 16 or 17).

        Args:
            laser_num (int): The laser number (1 or 2, where 2 is the second picture).
            degree (int): The degree of distortion (0-255).
        """
        channel = 16 if laser_num == 1 else 17

        if not (0 <= degree <= 255):
            print("Degree of distortion must be between 0 and 255.")
            return

        self.set_channel(channel, degree)

    def set_second_lamp_pattern(self, pattern_value):
        """
        Sets the second lamp pattern (Channel 18).

        Args:
            pattern_value (int): 0 for Off, 1-255 to light up the second pattern.
        """
        if not (0 <= pattern_value <= 255):
            print("Pattern value must be between 0 and 255.")
            return

        self.set_channel(18, pattern_value)

    def set_pattern_library_selection(self, mode):
        """
        Sets the pattern library selection mode (Channel 20), though the documentation states it has no function.

        Args:
            mode (str): Currently, only 'default' is supported based on the documentation.
        """
        if mode == "default":
            self.set_channel(
                20, 0
            )  # using the beam library by default and has no function
        else:
            print("Invalid mode. Only 'default' is supported.")

    def set_horizontal_flip(self, mode, value=None):
        """
        Sets the horizontal flip mode (Channel 26).

        Args:
            mode (str): 'static', 'push_up_distortion', 'push_down_distortion', 'flip'.
            value (int, optional): A specific value within the mode's range. If None,
                                   a default value will be used based on the mode.
        """
        modes = {
            "static": (0, 127),
            "push_up_distortion": (128, 159),
            "push_down_distortion": (160, 191),
            "flip": (192, 223),
        }

        if mode not in modes:
            print(f"Invalid mode: {mode}. Choose from: {', '.join(modes.keys())}")
            return

        mode_range = modes[mode]
        if value is None:
            value = mode_range[0]
            print(
                f"Using default value {value} for {mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
        elif not (mode_range[0] <= value <= mode_range[1]):
            print(
                f"Value {value} is out of range for {mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
            return

        self.set_channel(26, value)

    def set_vertical_flip(self, mode, value=None):
        """
        Sets the vertical flip mode (Channel 27).

        Args:
            mode (str): 'static', 'right_push_distortion', 'left_push_distortion', 'flip'.
            value (int, optional): A specific value within the mode's range. If None,
                                   a default value will be used based on the mode.
        """
        modes = {
            "static": (0, 127),
            "right_push_distortion": (128, 159),
            "left_push_distortion": (160, 191),
            "flip": (192, 255),
        }

        if mode not in modes:
            print(f"Invalid mode: {mode}. Choose from: {', '.join(modes.keys())}")
            return

        mode_range = modes[mode]
        if value is None:
            value = mode_range[0]
            print(
                f"Using default value {value} for {mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
        elif not (mode_range[0] <= value <= mode_range[1]):
            print(
                f"Value {value} is out of range for {mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
            return

        self.set_channel(27, value)

    def set_color_change(self, mode, value=None):
        """
        Sets the color change mode (Channel 29).

        Args:
            mode (str): 'primary', 'white', 'red', 'yellow', 'green', 'indigo', 'blue', 'purple',
                        'rgb_cycle', 'yip_cycle', 'full_color_cycle', 'colorful_change',
                        'forward_movement', 'reverse_movement'.
            value (int, optional): A specific value within the mode's range. If None,
                                   a default value will be used based on the mode.
        """
        modes = {
            "primary": (0, 7),
            "white": (8, 15),
            "red": (16, 23),
            "yellow": (24, 31),
            "green": (32, 39),
            "indigo": (40, 47),
            "blue": (48, 55),
            "purple": (56, 63),
            "rgb_cycle": (64, 95),
            "yip_cycle": (96, 127),
            "full_color_cycle": (128, 159),
            "colorful_change": (160, 191),
            "forward_movement": (192, 223),
            "reverse_movement": (224, 255),
        }

        if mode not in modes:
            print(f"Invalid mode: {mode}. Choose from: {', '.join(modes.keys())}")
            return

        mode_range = modes[mode]
        if value is None:
            value = mode_range[0]
            print(
                f"Using default value {value} for {mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
        elif not (mode_range[0] <= value <= mode_range[1]):
            print(
                f"Value {value} is out of range for {mode} (range: {mode_range[0]}-{mode_range[1]})"
            )
            return

        self.set_channel(29, value)

    def blackout(self):
        """
        Turns off all lasers (a "blackout" function).
        """
        self.set_lamp_mode(
            "off"
        )  # Assuming 'off' mode on channel 1 turns off all lasers

    def reset_all_channels(self):
        """
        Resets all DMX channels to their default values (usually 0).
        """
        all_channels_zero = {i: 0 for i in range(1, self.num_channels + 1)}
        self.send_dmx_packet(all_channels_zero)

    def get_current_state(self):
        """
        Returns the current state of all DMX channels.

        Returns:
            list: A list representing the current values of all DMX channels (0-255).
        """
        return self.current_state
