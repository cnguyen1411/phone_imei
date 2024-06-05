const socket = io();

// Debounce function to prevent multiple rapid submissions
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

const showSpinner = () => {
  const spinner = document.getElementById('spinner');
  const overlay = document.getElementById('overlay');
  if (spinner && overlay) {
    spinner.style.display = 'block';
    overlay.style.display = 'block';
  }
};

const hideSpinner = () => {
  const spinner = document.getElementById('spinner');
  const overlay = document.getElementById('overlay');
  if (spinner && overlay) {
    spinner.style.display = 'none';
    overlay.style.display = 'none';
  }
};

const devicesPluggedIn = document.getElementById('devices-plugged-in');
const devicesInfoChecked = document.getElementById('devices-info-checked');
const submitBtn = document.getElementById('submit-btn');

if (devicesPluggedIn) {
  socket.on('devices', (devices) => {
    // Clear existing devices
    devicesPluggedIn.innerHTML = '';

    devices.forEach(device => {
      const col = document.createElement('div');
      col.className = 'col-md-12';
      col.innerHTML = `
        <div class="card mb-4 device-card" data-imei="${device.imei}">
          <div class="card-body">
            <h5 class="card-title">Device: ${device.name}</h5>
            <p class="card-text">Model: ${device.model}</p>
            <p class="card-text">IMEI: ${device.imei}</p>
            <p class="card-text">Max Capacity: ${device.maxCapacity}</p>
            <p class="card-text">Design Capacity: ${device.designCapacity}</p>
            <p class="card-text">Cycle Count: ${device.cycleCount}</p>
          </div>
        </div>
      `;
      devicesPluggedIn.appendChild(col);
    });

    const deviceCards = document.querySelectorAll('.device-card');

    deviceCards.forEach(card => {
      card.addEventListener('click', () => {
        card.classList.toggle('selected');
      });
    });
  });
}

if (submitBtn) {
  submitBtn.addEventListener('click', debounce(() => {
    const apiKey = document.getElementById('api-key').value;
    const selectedDevices = Array.from(document.querySelectorAll('.device-card.selected')).map(card => card.getAttribute('data-imei').trim());
    console.log('Selected IMEIs:', selectedDevices);

    // Show spinner
    showSpinner();

    // Send selected IMEIs and API key to the server
    if (selectedDevices.length > 0) {
      socket.emit('submit', { apiKey, selectedDevices });
    }
  }, 1000)); // 1 second debounce time
}

if (devicesInfoChecked) {
  socket.on('result', (result) => {
    console.log('Received result:', result);
    const col = document.createElement('div');
    col.className = 'col-md-12';
    
    if (result.error) {
      col.innerHTML = `
        <div class="card mb-4">
          <div class="card-body">
            <h5 class="card-title">Error</h5>
            <p class="card-text">${result.error}</p>
          </div>
        </div>
      `;
    } else {
      col.innerHTML = `
        <div class="card mb-4">
          <div class="card-body">
            <h5 class="card-title">Device: ${result.model}</h5>
            <p class="card-text"><strong>Description:</strong> ${result.description}</p>
            <p class="card-text"><strong>IMEI Number:</strong> ${result.imei}</p>
            <p class="card-text"><strong>Serial Number:</strong> ${result.serialNumber}</p>
            <p class="card-text"><strong>IMEI2 Number:</strong> ${result.imei2}</p>
            <p class="card-text"><strong>MEID Number:</strong> ${result.meid}</p>
            <p class="card-text"><strong>Loaner Device:</strong> ${result.loanerDevice}</p>
            <p class="card-text"><strong>Replaced Device:</strong> ${result.replacedDevice}</p>
            <p class="card-text"><strong>AppleCare Eligible:</strong> ${result.appleCareEligible}</p>
            <p class="card-text"><strong>Valid Purchase Date:</strong> ${result.validPurchaseDate}</p>
            <p class="card-text"><strong>Activation Status:</strong> ${result.activationStatus}</p>
            <p class="card-text"><strong>Registration Status:</strong> ${result.registrationStatus}</p>
            <p class="card-text"><strong>Warranty Status:</strong> ${result.warrantyStatus}</p>
            <p class="card-text"><strong>Estimated Purchase Date:</strong> ${result.estimatedPurchaseDate}</p>
            <p class="card-text"><strong>iCloud Lock:</strong> ${result.iCloudLock}</p>
            <p class="card-text"><strong>Blacklist Status:</strong> ${result.blacklistStatus}</p>
            <p class="card-text"><strong>Locked Carrier:</strong> ${result.lockedCarrier}</p>
            <p class="card-text"><strong>Country:</strong> ${result.country}</p>
            <p class="card-text"><strong>SIM-Lock:</strong> ${result.simLock}</p>
            <button class="btn btn-secondary mt-2 print-btn" data-imei="${result.imei}" data-description="${result.description}" data-warranty="${result.warrantyStatus}" data-icloud="${result.iCloudLock}" data-blacklist="${result.blacklistStatus}" data-simlock="${result.simLock}" data-lockedcarrier="${result.lockedCarrier}">Print</button>
          </div>
        </div>
      `;
    }

    devicesInfoChecked.appendChild(col);

    // Add event listener for the print button
    document.querySelectorAll('.print-btn').forEach(button => {
      button.addEventListener('click', () => {
        const imei = button.getAttribute('data-imei');
        const description = button.getAttribute('data-description');
        const warranty = button.getAttribute('data-warranty');
        const icloud = button.getAttribute('data-icloud');
        const blacklist = button.getAttribute('data-blacklist');
        const simlock = button.getAttribute('data-simlock');
        const lockedCarrier = button.getAttribute('data-lockedcarrier');

        const printContent = `
          <div style="width: 4in; height: 2in; font-size: 10px;">
            <p style="margin: 0;"><strong>Description:</strong> ${description}</p>
            <p style="margin: 0;"><strong>IMEI Number:</strong> ${imei}</p>
            <p style="margin: 0;"><strong>Warranty Status:</strong> ${warranty}</p>
            <p style="margin: 0;"><strong>iCloud Lock:</strong> ${icloud}</p>
            <p style="margin: 0;"><strong>Blacklist Status:</strong> ${blacklist}</p>
            <p style="margin: 0;"><strong>SIM-Lock - Locked Carrier:</strong> ${simlock} - ${lockedCarrier}</p>
            <svg id="barcode"></svg>
          </div>
        `;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <html>
            <head>
              <title>Print Label</title>
              <style>
                @page { size: 4in 2in; margin: 0; }
                body { margin: 0; }
                div { width: 4in; height: 2in; padding: 10px; font-size: 10px; }
              </style>
            </head>
            <body>
              ${printContent}
              <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
              <script>
                window.onload = function() {
                  JsBarcode("#barcode", "${imei}", {
                    format: "CODE128",
                    displayValue: true,
                    width: 2,
                    height: 30
                  });
                  window.print();
                  window.close();
                }
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      });
    });
  });

  socket.on('allResults', (results) => {
    devicesInfoChecked.innerHTML = ''; // Clear previous results

    results.forEach(result => {
      const col = document.createElement('div');
      col.className = 'col-md-12';
      
      if (result.error) {
        col.innerHTML = `
          <div class="card mb-4">
            <div class="card-body">
              <h5 class="card-title">Error</h5>
              <p class="card-text">${result.error}</p>
            </div>
          </div>
        `;
      } else {
        col.innerHTML = `
          <div class="card mb-4">
            <div class="card-body">
              <h5 class="card-title">Device: ${result.model}</h5>
              <p class="card-text"><strong>Description:</strong> ${result.description}</p>
              <p class="card-text"><strong>IMEI Number:</strong> ${result.imei}</p>
              <p class="card-text"><strong>Serial Number:</strong> ${result.serialNumber}</p>
              <p class="card-text"><strong>IMEI2 Number:</strong> ${result.imei2}</p>
              <p class="card-text"><strong>MEID Number:</strong> ${result.meid}</p>
              <p class="card-text"><strong>Loaner Device:</strong> ${result.loanerDevice}</p>
              <p class="card-text"><strong>Replaced Device:</strong> ${result.replacedDevice}</p>
              <p class="card-text"><strong>AppleCare Eligible:</strong> ${result.appleCareEligible}</p>
              <p class="card-text"><strong>Valid Purchase Date:</strong> ${result.validPurchaseDate}</p>
              <p class="card-text"><strong>Activation Status:</strong> ${result.activationStatus}</p>
              <p class="card-text"><strong>Registration Status:</strong> ${result.registrationStatus}</p>
              <p class="card-text"><strong>Warranty Status:</strong> ${result.warrantyStatus}</p>
              <p class="card-text"><strong>Estimated Purchase Date:</strong> ${result.estimatedPurchaseDate}</p>
              <p class="card-text"><strong>iCloud Lock:</strong> ${result.iCloudLock}</p>
              <p class="card-text"><strong>Blacklist Status:</strong> ${result.blacklistStatus}</p>
              <p class="card-text"><strong>Locked Carrier:</strong> ${result.lockedCarrier}</p>
              <p class="card-text"><strong>Country:</strong> ${result.country}</p>
              <p class="card-text"><strong>SIM-Lock:</strong> ${result.simLock}</p>
              <button class="btn btn-secondary mt-2 print-btn" data-imei="${result.imei}" data-description="${result.description}" data-warranty="${result.warrantyStatus}" data-icloud="${result.iCloudLock}" data-blacklist="${result.blacklistStatus}" data-simlock="${result.simLock}" data-lockedcarrier="${result.lockedCarrier}">Print</button>
            </div>
          </div>
        `;
      }

      devicesInfoChecked.appendChild(col);
    });

    // Hide spinner after processing all results
    hideSpinner();

    // Add event listeners for the print buttons
    document.querySelectorAll('.print-btn').forEach(button => {
      button.addEventListener('click', () => {
        const imei = button.getAttribute('data-imei');
        const description = button.getAttribute('data-description');
        const warranty = button.getAttribute('data-warranty');
        const icloud = button.getAttribute('data-icloud');
        const blacklist = button.getAttribute('data-blacklist');
        const simlock = button.getAttribute('data-simlock');
        const lockedCarrier = button.getAttribute('data-lockedcarrier');

        const printContent = `
          <div style="width: 4in; height: 2in; padding: 10px; font-size: 10px;">
            <p style="margin: 0;"><strong>Description:</strong> ${description}</p>
            <p style="margin: 0;"><strong>IMEI Number:</strong> ${imei}</p>
            <p style="margin: 0;"><strong>Warranty Status:</strong> ${warranty}</p>
            <p style="margin: 0;"><strong>iCloud Lock:</strong> ${icloud}</p>
            <p style="margin: 0;"><strong>Blacklist Status:</strong> ${blacklist}</p>
            <p style="margin: 0;"><strong>SIM-Lock - Locked Carrier:</strong> ${simlock} - ${lockedCarrier}</p>
            <svg id="barcode"></svg>
          </div>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <html>
            <head>
              <title>Print Label</title>
              <style>
                @page { size: 4in 2in; margin: 0; }
                body { margin: 0; }
                div { width: 4in; height: 2in; padding: 10px; font-size: 10px; }
              </style>
            </head>
            <body>
              ${printContent}
              <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
              <script>
                window.onload = function() {
                  JsBarcode("#barcode", "${imei}", {
                    format: "CODE128",
                    displayValue: true,
                    width: 2,
                    height: 30
                  });
                  window.print();
                  window.close();
                }
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      });
    });
  });
}

socket.on('error', (message) => {
  console.error('Error:', message);
  hideSpinner();
  // Optionally display the error message in the UI
});

// Trigger refresh on client-side
socket.on('refresh', () => {
  location.reload();
});
