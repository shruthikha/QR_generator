require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mysql = require("mysql2");
const { v4: uuidv4 } = require("uuid");
const QRCode = require("qrcode");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MySQL Database Connection
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  } else {
    console.log("✅ Connected to MySQL Database");
    connection.release();
  }
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) =>
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({ storage });

// Serve static files
app.use("/uploads", express.static(uploadsDir));

// API: Get all drivers
app.get("/api/drivers", (req, res) => {
  db.query(
    "SELECT id, numberPlate, driverName FROM drivers",
    (err, results) => {
      if (err) {
        console.error("❌ MySQL Error:", err);
        return res
          .status(500)
          .json({ success: false, message: "Database error" });
      }
      res.json({ success: true, drivers: results });
    }
  );
});

// API: Get driver by ID
app.get("/api/drivers/:id", (req, res) => {
  const { id } = req.params;
  db.query("SELECT * FROM drivers WHERE id = ?", [id], (err, results) => {
    if (err) {
      console.error("❌ MySQL Error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }
    if (results.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Driver not found" });
    }

    const driver = results[0];
    res.json({
      success: true,
      driver: {
        id: driver.id,
        numberPlate: driver.numberPlate,
        driverName: driver.driverName,
        rcBookUrl: `/uploads/${path.basename(driver.rcBook)}`,
        licenseUrl: `/uploads/${path.basename(driver.license)}`,
        insuranceUrl: `/uploads/${path.basename(driver.insurance)}`,
      },
    });
  });
});

// API: Add new driver
app.post(
  "/api/drivers",
  upload.fields([
    { name: "rcBook", maxCount: 1 },
    { name: "license", maxCount: 1 },
    { name: "insurance", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const { numberPlate, driverName } = req.body;
      if (!numberPlate || !driverName || !req.files) {
        return res
          .status(400)
          .json({ success: false, message: "Missing required fields" });
      }

      const id = uuidv4();
      const rcBook = req.files.rcBook[0].path;
      const license = req.files.license[0].path;
      const insurance = req.files.insurance[0].path;

      db.query(
        "INSERT INTO drivers (id, numberPlate, driverName, rcBook, license, insurance) VALUES (?, ?, ?, ?, ?, ?)",
        [id, numberPlate, driverName, rcBook, license, insurance],
        (err) => {
          if (err) {
            console.error("❌ MySQL Insert Error:", err);
            return res
              .status(500)
              .json({ success: false, message: "Failed to save driver" });
          }

          // Generate QR Code
          const qrCodePath = path.join(uploadsDir, `qr_${id}.png`);
          QRCode.toFile(qrCodePath, id, (qrErr) => {
            if (qrErr) {
              console.error("❌ QR Code Error:", qrErr);
              return res
                .status(500)
                .json({ success: false, message: "QR code generation failed" });
            }

            res.json({
              success: true,
              id,
              message: "Driver added successfully",
            });
          });
        }
      );
    } catch (error) {
      console.error("❌ Server Error:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }
);

// API: Get QR Code Image
app.get("/api/qrcode/:id", (req, res) => {
  const qrCodePath = path.join(uploadsDir, `qr_${req.params.id}.png`);

  if (fs.existsSync(qrCodePath)) {
    res.sendFile(qrCodePath);
  } else {
    QRCode.toBuffer(req.params.id, (err, buffer) => {
      if (err) {
        return res
          .status(500)
          .json({ success: false, message: "Failed to generate QR code" });
      }
      res.set("Content-Type", "image/png");
      res.send(buffer);
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Unexpected Error:", err);
  res.status(500).json({ success: false, message: "Something went wrong" });
});

// Start the server
app.listen(port, () =>
  console.log(`✅ Server running at http://localhost:${port}`)
);
