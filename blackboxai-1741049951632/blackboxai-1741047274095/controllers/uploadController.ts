import * as csv from 'csv-parser';
import * as fs from 'fs';
import * as vendorModel from '../models/vendorModel';
import * as masterModel from '../models/masterModel';
import db from '../config/db';
import { Request, Response } from 'express';

export const handleUpload = async (req: Request, res: Response): Promise<void> => {
  const vendorName: string = req.body.vendorName;
  const results: any[] = [];
  const headers: string[] = [];

  // Check if the file exists
  if (!req.file) {
    res.status(400).send('No file uploaded.');
    return;
  }

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => {
      // Capture headers
      if (headers.length === 0) {
        headers.push(...Object.keys(data));
      }
      results.push(data);
    })
    .on('end', async () => {
      // Retrieve database schema
      const [columns]: any = await db.execute('SHOW COLUMNS FROM master');
      const columnNames = columns.map((col: { Field: string }) => col.Field);

      // Render mapping interface with headers and column names
      res.render('mapFields', { headers, columnNames, vendorName, results });
    })
    .on('error', (error) => {
      res.status(500).send('Error processing the file.');
    });
};
</create_file>
