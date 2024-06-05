document.getElementById('check-history-btn').addEventListener('click', () => {
    const apiKey = document.getElementById('api-key').value;
    socket.emit('getHistory', apiKey);
  });
  
  socket.on('historyResults', (history) => {
    const historyResults = document.getElementById('history-results');
    const notificationArea = document.getElementById('history-notification-area');
    historyResults.innerHTML = '';
  
    if (history.length === 0) {
      notificationArea.textContent = 'No history found for this API key.';
      notificationArea.style.display = 'block';
      return;
    } else {
      notificationArea.style.display = 'none';
    }
  
    history.forEach(item => {
      const col = document.createElement('div');
      col.className = 'col-md-12';
      col.innerHTML = `
        <div class="card mb-4">
          <div class="card-body">
            <h5 class="card-title">Device: ${item.model}</h5>
            <p class="card-text"><strong>Description:</strong> ${item.description}</p>
            <p class="card-text"><strong>IMEI Number:</strong> ${item.imei}</p>
            <p class="card-text"><strong>Serial Number:</strong> ${item.serialNumber}</p>
            <p class="card-text"><strong>IMEI2 Number:</strong> ${item.imei2}</p>
            <p class="card-text"><strong>MEID Number:</strong> ${item.meid}</p>
            <p class="card-text"><strong>Loaner Device:</strong> ${item.loanerDevice}</p>
            <p class="card-text"><strong>Replaced Device:</strong> ${item.replacedDevice}</p>
            <p class="card-text"><strong>AppleCare Eligible:</strong> ${item.appleCareEligible}</p>
            <p class="card-text"><strong>Valid Purchase Date:</strong> ${item.validPurchaseDate}</p>
            <p class="card-text"><strong>Activation Status:</strong> ${item.activationStatus}</p>
            <p class="card-text"><strong>Registration Status:</strong> ${item.registrationStatus}</p>
            <p class="card-text"><strong>Warranty Status:</strong> ${item.warrantyStatus}</p>
            <p class="card-text"><strong>Estimated Purchase Date:</strong> ${item.estimatedPurchaseDate}</p>
            <p class="card-text"><strong>iCloud Lock:</strong> ${item.iCloudLock}</p>
            <p class="card-text"><strong>Blacklist Status:</strong> ${item.blacklistStatus}</p>
            <p class="card-text"><strong>Locked Carrier:</strong> ${item.lockedCarrier}</p>
            <p class="card-text"><strong>Country:</strong> ${item.country}</p>
            <p class="card-text"><strong>SIM-Lock:</strong> ${item.simLock}</p>
            <button class="btn btn-secondary mt-2 print-btn" data-imei="${item.imei}" data-description="${item.description}" data-warranty="${item.warrantyStatus}" data-icloud="${item.iCloudLock}" data-blacklist="${item.blacklistStatus}" data-simlock="${item.simLock}" data-lockedcarrier="${item.lockedCarrier}">Print</button>
          </div>
        </div>
      `;
      historyResults.appendChild(col);
    });
  
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
  