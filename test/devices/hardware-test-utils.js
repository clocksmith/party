import { DMXSerialInterface } from '../../dmx.js';
import chalk from 'chalk';
import ora from 'ora';

const DEFAULT_PORT = '/dev/tty.usbserial-A50285BI';
const DEFAULT_CONNECTION_TIMEOUT_MS = 8000;

async function verifyHardwarePort(portPath, { verbose = false } = {}) {
    const spinner = ora('Checking serial ports...').start();
    try {
        const ports = await DMXSerialInterface.listPorts();

        if (!ports || ports.length === 0) {
            spinner.fail('No serial ports detected');
            throw new Error('No serial devices found. Connect the laser interface or run with --mock.');
        }

        const matchingPort = ports.find(port => port.path === portPath);

        if (!matchingPort) {
            spinner.fail('Configured port not found');
            const available = ports.map(port => port.path).join('\n  • ');
            throw new Error([
                `Serial port ${portPath} was not detected.`,
                'Detected ports:',
                available ? `  • ${available}` : '  • (none)',
                '',
                'Hint: pass --port=/dev/tty.xxx or run with --list-ports to inspect available devices.'
            ].join('\n'));
        }

        spinner.succeed('Serial port located');

        if (verbose) {
            const manufacturer = matchingPort.manufacturer || 'Unknown';
            const serialNumber = matchingPort.serialNumber || 'Unknown';
            console.log(chalk.gray(`Manufacturer: ${manufacturer}`));
            console.log(chalk.gray(`Serial: ${serialNumber}`));
            console.log();
        }
    } catch (error) {
        spinner.stop();
        throw error;
    }
}

async function connectWithTimeout(controller, portPath, { timeoutMs = DEFAULT_CONNECTION_TIMEOUT_MS } = {}) {
    const spinner = ora('Connecting to DMX controller...').start();
    try {
        await withTimeout(
            controller.connect(),
            timeoutMs,
            `Timed out opening ${portPath}. Check the cable connection, permissions, or use --port to select the correct device.`
        );
        spinner.succeed('DMX controller connected');
    } catch (error) {
        spinner.fail(error.message);
        if (/permission denied/i.test(error.message)) {
            console.log(chalk.yellow('Tip: macOS often requires membership in the "uucp" group or running once with sudo.'));
        }
        throw error;
    }
}

async function listAvailablePorts() {
    const spinner = ora('Listing serial ports...').start();
    try {
        const ports = await DMXSerialInterface.listPorts();
        spinner.stop();

        if (!ports || ports.length === 0) {
            console.log(chalk.yellow('No serial devices detected. Plug the controller in and try again.'));
            return;
        }

        console.log(chalk.cyan('\nDetected Serial Ports:\n'));
        console.table(ports.map(port => ({
            path: port.path,
            manufacturer: port.manufacturer || 'Unknown',
            serial: port.serialNumber || 'Unknown'
        })));

        console.log(chalk.gray('Use --port=<path> with the hardware test to pick a specific device.'));
    } catch (error) {
        spinner.fail('Unable to list serial ports');
        throw error;
    }
}

async function withTimeout(promise, ms, message) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), ms);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        clearTimeout(timeoutId);
    }
}

export {
    DEFAULT_PORT,
    DEFAULT_CONNECTION_TIMEOUT_MS,
    verifyHardwarePort,
    connectWithTimeout,
    listAvailablePorts,
    withTimeout
};
