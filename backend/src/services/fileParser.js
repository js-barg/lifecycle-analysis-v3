const fs = require('fs').promises;
const path = require('path');
const Papa = require('papaparse');
const ExcelJS = require('exceljs');
const XLSX = require('xlsx'); // SheetJS for XLSB support
const logger = require('../config/logger');

// Minimum valid date threshold - dates before this are treated as blank
// This prevents invalid Excel serial dates (like 0, 1, 2) from being interpreted as dates in 1900-1905
const MIN_VALID_DATE = new Date('1970-01-01');

// Helper function to validate and format dates
// Returns null for invalid dates (before 1970) which should be treated as blank
function formatExcelDate(value) {
  if (!value) return null;
  
  let dateObj;
  
  // If it's already a Date object
  if (value instanceof Date) {
    dateObj = value;
  } 
  // If it's a number (Excel serial date)
  else if (typeof value === 'number') {
    // Excel serial dates: days since 1900-01-01
    // Very small numbers (< 25569 which is 1970-01-01) are likely invalid
    if (value < 25569) {
      return null; // Invalid date - treat as blank
    }
    // Convert Excel serial to JavaScript Date
    dateObj = new Date((value - 25569) * 86400 * 1000);
  }
  // If it's a string, try to parse it
  else if (typeof value === 'string') {
    dateObj = new Date(value);
  }
  else {
    return null;
  }
  
  // Validate the date is reasonable (after 1970)
  if (!dateObj || isNaN(dateObj.getTime()) || dateObj < MIN_VALID_DATE) {
    return null;
  }
  
  return dateObj.toISOString().split('T')[0]; // Format as YYYY-MM-DD
}

// Parse CSV files
const parseCsv = async (filePath) => {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    
    return new Promise((resolve, reject) => {
      const results = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        trimHeaders: true,
        transformHeader: (header) => header.trim()
      });
      
      if (results.errors.length > 0) {
        console.warn('CSV parsing warnings:', results.errors);
      }
      
      resolve(results.data);
    });
  } catch (error) {
    logger.error('CSV parsing error:', error);
    throw error;
  }
};

// Parse XLSB files using SheetJS
const parseXlsb = async (filePath) => {
  try {
    console.log(`Parsing XLSB file using SheetJS: ${filePath}`);
    
    // Read the file
    const fileBuffer = await fs.readFile(filePath);
    
    // Read the workbook
    const workbook = XLSX.read(fileBuffer, { 
      type: 'buffer',
      cellDates: true,
      cellNF: false,
      cellText: false
    });
    
    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('No worksheet found in XLSB file');
    }
    
    const worksheet = workbook.Sheets[sheetName];
    console.log(`Processing sheet: ${sheetName}`);
    
    // Convert to JSON with headers
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      raw: false,
      dateNF: 'yyyy-mm-dd'
    });
    
    if (rawData.length === 0) {
      throw new Error('No data found in XLSB file');
    }
    
    // First row is headers
    const headers = rawData[0].map(h => (h ? String(h).trim() : ''));
    console.log('XLSB headers found:', headers);
    
    // Convert remaining rows to objects
    const data = [];
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.every(cell => cell === null || cell === undefined || cell === '')) {
        continue;
      }
      
      const rowData = {};
      let hasValidData = false;
      
      headers.forEach((header, idx) => {
        if (header) {
          let value = row[idx];
          
          // Handle date values
          if (value instanceof Date) {
            value = formatExcelDate(value);
          }
          else if (typeof value === 'number' && header.toLowerCase().includes('date')) {
            value = formatExcelDate(value);
          }
          
          rowData[header] = value;
          if (value !== null && value !== undefined && value !== '') {
            hasValidData = true;
          }
        }
      });
      
      if (hasValidData) {
        data.push(rowData);
      }
    }
    
    console.log(`Successfully parsed ${data.length} rows from XLSB file`);
    return data;
    
  } catch (error) {
    console.error('XLSB parsing error:', error);
    throw new Error(`Failed to parse XLSB file: ${error.message}. Please try saving as XLSX format in Excel.`);
  }
};

// Parse Excel files (XLSX/XLS) using ExcelJS - includes XLSB fallback
const parseExcel = async (filePath, fileExtension) => {
  try {
    // Use SheetJS for XLSB files
    if (fileExtension === '.xlsb') {
      return await parseXlsb(filePath);
    }
    
    const workbook = new ExcelJS.Workbook();
    
    console.log(`Parsing Excel file: ${filePath}, Extension: ${fileExtension}`);
    
    // Read the file
    await workbook.xlsx.readFile(filePath);
    
    // Debug: List all worksheets
    console.log('Worksheets found:', workbook.worksheets.length);
    workbook.eachSheet((worksheet, id) => {
      console.log(`Worksheet ${id}: ${worksheet.name}, State: ${worksheet.state}`);
    });
    
    // Try different methods to get worksheet
    let worksheet = null;
    
    // Method 1: Get first worksheet by index
    worksheet = workbook.getWorksheet(1);
    
    // Method 2: If that fails, get first worksheet from array
    if (!worksheet && workbook.worksheets.length > 0) {
      worksheet = workbook.worksheets[0];
      console.log('Using first worksheet from array');
    }
    
    // Method 3: Get first visible worksheet
    if (!worksheet) {
      workbook.eachSheet((ws) => {
        if (!worksheet && ws.state === 'visible') {
          worksheet = ws;
          console.log(`Using visible worksheet: ${ws.name}`);
        }
      });
    }
    
    // Method 4: Get any worksheet
    if (!worksheet) {
      workbook.eachSheet((ws) => {
        if (!worksheet) {
          worksheet = ws;
          console.log(`Using any worksheet: ${ws.name}`);
        }
      });
    }
    
    if (!worksheet) {
      console.error('No worksheet could be accessed');
      throw new Error('Cannot read worksheet from Excel file.');
    }
    
    // Check if worksheet has any data
    const rowCount = worksheet.rowCount;
    console.log(`Worksheet has ${rowCount} rows`);
    
    if (rowCount === 0) {
      throw new Error('Worksheet appears to be empty');
    }
    
    const data = [];
    let headers = [];
    let hasData = false;
    
    // Try to read rows
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      console.log(`Processing row ${rowNumber}`);
      
      if (rowNumber === 1) {
        // Extract headers
        headers = [];
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const value = cell.value;
          if (value) {
            headers[colNumber - 1] = String(value).trim();
          }
        });
        console.log('Headers found:', headers);
      } else {
        const rowData = {};
        let hasValidData = false;
        
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const header = headers[colNumber - 1];
          if (header) {
            let value = cell.value;
            
            // Handle different cell value types
            if (value && typeof value === 'object') {
              if (value.result !== undefined) {
                value = value.result; // Formula
                // Check if formula result is a date
                if (value instanceof Date) {
                  value = formatExcelDate(value);
                }
              } else if (value.richText) {
                value = value.richText.map(t => t.text).join(''); // Rich text
              } else if (value instanceof Date) {
                value = formatExcelDate(value);
              }
            }
            // Handle Date type
            else if (value instanceof Date) {
              value = formatExcelDate(value);
            }
            // Check if this is a date column with a number
            else if (typeof value === 'number' && header.toLowerCase().includes('date')) {
              value = formatExcelDate(value);
            }
            
            rowData[header] = value;
            if (value !== null && value !== undefined && value !== '') {
              hasValidData = true;
            }
          }
        });
        
        if (hasValidData) {
          data.push(rowData);
          hasData = true;
        }
      }
    });
    
    if (!hasData) {
      throw new Error('No data found in the Excel file');
    }
    
    console.log(`Successfully parsed ${data.length} rows from Excel file`);
    return data;
    
  } catch (error) {
    console.error('Excel parsing detailed error:', error);
    throw error;
  }
};

// Main parse function - THIS WAS MISSING!
const parseFile = async (filePath, fileExtension) => {
  try {
    const ext = fileExtension.toLowerCase();
    
    console.log(`Parsing file with extension: ${ext}`);
    
    if (ext === '.csv') {
      return await parseCsv(filePath);
    } else if (ext === '.xlsx' || ext === '.xls' || ext === '.xlsb') {
      return await parseExcel(filePath, ext);
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }
  } catch (error) {
    logger.error('File parsing error:', error);
    throw error;
  }
};

// Export all functions
module.exports = {
  parseFile,
  parseCsv,
  parseExcel,
  parseXlsb,
  formatExcelDate
};