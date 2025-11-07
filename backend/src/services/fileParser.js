const fs = require('fs').promises;
const path = require('path');
const Papa = require('papaparse');
const ExcelJS = require('exceljs');
const logger = require('../config/logger');

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

// Parse Excel files including XLSB
const parseExcel = async (filePath, fileExtension) => {
  try {
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
      throw new Error('Cannot read worksheet from this XLSB file. Please save as XLSX format in Excel.');
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
              } else if (value.richText) {
                value = value.richText.map(t => t.text).join(''); // Rich text
              }
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
    
    // If it's a XLSB file that failed, provide specific guidance
    if (fileExtension === '.xlsb') {
      throw new Error('XLSB file could not be processed. Please open in Excel and save as XLSX format (File → Save As → Excel Workbook).');
    }
    
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
  parseExcel
};