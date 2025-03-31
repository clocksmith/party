import readline from 'readline';
import {
    DMXSerialInterface as DmxSerialInterface,
    DMXController as DmxController,
    LaserDeviceControl as LaserDeviceController
} from './dmx.js';

const LASER_START_ADDRESS = 1;
// Number of channels the device uses in this mode...
const LASER_NUM_CHANNELS = 32; 
const REFRESH_RATE_MS = 33;
const LOG_FILE_PATH = './dmx_received_log.txt';

// TODO: Update these with discovered Hex patterns for pattern matching
// The key is the exact space-separated HEX string received.
const DMX_PATTERNS = {
    // Example: Replace 'XX XX' with the actual hex string for the Menu button
    // '0A': '[Button: MENU]',
    // '14': '[Button: ENTER]',
    // '1E': '[Button: UP]',
    // '28': '[Button: DOWN]',
    // Add other known device responses here
};


const BUTTON_DISCOVERY_DURATION_S = 15;
const ANIMATION_DISCOVERY_DURATION_S = 15;
const MODE_ID_DURATION_S = 5;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

//\\//\\// Port Finding (Uses DMXSerialInterface static method) \\//\\//\\

function promptForPort(ports) {
     return new Promise((resolve, reject) => {
        console.log("\nAvailable Serial Ports:");
        ports.forEach((port, index) => {
            const manufacturer = port.manufacturer ? ` (${port.manufacturer})` : '';
            const pnpId = port.pnpId ? ` [${port.pnpId}]` : '';
            console.log(`  [${index + 1}] ${port.path}${manufacturer}${pnpId}`);
        });
        console.log("  [0] Cancel");
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question('Please enter the number for the DMX port: ', (answer) => {
            rl.close();
            const index = parseInt(answer, 10);
            if (isNaN(index) || index < 0 || index > ports.length) return reject(new Error("Invalid selection."));
            if (index === 0) return reject(new Error("Operation cancelled."));
            const selectedPort = ports[index - 1];
            console.log(`You selected: ${selectedPort.path}`);
            resolve(selectedPort.path);
        });
    });
}

async function findSerialPort() {
    console.log("Attempting to detect DMX serial port...");
    let ports = [];
    try {
        ports = await DmxSerialInterface.listPorts();
    } catch (listError) {
        console.error("\nError listing serial ports:", listError.message);
        throw new Error(listError.message || "Could not list serial ports.");
    }
    if (ports.length === 0) throw new Error("No serial ports detected.");

    const potentialPorts = ports.filter(port => {
        const m = port.manufacturer?.toLowerCase() || ''; const p = port.path || '';
        return m.includes('enttec') || m.includes('ftdi') || (!m && (p.includes('usbserial') || p.includes('usbmodem')));
    });

     if (potentialPorts.length === 1) { const p = potentialPorts[0].path; console.log(`\nAuto-detected DMX port: ${p}`); return p; }
    else if (potentialPorts.length > 1) { console.log(`\nMultiple potential DMX ports found:`); return await promptForPort(potentialPorts); }
    else {
        console.log(`\nCould not auto-detect DMX port. Please choose:`);
        if (ports.length === 1) { const p = ports[0].path; console.log(`Only one port found: ${p}. Using it.`); return p; }
        else return await promptForPort(ports);
    }
}

//\\//\\// Test Functions (Using LaserDeviceControl API) \\//\\//\\

async function runButtonDiscoveryTest(laserDevice) {
    console.log("\n--- Test 1: Button Discovery Mode ---");
    if (!laserDevice || !laserDevice.isConnected()) {
        console.log("Skipping test: Controller not connected."); return;
    }
    console.log(`You have ${BUTTON_DISCOVERY_DURATION_S} seconds.`);
    console.log("Press EACH physical button (MENU, ENTER, UP, DOWN) on the laser device.");
    console.log("Watch the console output (and log file) for 'RX <---' lines with HEX codes.");
    console.log("Update DMX_PATTERNS in demo.js with discovered HEX strings.");

    laserDevice.dmxController.startLogging(); // Access controller to manage logging
    console.log("--> Listening for incoming data...");
    await sleep(BUTTON_DISCOVERY_DURATION_S * 1000);
    laserDevice.dmxController.stopLogging();

    console.log(`--> Data logging stopped after ${BUTTON_DISCOVERY_DURATION_S} seconds.`);
    console.log("--- End Test 1 ---");
}

async function runAnimationDiscoveryTest(laserDevice) {
    console.log("\n--- Test 2: Animation Data Discovery Mode ---");
     if (!laserDevice || !laserDevice.isConnected()) {
        console.log("Skipping test: Controller not connected."); return;
    }
    console.log(`Starting DMX animation and listening for ${ANIMATION_DISCOVERY_DURATION_S} seconds.`);
    console.log("Standard DMX is usually one-way; expecting little/no data back from device.");

    laserDevice.dmxController.startLogging();
    console.log("--> Listening for incoming data...");

    console.log("--> Starting DMX animation (Example: RGB Cycle + Rotation)...");
    laserDevice.setLampMode('DMX_MANUAL', 100);
    laserDevice.selectGallery('BEAM');
    laserDevice.selectPattern1(15);
    laserDevice.setColorChange('RGB_CYCLE', 70);
    laserDevice.setRotation1('DYNAMIC_INVERSION_A', 60);
    await sleep(500);

    await sleep(ANIMATION_DISCOVERY_DURATION_S * 1000);

    console.log("--> Stopping DMX animation...");
    laserDevice.setLampMode('OFF');
    laserDevice.setRotation1('STATIC'); // Use STATIC mode to stop rotation
    laserDevice.setColorChange('PRIMARY'); // Use PRIMARY to stop color cycle
    await sleep(500);

    laserDevice.dmxController.stopLogging();
    console.log(`--> Data logging stopped after ${ANIMATION_DISCOVERY_DURATION_S} seconds.`);
    console.log("Check logs for any received data.");
    console.log("--- End Test 2 ---");
}

async function runModeIdentificationTest(laserDevice) {
    console.log("\n--- Test 3: Mode Identification Attempt ---");
     if (!laserDevice || !laserDevice.isConnected()) {
        console.log("Skipping test: Controller not connected."); return;
    }
    console.log("Checking if device sends consistent data when idle after DMX.");
    console.log("Resetting device channels and listening...");

    laserDevice.resetAllChannels();
    await sleep(1000);

    laserDevice.dmxController.startLogging();
    console.log("--> Listening for idle data...");
    await sleep(MODE_ID_DURATION_S * 1000);
    laserDevice.dmxController.stopLogging();

    console.log(`--> Data logging stopped after ${MODE_ID_DURATION_S} seconds.`);
    console.log("Check logs for consistent HEX patterns during idle time.");
    console.log("--- End Test 3 ---");
}

async function runBasicLampTest(laserDevice) {
    console.log("\n--- Test 4: Basic Lamp Control ---");
     if (!laserDevice || !laserDevice.isConnected()) {
        console.log("Skipping test: Controller not connected."); return;
    }
    console.log("Turning lamp ON (DMX Manual, Full)...");
    laserDevice.setLampMode('DMX_MANUAL', 100);
    await sleep(2500);

    console.log("Turning lamp OFF...");
    laserDevice.setLampMode('OFF');
    await sleep(1500);

    console.log("--- End Test 4 ---");
}

async function runElaborateControlTest(laserDevice) {
    console.log("\n--- Test 5: Elaborate DMX Control Sequence ---");
     if (!laserDevice || !laserDevice.isConnected()) {
        console.log("Skipping test: Controller not connected."); return;
    }
    console.log("Starting sequence: Lamp On -> Beam -> Dynamics -> Animation -> Off");

    console.log("  Lamp ON (Manual)"); laserDevice.setLampMode('DMX_MANUAL', 100); await sleep(1500);
    console.log("  Select Beam Gallery"); laserDevice.selectGallery('BEAM'); await sleep(500);
    console.log("  Select Pattern 10"); laserDevice.selectPattern1(10); await sleep(1500);
    console.log("  Apply Dynamic Zoom In"); laserDevice.setZoom1('DYNAMIC_ZOOM_IN', 50); await sleep(2500);
    console.log("  Apply Dynamic Rotation"); laserDevice.setRotation1('DYNAMIC_INVERSION_A', 75); await sleep(2500);
    console.log("  Change Color to Green"); laserDevice.setColorChange('GREEN', 100); await sleep(1500);
    console.log("  Change Color to RGB Cycle"); laserDevice.setColorChange('RGB_CYCLE', 50); await sleep(3000);
    console.log("  Stop Zoom & Rotation"); laserDevice.setZoom1('STATIC'); laserDevice.setRotation1('STATIC'); await sleep(1000);
    console.log("  Select Animation Gallery"); laserDevice.selectGallery('ANIMATION'); await sleep(500);
    console.log("  Select Animation Pattern 5"); laserDevice.selectPattern1(5); await sleep(2500);
    console.log("  Apply Strobe (Slow)"); laserDevice.setStrobe('STROBE', 20); await sleep(2500);
    console.log("  Stop Strobe (Solid On)"); laserDevice.setStrobe('ON'); await sleep(1000); // Use ON mode to make it solid
    console.log("  Turn Lamp OFF"); laserDevice.setLampMode('OFF'); await sleep(2000);

    console.log("--- End Test 5 ---");
}

async function runButtonEmulationTest(laserDevice) {
    console.log("\n--- Test 6: Button Emulation Test ---");
     if (!laserDevice || !laserDevice.isConnected()) {
        console.log("Skipping test: Controller not connected."); return;
    }
     console.log("!! Ensure button channels/values in dmx.js (or overrides) are correct !!");

     console.log("Pressing MENU..."); await laserDevice.pressMenu(); await sleep(1000);
     console.log("Pressing DOWN..."); await laserDevice.pressDown(); await sleep(1000);
     console.log("Pressing UP..."); await laserDevice.pressUp(); await sleep(1000);
     console.log("Pressing ENTER..."); await laserDevice.pressEnter(); await sleep(1000);

     console.log("--- End Test 6 ---");
}

//\\//\\// Main Demo \\//\\//\\

async function runDemo() {
    console.log("Starting Laser DMX Demo - Layered Architecture...");
    let selectedPortPath = '';
    let serialInterface = null;
    let dmxController = null;
    let laserDevice = null;

    // Centralized log handling
    const allLogs = [];
    const logHandler = (msg, level) => {
        // console.log(msg); // Log everything to console
        allLogs.push(msg);
    };

    try {
        selectedPortPath = await findSerialPort();
        console.log(`Using port '${selectedPortPath}'.`);

        // 1. Create Low-Level Interface
        serialInterface = new DmxSerialInterface({ portPath: selectedPortPath });
        serialInterface.on('log', logHandler);

        // 2. Create Mid-Level Controller
        dmxController = new DmxController({
            serialInterface: serialInterface,
            refreshRateMs: REFRESH_RATE_MS,
            universeSize: 512,
            logFilePath: LOG_FILE_PATH,
            patternIdentification: DMX_PATTERNS
        });

        // 3. Create High-Level Device Controller
        laserDevice = new LaserDeviceController({
            dmxController: dmxController,
            startAddress: LASER_START_ADDRESS,
            numberOfChannels: LASER_NUM_CHANNELS,
            // Optionally pass buttonConfig overrides here if needed
            // buttonConfig: { menuChannel: 511, menuValue: 11, pressDurationMs: 200 }
        });

        console.log("\nConnecting...");
        await laserDevice.connect();
        console.log("Successfully connected.");
        await sleep(1000);

        await runButtonDiscoveryTest(laserDevice);
        await sleep(2000);

        await runAnimationDiscoveryTest(laserDevice);
        await sleep(2000);

        await runModeIdentificationTest(laserDevice);
        await sleep(2000);

        await runBasicLampTest(laserDevice);
        await sleep(2000);

        await runElaborateControlTest(laserDevice);
        await sleep(2000);

        await runButtonEmulationTest(laserDevice);

        console.log("\nAll tests completed!");

    } catch (error) {
        console.error("\n--- DEMO FAILED ---");
        const errorMessage = error?.message || 'An unknown error occurred.';
        console.error(`Error: ${errorMessage}`);
        // Add specific troubleshooting hints based on common errors
        if (["Could not list serial ports.", "No serial ports detected.", "Invalid selection.", "Operation cancelled."].includes(errorMessage)) {
             console.error(`Reason: ${errorMessage}`);
        } else if (selectedPortPath && (errorMessage.toLowerCase().includes("cannot open port") || errorMessage.toLowerCase().includes("failed to open port") || errorMessage.toLowerCase().includes("permission denied"))) {
            console.error(`\nTROUBLESHOOTING (Port '${selectedPortPath}'): Check permissions, drivers, ensure port not in use, verify path, check device power/connection.`);
        } else if (errorMessage.toLowerCase().includes("baud rate") || errorMessage.toLowerCase().includes("break") || errorMessage.toLowerCase().includes("mab") || errorMessage.toLowerCase().includes("frame send")) {
            console.error(`\nTROUBLESHOOTING (DMX Timing/Send on '${selectedPortPath}'): Check adapter capability (250kbaud), ensure reliable USB connection, consider dedicated hardware if issues persist.`);
        } else if (errorMessage.toLowerCase().includes("port is not open") || errorMessage.toLowerCase().includes("port closed")) {
             console.error(`\nTROUBLESHOOTING: Port closed unexpectedly. Check device connection & power. Check for OS-level interference.`);
        } else {
            console.error("An unexpected error occurred during the demo execution.");
            console.error(error); // Log the full error object
        }

        if (allLogs.length > 0) {
            console.error("\n--- Captured Logs ---");
            allLogs.forEach(log => console.error(log));
            console.error("--- End Logs ---");
        }


    } finally {
        // Disconnect cleanly
        if (laserDevice) {
             if (laserDevice.isConnected()) {
                 console.log("\nDisconnecting...");
                 // Send blackout by default via top layer.
                 await laserDevice.disconnect();
                 console.log("Disconnected.");
             } else {
                 console.log("\nAttempting cleanup (already disconnected or connection failed)...");
                 // Disconnect lower levels directly if top didn't fully init?
                 // Or just let the top layer handle it (it calls down)
                 await laserDevice.disconnect(false);
             }
        } else if (dmxController) {
             await dmxController.disconnect(false);
        } else if (serialInterface) {
             await serialInterface.disconnect();
        }
         else {
            console.log("\nExiting (no controller instance created).");
        }
         console.log("Demo exit.");

         if (allLogs.length > 0) {
             console.log("\n--- Captured Logs (Success) ---");
             allLogs.forEach(log => console.log(log));
             console.log("--- End Logs ---");
         }
    }
}

runDemo();