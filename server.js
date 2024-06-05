const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const { exec } = require('child_process');
const axios = require('axios');
const usbDetect = require('usb-detection');
const os = require('os');
const fs = require('fs');
const { parseString } = require('xml2js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const historyFile = path.join(__dirname, 'history.json');
const batteryXmlDir = path.join(__dirname, 'public', 'battery_xml');

// Ensure the battery_xml directory exists
if (!fs.existsSync(batteryXmlDir)) {
  fs.mkdirSync(batteryXmlDir);
}

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Define routes
app.get('/', (req, res) => {
  res.render('index', { title: 'IMEI Reader' });
});

app.get('/history', (req, res) => {
  res.render('history', { title: 'History Check' });
});

// Function to get list of devices
const listDevices = (callback) => {
  exec('idevice_id -l', (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return callback([]);
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return callback([]);
    }
    const devices = stdout.trim().split('\n');
    callback(devices);
  });
};

// Function to get IMEI and other info of a specific device
const getDeviceInfo = (udid, callback) => {
  if (!udid) {
    console.error("No UDID provided");
    return callback(null);
  }
  const command = `ideviceinfo -u ${udid}`;
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return callback(null);
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return callback(null);
    }
    const info = {};
    stdout.split('\n').forEach(line => {
      const [key, value] = line.split(': ');
      if (key && value) {
        info[key.trim()] = value.trim();
      }
    });
    callback(info);
  });
};

// Function to get battery info of a specific device
const getBatteryInfo = (udid, imei, model, callback) => {
  let command = '';
  // Determine if the model is older or newer than iPhone 7
  const olderModels = [
    'iPhone1,1', 'iPhone1,2', 'iPhone2,1', 'iPhone3,1', 'iPhone3,2', 'iPhone3,3', 'iPhone4,1',
    'iPhone5,1', 'iPhone5,2', 'iPhone5,3', 'iPhone5,4', 'iPhone6,1', 'iPhone6,2', 'iPhone7,1', 'iPhone7,2',
    'iPhone8,1', 'iPhone8,2', 'iPhone8,4', 'iPhone9,1', 'iPhone9,2', 'iPhone9,3', 'iPhone9,4'
  ];

  if (olderModels.includes(model)) {
    command = `idevicediagnostics ioregentry AppleARMPMUCharger -u ${udid}`;
  } else {
    command = `idevicediagnostics ioregentry AppleSmartBattery -u ${udid}`;
  }

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return callback(null);
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return callback(null);
    }

    // Save the XML response to a file named after the IMEI
    const xmlFilePath = path.join(batteryXmlDir, `${imei}.xml`);
    fs.writeFileSync(xmlFilePath, stdout);

    callback(xmlFilePath);
  });
};

// Function to extract battery info from an XML file
const extractBatteryInfo = (xmlFilePath, callback) => {
  const xmlData = fs.readFileSync(xmlFilePath, 'utf-8');
  console.log("Reading XML file:", xmlFilePath);
  parseString(xmlData, (err, result) => {
    if (err) {
      console.error(`parse error: ${err}`);
      return callback(null);
    }

    //console.log("Parsed XML result:", JSON.stringify(result, null, 2));

    try {
      const dict = result.plist.dict[0].dict[0];
      const keys = dict.key;
      const values = dict.integer;

      console.log("Parsed keys:", keys);
      console.log("Parsed values:", values);

      const maxCapacityIndex = keys.indexOf('MaxCapacity');
      const designCapacityIndex = keys.indexOf('DesignCapacity');
      const cycleCountIndex = keys.indexOf('CycleCount');

      const maxCapacity = (maxCapacityIndex !== -1) ? values[maxCapacityIndex] : 'N/A';
      const designCapacity = (designCapacityIndex !== -1) ? values[designCapacityIndex] : 'N/A';
      const cycleCount = (cycleCountIndex !== -1) ? values[cycleCountIndex] : 'N/A';

      console.log("Max Capacity:", maxCapacity);
      console.log("Design Capacity:", designCapacity);
      console.log("Cycle Count:", cycleCount);

      callback({ maxCapacity, designCapacity, cycleCount });
    } catch (err) {
      console.error(`extract error: ${err}`);
      callback(null);
    }
  });
};

// Function to send updated device list to all connected clients
const updateDevices = () => {
  listDevices((devices) => {
    const deviceInfos = [];
    let processed = 0;

    if (devices.length === 0) {
      io.emit('devices', []);
      return;
    }

    devices.forEach((device) => {
      getDeviceInfo(device, (info) => {
        if (info) {
          const deviceInfo = {
            udid: device,
            imei: info.InternationalMobileEquipmentIdentity,
            name: info.DeviceName,
            model: info.ProductType,
          };
          getBatteryInfo(device, info.InternationalMobileEquipmentIdentity, info.ProductType, (xmlFilePath) => {
            extractBatteryInfo(xmlFilePath, (batteryInfo) => {
              if (batteryInfo) {
                deviceInfo.maxCapacity = batteryInfo.maxCapacity || 'N/A';
                deviceInfo.designCapacity = batteryInfo.designCapacity || 'N/A';
                deviceInfo.cycleCount = batteryInfo.cycleCount || 'N/A';
              }
              deviceInfos.push(deviceInfo);
              processed++;
              if (processed === devices.length) {
                io.emit('devices', deviceInfos);
              }
            });
          });
        } else {
          processed++;
          if (processed === devices.length) {
            io.emit('devices', deviceInfos);
          }
        }
      });
    });
  });
};

// Function to parse the API response
const parseApiResponse = (data) => {
  const parsedData = {};
  const lines = data.split('<br>');
  lines.forEach(line => {
    const [key, value] = line.split(': ');
    if (key && value) {
      parsedData[key.trim()] = value.replace(/<\/?[^>]+(>|$)/g, "").trim(); // Remove HTML tags
    }
  });
  return parsedData;
};

// Function to save history to a file
const saveHistory = (history) => {
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
};

// Function to load history from a file
const loadHistory = () => {
  if (fs.existsSync(historyFile)) {
    const historyData = fs.readFileSync(historyFile);
    return JSON.parse(historyData);
  }
  return {};
};

// Listen for socket connections
io.on('connection', (socket) => {
  updateDevices();

  socket.on('submit', async ({ apiKey, selectedDevices }) => {
    console.log('Selected IMEIs:', selectedDevices);
    console.log('API Key:', apiKey);

    const history = loadHistory();
    if (!history[apiKey]) {
      history[apiKey] = [];
    }

    const results = [];

    for (const imei of selectedDevices) {
      try {
        const trimmedImei = imei.trim(); // Trim each IMEI
        const response = await axios.get('https://sickw.com/api.php', {
          params: {
            format: 'json',
            key: apiKey,
            imei: trimmedImei,
            service: 61
          }
        });

        if (response.data.status === 'error') {
          const errorResult = {
            imei: trimmedImei,
            error: response.data.result
          };
          results.push(errorResult);
          continue;
        }

        // Parse the response
        const data = parseApiResponse(response.data.result);
        const result = {
          imei: trimmedImei,
          model: data['Model'] || 'undefined',
          description: data['Model Description'] || 'undefined',
          serialNumber: data['Serial Number'] || 'undefined',
          imei2: data['IMEI2 Number'] || 'undefined',
          meid: data['MEID'] || 'undefined',
          loanerDevice: data['Loaner Device'] || 'undefined',
          replacedDevice: data['Replaced Device'] || 'undefined',
          appleCareEligible: data['AppleCare Eligible'] || 'undefined',
          validPurchaseDate: data['Valid Purchase Date'] || 'undefined',
          activationStatus: data['Activation Status'] || 'undefined',
          registrationStatus: data['Registration Status'] || 'undefined',
          warrantyStatus: data['Warranty Status'] || 'undefined',
          estimatedPurchaseDate: data['Estimated Purchase Date'] || 'undefined',
          iCloudLock: data['iCloud Lock'] || 'undefined',
          blacklistStatus: data['Blacklist Status'] || 'undefined',
          lockedCarrier: data['Locked Carrier'] || 'undefined',
          country: data['Purchase Country'] || 'undefined',
          simLock: data['Sim-Lock Status'] || 'undefined'
        };

        // Push result to be displayed on the webpage
        results.push(result);

        // Check for duplicate before saving to history
        const isDuplicate = history[apiKey].some(item => item.imei === result.imei && item.serialNumber === result.serialNumber);

        if (!isDuplicate) {
          history[apiKey].push(result);
        }
      } catch (error) {
        console.error('Error checking IMEI:', error);
        const errorResult = {
          imei: trimmedImei,
          error: 'Error checking IMEI'
        };
        results.push(errorResult);
      }
    }

    saveHistory(history);

    socket.emit('allResults', results);
  });

  socket.on('getHistory', (apiKey) => {
    const history = loadHistory();
    if (!history[apiKey] || history[apiKey].length === 0) {
      socket.emit('historyResults', []);
    } else {
      const userHistory = history[apiKey] || [];
      socket.emit('historyResults', userHistory);
    }
  });

  socket.on('refresh', () => {
    socket.emit('refresh');
  });
});

const startMonitoring = () => {
  if (os.platform() === 'win32') {
    // Listen for USB device events on Windows
    usbDetect.startMonitoring();

    usbDetect.on('add', () => {
      console.log('Device added');
      updateDevices();
      io.emit('refresh');
    });

    usbDetect.on('remove', () => {
      console.log('Device removed');
      updateDevices();
      io.emit('refresh');
    });

    usbDetect.on('change', () => {
      console.log('Device changed');
      updateDevices();
      io.emit('refresh');
    });
  } else if (os.platform() === 'darwin') {
    // Listen for USB device events on macOS using native 'system_profiler' command
    const monitorMacDevices = () => {
      exec('system_profiler SPUSBDataType', (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }
        // Parse the output and update devices if needed
        updateDevices();
        io.emit('refresh');
      });
    };

    // Initial call to monitor devices
    monitorMacDevices();

    // Set an interval to periodically check for USB device changes
    setInterval(monitorMacDevices, 5000); // Check every 5 seconds
  }
};

startMonitoring();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
