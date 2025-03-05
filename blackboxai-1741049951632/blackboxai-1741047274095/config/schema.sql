DROP TABLE IF EXISTS dispositions;
DROP TABLE IF EXISTS disposition_types;
DROP TABLE IF EXISTS downloads_history;
DROP TABLE IF EXISTS uploaded_files;
DROP TABLE IF EXISTS master;

CREATE TABLE master (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone1 VARCHAR(20),
    phone2 VARCHAR(20),
    phone3 VARCHAR(20),
    phone4 VARCHAR(20),
    address1 VARCHAR(255),
    address2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    county VARCHAR(100),
    region VARCHAR(100),
    zipcode VARCHAR(20),
    lat DECIMAL(10,8),
    lon DECIMAL(11,8),
    vendor_name VARCHAR(100),
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
);

CREATE TABLE disposition_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE dispositions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    disposition_type VARCHAR(50) NOT NULL,
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (disposition_type) REFERENCES disposition_types(name),
    UNIQUE KEY unique_phone_disposition (phone_number)
);

CREATE TABLE downloads_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    record_count INT NOT NULL,
    filters JSON,
    created_by VARCHAR(100),
    download_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE uploaded_files (
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
);

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
('Busy', 'Line busy');
