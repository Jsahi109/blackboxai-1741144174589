const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const fs = require('fs').promises;
const db = require('./config/db');

// Import routes
const uploadRouter = require('./routes/upload');
const dashboardRouter = require('./routes/dashboard');
const downloadRouter = require('./routes/download');
const dispositionsRouter = require('./routes/dispositions');

const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Add path to all views
app.use((req, res, next) => {
    res.locals.path = req.path;
    next();
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

// Mount routes
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

app.use('/dashboard', dashboardRouter);
app.use('/upload', uploadRouter);
app.use('/download', downloadRouter);
app.use('/dispositions', dispositionsRouter);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).render('error', {
        layout: 'layouts/main',
        message: 'Something broke!',
        error: err.message || err
    });
});

// Handle 404
app.use((req, res) => {
    res.status(404).render('error', {
        layout: 'layouts/main',
        message: 'Page not found',
        error: 'The requested page does not exist'
    });
});

// Initialize database
async function initializeDatabase() {
    try {
        // Create tables if they don't exist
        await db.execute(`
            CREATE TABLE IF NOT EXISTS master (
                id INT AUTO_INCREMENT PRIMARY KEY,
                first_name VARCHAR(100) NULL,
                last_name VARCHAR(100) NULL,
                email VARCHAR(255) NULL,
                phone1 VARCHAR(20) NULL,
                phone2 VARCHAR(20) NULL,
                phone3 VARCHAR(20) NULL,
                phone4 VARCHAR(20) NULL,
                address1 VARCHAR(255) NULL,
                address2 VARCHAR(255) NULL,
                city VARCHAR(100) NULL,
                state VARCHAR(50) NULL,
                county VARCHAR(100) NULL,
                region VARCHAR(100) NULL,
                zipcode VARCHAR(20) NULL,
                lat DECIMAL(10,8) NULL,
                lon DECIMAL(11,8) NULL,
                vendor_name VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_phone1 (phone1),
                INDEX idx_phone2 (phone2),
                INDEX idx_phone3 (phone3),
                INDEX idx_phone4 (phone4),
                INDEX idx_zipcode (zipcode),
                INDEX idx_city (city),
                INDEX idx_county (county),
                INDEX idx_region (region),
                INDEX idx_vendor (vendor_name)
            )
        `);

        // Create disposition_types table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS disposition_types (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                description TEXT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Create dispositions table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS dispositions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                phone_number VARCHAR(20) NOT NULL,
                disposition_type VARCHAR(50) NOT NULL,
                notes TEXT,
                created_by VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (disposition_type) REFERENCES disposition_types(name),
                UNIQUE KEY unique_phone_disposition (phone_number)
            )
        `);

        // Create downloads_history table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS downloads_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                file_name VARCHAR(255) NOT NULL,
                record_count INT NOT NULL,
                filters JSON,
                created_by VARCHAR(100),
                download_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create uploaded_files table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS uploaded_files (
                id INT AUTO_INCREMENT PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                vendor_name VARCHAR(100) NOT NULL,
                total_records INT NOT NULL DEFAULT 0,
                duplicates_count INT NOT NULL DEFAULT 0,
                successful_records INT NOT NULL DEFAULT 0,
                failed_records INT NOT NULL DEFAULT 0,
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status ENUM('processing', 'completed', 'failed') DEFAULT 'processing',
                error_message TEXT,
                uploaded_by VARCHAR(100),
                file_path VARCHAR(255),
                original_filename VARCHAR(255),
                file_size BIGINT,
                headers JSON,
                mapping JSON,
                INDEX idx_vendor (vendor_name),
                INDEX idx_status (status),
                INDEX idx_upload_date (upload_date)
            )
        `);

        // Insert default disposition types
        await db.execute(`
            INSERT IGNORE INTO disposition_types (name, description) VALUES
            ('DNC', 'Do Not Call'),
            ('Callback', 'Contact requested callback'),
            ('Completed', 'Call completed successfully'),
            ('Disconnected', 'Phone number disconnected'),
            ('Language Barrier', 'Unable to communicate due to language'),
            ('No Answer', 'No answer after multiple attempts'),
            ('Not Interested', 'Contact not interested'),
            ('Voicemail', 'Left voicemail message'),
            ('Wrong Number', 'Incorrect phone number'),
            ('Busy', 'Line busy')
        `);

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

const PORT = process.env.PORT || 3003;

// Function to find an available port
async function startServer(initialPort) {
    let currentPort = initialPort;
    
    while (true) {
        try {
            await new Promise((resolve, reject) => {
                const server = app.listen(currentPort, async () => {
                    console.log(`Server is running on http://localhost:${currentPort}`);
                    await initializeDatabase();
                    resolve();
                }).on('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        currentPort++;
                        reject(err);
                    } else {
                        reject(err);
                    }
                });
            });
            break;
        } catch (err) {
            if (err.code !== 'EADDRINUSE') {
                throw err;
            }
            // If port is in use, the loop will continue with the next port
        }
    }
}

// Start the server
startServer(PORT).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
