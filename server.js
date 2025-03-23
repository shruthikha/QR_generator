const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

const app = express();
const port = process.env.PORT || 8000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Setup storage for multer
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function(req, file, cb) {
        const fileExt = path.extname(file.originalname);
        cb(null, `${uuidv4()}${fileExt}`);
    }
});

const upload = multer({ storage: storage });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// In-memory database for demo purposes (use a real database for production)
const driversDB = [];

// API endpoints
// Get all drivers
app.get('/api/drivers', (req, res) => {
    res.json({
        success: true,
        drivers: driversDB.map(driver => ({
            id: driver.id,
            numberPlate: driver.numberPlate,
            driverName: driver.driverName
        }))
    });
});

// Get driver by ID
app.get('/api/drivers/:id', (req, res) => {
    const driver = driversDB.find(d => d.id === req.params.id);
    
    if (!driver) {
        return res.status(404).json({
            success: false,
            message: 'Driver not found'
        });
    }
    
    res.json({
        success: true,
        driver: {
            id: driver.id,
            numberPlate: driver.numberPlate,
            driverName: driver.driverName,
            rcBookUrl: `/uploads/${path.basename(driver.rcBook)}`,
            licenseUrl: `/uploads/${path.basename(driver.license)}`,
            insuranceUrl: `/uploads/${path.basename(driver.insurance)}`
        }
    });
});

// Create new driver
app.post('/api/drivers', upload.fields([
    { name: 'rcBook', maxCount: 1 },
    { name: 'license', maxCount: 1 },
    { name: 'insurance', maxCount: 1 }
]), (req, res) => {
    try {
        // Extract form data
        const { numberPlate, driverName } = req.body;
        
        // Validate required fields
        if (!numberPlate || !driverName || !req.files.rcBook || !req.files.license || !req.files.insurance) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }
        
        // Generate unique ID
        const id = uuidv4();
        
        // Create driver object
        const driver = {
            id,
            numberPlate,
            driverName,
            rcBook: req.files.rcBook[0].path,
            license: req.files.license[0].path,
            insurance: req.files.insurance[0].path,
            createdAt: new Date()
        };
        
        // Save driver to database
        driversDB.push(driver);
        
        // Generate QR code for the driver ID
        const qrCodePath = path.join(uploadsDir, `qr_${id}.png`);
        QRCode.toFile(qrCodePath, id, {
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
        
        // Return success response
        res.json({
            success: true,
            id: id,
            message: 'Driver information saved successfully'
        });
    } catch (error) {
        console.error('Error saving driver:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while saving driver information'
        });
    }
});

// Get QR code image
app.get('/api/qrcode/:id', (req, res) => {
    const qrCodePath = path.join(uploadsDir, `qr_${req.params.id}.png`);
    
    if (fs.existsSync(qrCodePath)) {
        res.sendFile(qrCodePath);
    } else {
        // Generate QR code on-the-fly if file doesn't exist
        QRCode.toBuffer(req.params.id, (err, buffer) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to generate QR code'
                });
            }
            
            res.set('Content-Type', 'image/png');
            res.send(buffer);
        });
    }
});

// Serve uploads
app.use('/uploads', express.static(uploadsDir));

// Serve the main HTML file for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});