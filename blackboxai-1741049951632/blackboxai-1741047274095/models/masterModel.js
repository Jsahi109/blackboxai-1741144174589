const db = require('../config/db');

class MasterModel {
    static async createUploadRecord({
        filename,
        original_filename,
        vendor_name,
        file_size,
        file_path,
        uploaded_by
    }) {
        try {
            const [result] = await db.execute(
                `INSERT INTO uploaded_files (
                    filename,
                    original_filename,
                    vendor_name,
                    file_size,
                    file_path,
                    uploaded_by,
                    total_records,
                    duplicates_count,
                    successful_records,
                    failed_records,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 'processing')`,
                [filename, original_filename, vendor_name, file_size, file_path, uploaded_by]
            );
            
            const [record] = await db.execute(
                'SELECT * FROM uploaded_files WHERE id = ?',
                [result.insertId]
            );
            
            return record[0];
        } catch (error) {
            console.error('Error creating upload record:', error);
            throw error;
        }
    }

    static async updateUploadRecord(id, updates) {
        try {
            const allowedFields = [
                'total_records',
                'duplicates_count',
                'successful_records',
                'failed_records',
                'status',
                'error_message',
                'headers',
                'mapping'
            ];

            const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
            if (fields.length === 0) return null;

            const setClause = fields.map(field => `${field} = ?`).join(', ');
            const values = fields.map(field => {
                if (field === 'headers' || field === 'mapping') {
                    return JSON.stringify(updates[field]);
                }
                return updates[field];
            });

            const [result] = await db.execute(
                `UPDATE uploaded_files SET ${setClause} WHERE id = ?`,
                [...values, id]
            );

            if (result.affectedRows === 0) return null;

            const [record] = await db.execute(
                'SELECT * FROM uploaded_files WHERE id = ?',
                [id]
            );

            const updatedRecord = record[0];
            if (updatedRecord.headers) {
                updatedRecord.headers = JSON.parse(updatedRecord.headers);
            }
            if (updatedRecord.mapping) {
                updatedRecord.mapping = JSON.parse(updatedRecord.mapping);
            }

            return updatedRecord;
        } catch (error) {
            console.error('Error updating upload record:', error);
            throw error;
        }
    }

    static async getTotalRecords() {
        try {
            const [totalResult] = await db.execute(
                'SELECT COUNT(*) as count FROM master'
            );
            
            const [duplicatesResult] = await db.execute(`
                SELECT COUNT(*) as count FROM (
                    SELECT phone1 FROM master WHERE phone1 IN (
                        SELECT phone1 FROM master GROUP BY phone1 HAVING COUNT(*) > 1
                    )
                ) as duplicates
            `);

            const [previousResult] = await db.execute(`
                SELECT COUNT(*) as count 
                FROM master 
                WHERE created_at < DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)
            `);

            return {
                count: totalResult[0].count,
                duplicates: duplicatesResult[0].count,
                previousCount: previousResult[0].count
            };
        } catch (error) {
            console.error('Error getting total records:', error);
            throw error;
        }
    }

    static async getVendorStats() {
        try {
            const [totalResult] = await db.execute(
                'SELECT COUNT(DISTINCT vendor_name) as count FROM master'
            );
            
            const [activeResult] = await db.execute(`
                SELECT COUNT(DISTINCT vendor_name) as count 
                FROM master 
                WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
            `);

            return {
                totalCount: totalResult[0].count,
                activeCount: activeResult[0].count
            };
        } catch (error) {
            console.error('Error getting vendor stats:', error);
            throw error;
        }
    }

    static async getGeographicDistribution(view = 'region') {
        try {
            let groupBy;
            switch (view.toLowerCase()) {
                case 'state':
                    groupBy = 'state';
                    break;
                case 'city':
                    groupBy = 'city';
                    break;
                default:
                    groupBy = 'region';
            }

            const [results] = await db.execute(`
                SELECT ${groupBy}, COUNT(*) as count 
                FROM master 
                WHERE ${groupBy} IS NOT NULL 
                GROUP BY ${groupBy} 
                ORDER BY count DESC
            `);

            return {
                labels: results.map(r => r[groupBy]),
                data: results.map(r => r.count)
            };
        } catch (error) {
            console.error('Error getting geographic distribution:', error);
            throw error;
        }
    }

    static async getVendorPerformance() {
        try {
            const [results] = await db.execute(`
                SELECT 
                    vendor_name,
                    COUNT(*) as total_records,
                    SUM(CASE 
                        WHEN phone1 IN (
                            SELECT phone1 FROM master GROUP BY phone1 HAVING COUNT(*) > 1
                        ) THEN 1
                        ELSE 0
                    END) as duplicate_count,
                    COUNT(DISTINCT CASE 
                        WHEN created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
                        THEN DATE(created_at)
                    END) as active_days
                FROM master
                GROUP BY vendor_name
                ORDER BY total_records DESC
                LIMIT 5
            `);

            return results.map(vendor => ({
                name: vendor.vendor_name,
                successRate: ((1 - (vendor.duplicate_count / vendor.total_records)) * 100).toFixed(1),
                trend: vendor.active_days > 15 ? 'up' : 'down',
                change: ((vendor.active_days / 30) * 100).toFixed(1)
            }));
        } catch (error) {
            console.error('Error getting vendor performance:', error);
            throw error;
        }
    }

    static async getUniqueVendors() {
        try {
            const [vendors] = await db.execute(`
                SELECT DISTINCT vendor_name 
                FROM master 
                WHERE vendor_name IS NOT NULL 
                ORDER BY vendor_name
            `);
            return vendors.map(v => v.vendor_name);
        } catch (error) {
            console.error('Error getting unique vendors:', error);
            throw error;
        }
    }

    static async insertMasterRecord(record, vendorName) {
        try {
            const [result] = await db.execute(
                `INSERT INTO master (
                    first_name, last_name, email, phone1, phone2, phone3, phone4,
                    address1, address2, city, state, county, region, zipcode,
                    lat, lon, vendor_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    record.first_name || null,
                    record.last_name || null,
                    record.email || null,
                    record.phone1 || null,
                    record.phone2 || null,
                    record.phone3 || null,
                    record.phone4 || null,
                    record.address1 || null,
                    record.address2 || null,
                    record.city || null,
                    record.state || null,
                    record.county || null,
                    record.region || null,
                    record.zipcode || null,
                    record.lat || null,
                    record.lon || null,
                    vendorName
                ]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error inserting master record:', error);
            throw error;
        }
    }

    static async checkDuplicatePhones(phoneNumbers) {
        try {
            if (!phoneNumbers || phoneNumbers.length === 0) {
                return [];
            }

            const placeholders = phoneNumbers.map(() => '?').join(',');
            const query = `
                SELECT DISTINCT phone_number
                FROM (
                    SELECT phone1 as phone_number FROM master WHERE phone1 IN (${placeholders})
                    UNION
                    SELECT phone2 FROM master WHERE phone2 IN (${placeholders})
                    UNION
                    SELECT phone3 FROM master WHERE phone3 IN (${placeholders})
                    UNION
                    SELECT phone4 FROM master WHERE phone4 IN (${placeholders})
                ) AS phones
                WHERE phone_number IS NOT NULL
            `;

            const params = [...phoneNumbers, ...phoneNumbers, ...phoneNumbers, ...phoneNumbers];
            const [results] = await db.execute(query, params);
            
            return results.map(row => row.phone_number);
        } catch (error) {
            console.error('Error checking duplicate phones:', error);
            throw error;
        }
    }

    static async getUploadById(id) {
        try {
            const [records] = await db.execute(
                'SELECT * FROM uploaded_files WHERE id = ?',
                [id]
            );
            
            if (records.length === 0) {
                return null;
            }

            const record = records[0];
            if (record.headers) {
                record.headers = JSON.parse(record.headers);
            }
            if (record.mapping) {
                record.mapping = JSON.parse(record.mapping);
            }
            
            return record;
        } catch (error) {
            console.error('Error getting upload by id:', error);
            throw error;
        }
    }

    static async getRecentUploads(limit = 10) {
        try {
            const [uploads] = await db.execute(
                `SELECT * FROM uploaded_files 
                ORDER BY upload_date DESC 
                LIMIT ?`,
                [limit]
            );
            
            return uploads.map(upload => ({
                ...upload,
                headers: JSON.parse(upload.headers || '[]'),
                mapping: JSON.parse(upload.mapping || '{}')
            }));
        } catch (error) {
            console.error('Error getting recent uploads:', error);
            throw error;
        }
    }

    static async getColumnNames() {
        try {
            const [columns] = await db.execute(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'master'
                AND TABLE_SCHEMA = DATABASE()
                AND COLUMN_NAME NOT IN ('id', 'created_at', 'updated_at', 'vendor_name')
                ORDER BY ORDINAL_POSITION
            `);
            return columns.map(col => col.COLUMN_NAME);
        } catch (error) {
            console.error('Error getting column names:', error);
            throw error;
        }
    }
}

module.exports = MasterModel;
