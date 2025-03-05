const db = require('../config/db');

exports.getVendorByName = async (vendorName) => {
  const [rows] = await db.execute('SELECT * FROM vendors WHERE vendor_name = ?', [vendorName]);
  return rows[0];
};

exports.createVendor = async (vendorName) => {
  await db.execute('INSERT INTO vendors (vendor_name) VALUES (?)', [vendorName]);
};
