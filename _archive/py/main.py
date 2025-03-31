from py.controller import DmxController
import sys
import time


def main():
    """
    Main function to demonstrate DMX512LaserController.
    """

    print(sys.path)

    # Create a DMX controller instance.
    # If you know the specific port, you can provide it as an argument:
    # laser_controller = DMX512LaserController(port='/dev/tty.usbmodem14201')
    laser_controller = DmxController()

    if not laser_controller.serial_port:
        print("Could not connect to a DMX device. Exiting")
        return

    try:
        # --- Example Usage ---

        # Turn the lamp on to dynamic sound control mode
        print("Setting lamp mode to dynamic sound control...")
        laser_controller.set_lamp_mode("dynamic_sound")
        time.sleep(2)

        # Select the Animation gallery
        print("Selecting Animation gallery...")
        laser_controller.select_gallery(1)  # 1 for Animation
        time.sleep(2)

        # Select pattern number 5 (assuming you know this pattern exists)
        print("Selecting pattern 5...")
        laser_controller.select_pattern(1, 5)  # Laser 1, Pattern 5
        time.sleep(2)

        # Set pattern size to 'crossing' with a specific value
        print("Setting pattern size to 'crossing' with value 175...")
        laser_controller.set_pattern_size(1, "crossing", 175)  # Laser 1
        time.sleep(2)

        # Set pattern zooming to 'zoom_in'
        print("Setting pattern zooming to 'zoom_in'...")
        laser_controller.set_pattern_zooming(1, "zoom_in")
        time.sleep(2)

        # Set pattern rotation to 'dynamic_inversion'
        print("Setting pattern rotation to 'dynamic inversion'...")
        laser_controller.set_pattern_rotation(1, "dynamic_inversion")
        time.sleep(2)

        # Set pattern horizontal movement to 'left_shift'
        print("Setting pattern horizontal movement to 'left_shift'...")
        laser_controller.set_horizontal_movement(1, "left_shift")
        time.sleep(2)

        # Set pattern vertical movement to 'move_up'
        print("Setting pattern vertical movement to 'move_up'...")
        laser_controller.set_vertical_movement(1, "move_up")
        time.sleep(2)

        # Add more commands here to control other features...

    except KeyboardInterrupt:
        print("Exiting program...")

    finally:
        # Ensure the connection is closed properly
        laser_controller.disconnect()


if __name__ == "__main__":
    main()
