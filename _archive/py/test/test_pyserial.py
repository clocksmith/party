import serial

print("Inspecting the 'serial' module...")

# Get a list of all attributes (fields, methods, classes) in the 'serial' module
attributes = dir(serial)

# Print each attribute
for attr_name in attributes:
    print(attr_name)

print(
    "\n'serial' module attributes listed. "
    "This confirms that the 'serial' module has been imported successfully."
)

# You can optionally check for specific attributes you expect to be present:
if "Serial" in attributes:
    print("\n'Serial' class found, indicating a successful pyserial import.")
if "VERSION" in attributes:
    version_tuple = getattr(serial, "VERSION")
    print(f"pyserial version detected: {'.'.join(map(str, version_tuple))}")
