const db = require('../config/db');

class DispositionModel {
    static async validatePhoneNumbers(phoneNumbers) {
        try {
            // Basic phone number validation
            const validPhoneNumbers = phoneNumbers.filter(phone => {
                // Remove any non-digit characters
                const cleanPhone = phone.replace(/\D/g, '');
                // Check if it's a valid length (10-15 digits)
                return cleanPhone.length >= 10 && cleanPhone.length <= 15;
            });

            // Check if numbers exist in master table
            if (validPhoneNumbers.length > 0) {
                const placeholders = validPhoneNumbers.map(() => '?').join(',');
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

                const params = [...validPhoneNumbers, ...validPhoneNumbers, ...validPhoneNumbers, ...validPhoneNumbers];
                const [results] = await db.execute(query, params);
                
                return results.map(row => row.phone_number);
            }

            return [];
        } catch (error) {
            console.error('Error validating phone numbers:', error);
            throw error;
        }
    }

    static async addDispositions(dispositions, createdBy = 'system') {
        try {
            const values = dispositions.map(d => [d.phone_number, d.disposition_type, d.notes || null, createdBy]);
            const placeholders = values.map(() => '(?, ?, ?, ?)').join(',');
            
            const [result] = await db.execute(
                `INSERT INTO dispositions (phone_number, disposition_type, notes, created_by)
                VALUES ${placeholders}
                ON DUPLICATE KEY UPDATE
                    disposition_type = VALUES(disposition_type),
                    notes = VALUES(notes),
                    created_by = VALUES(created_by),
                    updated_at = CURRENT_TIMESTAMP`,
                values.flat()
            );
            
            return result.affectedRows;
        } catch (error) {
            console.error('Error adding dispositions:', error);
            throw error;
        }
    }

    static async getDispositionStats() {
        try {
            const [todayResult] = await db.execute(`
                SELECT COUNT(*) as count 
                FROM dispositions 
                WHERE DATE(created_at) = CURRENT_DATE
            `);

            const [yesterdayResult] = await db.execute(`
                SELECT COUNT(*) as count 
                FROM dispositions 
                WHERE DATE(created_at) = DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY)
            `);

            return {
                todayCount: todayResult[0].count,
                yesterdayCount: yesterdayResult[0].count
            };
        } catch (error) {
            console.error('Error getting disposition stats:', error);
            throw error;
        }
    }

    static async getDispositionSummary() {
        try {
            const [results] = await db.execute(`
                SELECT 
                    d.disposition_type,
                    dt.description,
                    COUNT(*) as count
                FROM dispositions d
                JOIN disposition_types dt ON d.disposition_type = dt.name
                WHERE d.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
                GROUP BY d.disposition_type, dt.description
                ORDER BY count DESC
            `);

            const total = results.reduce((sum, r) => sum + r.count, 0);

            return results.map(r => ({
                name: r.disposition_type,
                description: r.description,
                count: r.count,
                percentage: ((r.count / total) * 100).toFixed(1)
            }));
        } catch (error) {
            console.error('Error getting disposition summary:', error);
            throw error;
        }
    }

    static async getRecentDispositions(limit = 5) {
        try {
            const [dispositions] = await db.execute(`
                SELECT 
                    d.*,
                    dt.description
                FROM dispositions d
                JOIN disposition_types dt ON d.disposition_type = dt.name
                ORDER BY d.created_at DESC
                LIMIT ?
            `, [limit]);

            return dispositions;
        } catch (error) {
            console.error('Error getting recent dispositions:', error);
            throw error;
        }
    }

    static async addDisposition(phoneNumber, type, notes = null, createdBy = 'system') {
        try {
            const [result] = await db.execute(
                `INSERT INTO dispositions (
                    phone_number, disposition_type, notes, created_by
                ) VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    disposition_type = VALUES(disposition_type),
                    notes = VALUES(notes),
                    created_by = VALUES(created_by),
                    updated_at = CURRENT_TIMESTAMP`,
                [phoneNumber, type, notes, createdBy]
            );
            return result.insertId;
        } catch (error) {
            console.error('Error adding disposition:', error);
            throw error;
        }
    }

    static async getDispositionTypes() {
        try {
            const [types] = await db.execute(
                'SELECT * FROM disposition_types WHERE is_active = TRUE ORDER BY name'
            );
            return types;
        } catch (error) {
            console.error('Error getting disposition types:', error);
            throw error;
        }
    }

    static async getDispositionByPhone(phoneNumber) {
        try {
            const [dispositions] = await db.execute(
                `SELECT d.*, dt.description
                FROM dispositions d
                JOIN disposition_types dt ON d.disposition_type = dt.name
                WHERE d.phone_number = ?`,
                [phoneNumber]
            );
            return dispositions[0] || null;
        } catch (error) {
            console.error('Error getting disposition by phone:', error);
            throw error;
        }
    }

    static async deleteDisposition(phoneNumber) {
        try {
            const [result] = await db.execute(
                'DELETE FROM dispositions WHERE phone_number = ?',
                [phoneNumber]
            );
            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error deleting disposition:', error);
            throw error;
        }
    }

    static async bulkAddDispositions(dispositions, createdBy = 'system') {
        try {
            const values = dispositions.map(d => [d.phone_number, d.disposition_type, d.notes || null, createdBy]);
            const placeholders = values.map(() => '(?, ?, ?, ?)').join(',');
            
            const [result] = await db.execute(
                `INSERT INTO dispositions (phone_number, disposition_type, notes, created_by)
                VALUES ${placeholders}
                ON DUPLICATE KEY UPDATE
                    disposition_type = VALUES(disposition_type),
                    notes = VALUES(notes),
                    created_by = VALUES(created_by),
                    updated_at = CURRENT_TIMESTAMP`,
                values.flat()
            );
            
            return result.affectedRows;
        } catch (error) {
            console.error('Error bulk adding dispositions:', error);
            throw error;
        }
    }
}

module.exports = DispositionModel;
