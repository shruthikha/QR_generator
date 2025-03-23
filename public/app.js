document.addEventListener('DOMContentLoaded', function() {
    // Initialize file preview functionality
    initFilePreview('rcBook', 'rcBookPreview');
    initFilePreview('license', 'licensePreview');
    initFilePreview('insurance', 'insurancePreview');
    
    // Load existing drivers
    fetchDrivers();
    
    // Form submission handler
    document.getElementById('driverForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form values
        const numberPlate = document.getElementById('numberPlate').value;
        const driverName = document.getElementById('driverName').value;
        const rcBook = document.getElementById('rcBook').files[0];
        const license = document.getElementById('license').files[0];
        const insurance = document.getElementById('insurance').files[0];
        
        // Create form data for submission
        const formData = new FormData();
        formData.append('numberPlate', numberPlate);
        formData.append('driverName', driverName);
        formData.append('rcBook', rcBook);
        formData.append('license', license);
        formData.append('insurance', insurance);
        
        // Submit data to server
        fetch('/api/drivers', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Generate QR code with the ID
                generateQRCode(data.id);
                
                // Refresh drivers list
                fetchDrivers();
                
                // Reset form
                document.getElementById('driverForm').reset();
                
                // Hide previews
                document.getElementById('rcBookPreview').classList.add('d-none');
                document.getElementById('licensePreview').classList.add('d-none');
                document.getElementById('insurancePreview').classList.add('d-none');
                
                alert('Driver information saved successfully!');
            } else {
                alert('Error: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while saving the driver information.');
        });
    });
    
    // Add scan button event listener
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-scan')) {
            // Show scanner modal
            const scannerModal = new bootstrap.Modal(document.getElementById('scannerModal'));
            scannerModal.show();
            
            // Initialize QR scanner
            const html5QrCode = new Html5Qrcode("reader");
            const config = { fps: 10, qrbox: { width: 250, height: 250 } };
            
            html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
                .catch(err => {
                    console.error(`QR Code scanning failed: ${err}`);
                });
                
            function onScanSuccess(decodedText) {
                // Stop scanning
                html5QrCode.stop();
                
                // Close scanner modal
                scannerModal.hide();
                
                // Fetch driver details with the scanned ID
                fetchDriverDetails(decodedText);
            }
        }
    });
    
    // Add view button event listener
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-view')) {
            const driverId = e.target.getAttribute('data-id');
            fetchDriverDetails(driverId);
        }
    });
});

// Initialize file preview functionality
function initFilePreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    
    input.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                preview.src = e.target.result;
                preview.classList.remove('d-none');
            };
            
            reader.readAsDataURL(this.files[0]);
        }
    });
}

// Generate QR code with driver ID
function generateQRCode(driverId) {
    const qrCodeContainer = document.getElementById('qrCode');
    qrCodeContainer.innerHTML = '';
    
    const qrcode = new QRCode(qrCodeContainer, {
        text: driverId,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
    
    // Show download button
    const downloadButton = document.getElementById('downloadQR');
    downloadButton.classList.remove('d-none');
    
    // Set up download functionality
    setTimeout(() => {
        const qrImage = qrCodeContainer.querySelector('img');
        if (qrImage) {
            downloadButton.href = qrImage.src;
            downloadButton.download = `qrcode_${driverId}.png`;
        }
    }, 500);
}

// Fetch all drivers
function fetchDrivers() {
    fetch('/api/drivers')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderDriversTable(data.drivers);
            } else {
                console.error('Error fetching drivers:', data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// Render drivers table
function renderDriversTable(drivers) {
    const tableBody = document.getElementById('driversTable');
    tableBody.innerHTML = '';
    
    if (drivers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center">No drivers registered yet</td></tr>';
        return;
    }
    
    drivers.forEach(driver => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${driver.numberPlate}</td>
            <td>${driver.driverName}</td>
            <td><img src="/api/qrcode/${driver.id}" alt="QR Code" height="50"></td>
            <td>
                <button class="btn btn-sm btn-primary btn-view" data-id="${driver.id}">View Details</button>
                <button class="btn btn-sm btn-success btn-scan">Scan QR</button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Fetch driver details
function fetchDriverDetails(driverId) {
    fetch(`/api/drivers/${driverId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showDriverDetails(data.driver);
            } else {
                alert('Error: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while fetching driver details.');
        });
}

// Show driver details in modal
function showDriverDetails(driver) {
    const detailsContainer = document.getElementById('driverDetails');
    
    detailsContainer.innerHTML = `
        <div class="row mb-4">
            <div class="col-md-6">
                <h4>Driver Information</h4>
                <p><strong>Number Plate:</strong> ${driver.numberPlate}</p>
                <p><strong>Driver Name:</strong> ${driver.driverName}</p>
            </div>
            <div class="col-md-6 text-end">
                <img src="/api/qrcode/${driver.id}" alt="QR Code" height="100">
            </div>
        </div>
        
        <div class="row">
            <div class="col-md-4">
                <div class="card">
                    <div class="card-header">RC Book</div>
                    <div class="card-body text-center">
                        <img src="${driver.rcBookUrl}" alt="RC Book" class="img-fluid">
                    </div>
                </div>
            </div>
            
            <div class="col-md-4">
                <div class="card">
                    <div class="card-header">Driver's License</div>
                    <div class="card-body text-center">
                        <img src="${driver.licenseUrl}" alt="License" class="img-fluid">
                    </div>
                </div>
            </div>
            
            <div class="col-md-4">
                <div class="card">
                    <div class="card-header">Vehicle Insurance</div>
                    <div class="card-body text-center">
                        <img src="${driver.insuranceUrl}" alt="Insurance" class="img-fluid">
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Show driver modal
    const driverModal = new bootstrap.Modal(document.getElementById('driverModal'));
    driverModal.show();
}