// backend/src/controllers/uploadController.js
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Papa = require('papaparse');
const ExcelJS = require('exceljs');
const jobStorage = require('../utils/jobStorage');
const phase1FilterService = require('../services/phase1FilterService');
const fs = require('fs');

// Import columnMapper - if this doesn't exist, the normalization functions are included below
let processData;
try {
  const columnMapper = require('../utils/columnMapper');
  processData = columnMapper.processData;
} catch (error) {
  console.log('Column mapper not found, using built-in processing');
  // Built-in normalization if columnMapper doesn't exist
  processData = (data) => {
    return data.map((row, index) => {
      const normalizeSupport = (value) => {
        // Handle null/undefined/empty
        if (!value || value === '' || value === null || value === undefined) {
          return 'Expired';
        }
        
        // Convert to string and clean up
        const strValue = value.toString().trim();
        const upperValue = strValue.toUpperCase();
        
        // Handle placeholder values
        if (strValue === '-' || strValue === '.' || strValue === '?' || strValue === '0' || strValue === '') {
          return 'Expired';
        }
        
        // ONLY these values mean Active
        if (upperValue === 'ACTIVE' || upperValue === 'COVERED') {
          return 'Active';
        }
        
        // EVERYTHING ELSE is Expired
        return 'Expired';
      };

      // Debug the raw quantity value
      const rawQty = row['Item Quantity'];
      if (index < 3) {
        console.log(`DEBUG Row ${index + 1}: Raw 'Item Quantity' = ${rawQty}, type = ${typeof rawQty}`);
      }

      const normalizedItem = {
        id: index + 1,
        mfg: row.mfg || row.Manufacturer || row.manufacturer || row.vendor || '-',
        category: row.category || row['Business Entity'] || row.business_entity || '-',
        asset_type: row.asset_type || row['Asset Type'] || row.AssetType || '-',
        type: row.type || row.Type || row['Product Type'] || '-',
        product_id: row.product_id || row['Product ID'] || row.productid || row.pid || '-',
        description: row.description || row['Product Description'] || row.product_description || '-',
        ship_date: row.ship_date || row['Ship Date'] || row.ShipDate || row.ship_dt || '-',
        qty: parseInt(row['Item Quantity']) || parseInt(row.qty) || parseInt(row.Qty) || parseInt(row.quantity) || parseInt(row.Quantity) || 0,
        total_value: parseFloat(row.total_value || row['Total Value'] || row.totalvalue || row.value || 0) || 0,
        support_coverage: (() => {
          const coveredLineStatus = row['Covered Line Status'];
          const coverage = row.Coverage;
          
          // Try Covered Line Status FIRST (exact case match)
          if (coveredLineStatus) {
            return normalizeSupport(coveredLineStatus);
          }
          
          // Then try Coverage
          if (coverage) {
            return normalizeSupport(coverage);
          }
          
          // Default to Expired if no coverage columns found
          return 'Expired';
        })(),
        end_of_sale: row['End of Product Sale Date'] || row['End of Product Sale'] || row.end_of_sale || row.end_of_product_sale || '-',
        last_day_support: row['Last Date of Support'] || row.last_day_support || row.last_date_of_support || row['Last Support'] || '-'
      };

      // Debug the normalized quantity
      if (index < 3) {
        console.log(`  -> Normalized qty = ${normalizedItem.qty}`);
      }

      return normalizedItem;
    });
  };
}

// Store uploads in memory for processing
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xlsb', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Parse Excel file
async function parseExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const worksheet = workbook.worksheets[0]; // Get first worksheet
  if (!worksheet) {
    throw new Error('No worksheet found in Excel file');
  }
  
  const data = [];
  const headers = [];
  
  // Get headers from first row
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = cell.value ? cell.value.toString() : '';
  });
  
  console.log('Excel headers found:', headers);
  
  // Process data rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) { // Skip header row
      const rowData = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          // Handle different cell types
          let value = cell.value;
          if (cell.type === ExcelJS.ValueType.Date) {
            value = cell.value.toISOString().split('T')[0]; // Format date as YYYY-MM-DD
          } else if (cell.type === ExcelJS.ValueType.RichText) {
            value = cell.value.richText.map(rt => rt.text).join('');
          } else if (typeof value === 'object' && value !== null) {
            value = value.toString();
          }
          rowData[header] = value;
        }
      });
      if (Object.keys(rowData).length > 0) {
        data.push(rowData);
      }
    }
  });
  
  return data;
}

// Upload handler
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const jobId = uuidv4();
    const { customerName } = req.body;
    
    console.log('Processing file:', req.file.originalname);
    console.log('Customer:', customerName);
    console.log('File size:', req.file.size, 'bytes');
    
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    let parsedData = [];
    
    try {
      if (fileExt === '.csv') {
        // Parse CSV file
        const fileContent = req.file.buffer.toString('utf8');
        const results = await new Promise((resolve, reject) => {
          Papa.parse(fileContent, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data),
            error: (error) => reject(error)
          });
        });
        parsedData = results;
        console.log('CSV parsed rows:', parsedData.length);
        
      } else if (fileExt === '.xlsx' || fileExt === '.xlsb' || fileExt === '.xls') {
        // Parse Excel file
        parsedData = await parseExcel(req.file.buffer);
        console.log('Excel parsed rows:', parsedData.length);
      } else {
        return res.status(400).json({ error: 'Unsupported file type' });
      }
      
      // Debug column structure
      console.log('\nðŸ” CRITICAL DEBUG - RAW FILE STRUCTURE:');
      if (parsedData.length > 0) {
        console.log('Column names found:', Object.keys(parsedData[0]));
        console.log('\nFirst 3 rows RAW DATA:');
        parsedData.slice(0, 3).forEach((row, idx) => {
          console.log(`\nRow ${idx + 1}:`);
          Object.keys(row).forEach(key => {
            console.log(`  "${key}": "${row[key]}"`);
          });
        });
      }
      console.log('================================\n');

      // Process data with column mapper
      let normalizedData = processData(parsedData);
      const originalCount = normalizedData.length;

      // Apply Phase 1 filters if specified
      const { filterSetId } = req.body;
      let filterStats = null;
      let appliedFilter = null;
      
      // Replace lines 220-249 in your uploadController.js with this SIMPLE, DIRECT filtering:

      if (filterSetId && filterSetId !== 'no-filter') {
        const filterSet = await phase1FilterService.getFilterSet(filterSetId);
        if (filterSet) {
          console.log(`\nApplying Phase 1 filter: ${filterSet.name}`);
          // const originalCount = normalizedData.length;
          
          // SIMPLE DIRECT FILTERING - NO COMPLEX LOGIC
          normalizedData = normalizedData.filter(item => {
            const productId = (item.product_id || '').toUpperCase();
            const description = (item.description || '').toUpperCase();
            const type = (item.type || '').toUpperCase();
            
            // Check if product ID contains any excluded patterns
            if (productId !== '-' && productId !== '') {
              // Direct checks for power supplies, cables, fans, etc.
              if (productId.includes('PWR')) return false;  // Remove power supplies
              if (productId.includes('POWER')) return false;  // Remove power supplies
              if (productId.includes('FAN')) return false;  // Remove fans
              if (productId.includes('CAB-')) return false;  // Remove cables
              if (productId.includes('CABLE')) return false;  // Remove cables
              if (productId.includes('MEM-')) return false;  // Remove memory
              if (productId.includes('BRACKET')) return false;  // Remove brackets
              if (productId.includes('SCREW')) return false;  // Remove screws
              if (productId.includes('RAIL')) return false;  // Remove rails
              if (productId.includes('NUT')) return false;  // Remove nuts/bolts
            }
            
            // Check descriptions
            if (description !== '-' && description !== '') {
              if (description.includes('POWER SUPPLY')) return false;
              if (description.includes('POWER CORD')) return false;
              if (description.includes('FAN MODULE')) return false;
              if (description.includes('FAN TRAY')) return false;
              if (description.includes('CABLE')) return false;
              if (description.includes('BRACKET')) return false;
              if (description.includes('MEMORY')) return false;
              if (description.includes('RAM')) return false;
              if (description.includes('MOUNTING')) return false;
              if (description.includes('ACCESSORY KIT')) return false;
              if (description.includes('RAIL KIT')) return false;
            }
            
            // Check product types
            const excludedTypes = ['SERVICE', 'SOFTWARE', 'LICENSE', 'ACCESSORY', 'CABLE', 'MEMORY', 'POWER SUPPLY', 'FAN', 'DOCUMENTATION'];
            if (excludedTypes.includes(type)) return false;
            
            // Keep this item (it didn't match any exclusion)
            return true;
          });
          
          // Re-index after filtering
          normalizedData = normalizedData.map((item, index) => ({
            ...item,
            id: index + 1
          }));
          
          const excludedCount = originalCount - normalizedData.length;
          
          // Show what was excluded
          console.log(`Filter applied: ${originalCount} items -> ${normalizedData.length} items (${excludedCount} excluded)`);
          
          // Log first few remaining product IDs to verify
          console.log('First 10 items AFTER filtering:');
          normalizedData.slice(0, 10).forEach(item => {
            console.log(`  ${item.product_id} - Type: ${item.type}`);
          });
          
          // Check if any PWR/CAB/FAN items remain
          const problemItems = normalizedData.filter(item => {
            const pid = (item.product_id || '').toUpperCase();
            return pid.includes('PWR') || pid.includes('CAB-') || pid.includes('FAN');
          });
          
          if (problemItems.length > 0) {
            console.log(`WARNING: ${problemItems.length} PWR/CAB/FAN items still present!`);
            problemItems.forEach(item => {
              console.log(`  - ${item.product_id}`);
            });
          } else {
            console.log('SUCCESS: No PWR/CAB/FAN items remain');
          }
          
          appliedFilter = {
            id: filterSet.id,
            name: filterSet.name,
            description: filterSet.description
          };
          
          filterStats = {
            originalCount,
            filteredCount: normalizedData.length,
            excludedCount,
            excludedPercentage: ((excludedCount / originalCount) * 100).toFixed(1),
            excluded: {
              byProductId: 0,
              byDescription: 0,
              byType: 0
            }
          };
        }
      }
      
      // Debug quantity processing
      console.log('\n========== RAW DATA QUANTITY CHECK ==========');
      if (parsedData.length > 0) {
        const firstRow = parsedData[0];
        const qtyRelatedColumns = Object.keys(firstRow).filter(key => 
          key.toLowerCase().includes('qty') || 
          key.toLowerCase().includes('quant') ||
          key.toLowerCase().includes('item')
        );
        console.log('Quantity-related columns found:', qtyRelatedColumns);
      }
      
      const nonZero = normalizedData.filter(item => item.qty > 0).length;
      console.log(`Items with qty > 0: ${nonZero} out of ${normalizedData.length}`);
      console.log('==============================================\n');

      // Debug support coverage mapping
      console.log('Support coverage distribution:', normalizedData.reduce((acc, item) => {
        acc[item.support_coverage] = (acc[item.support_coverage] || 0) + 1;
        return acc;
      }, {}));

      // Calculate analytics
      const totalRecords = normalizedData.length;
      const totalQuantity = normalizedData.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
      const activeSupport = normalizedData.filter(item => item.support_coverage === 'Active').length;
      const expiredSupport = normalizedData.filter(item => item.support_coverage === 'Expired').length;
      
      // Calculate End of Sale, SW Vulnerability, and Last Day Support counts
      const currentDate = new Date();
      const totalEndOfSale = normalizedData.filter(item => {
        if (!item.end_of_sale || item.end_of_sale === '-') return false;
        try {
          const eosDate = new Date(item.end_of_sale);
          return !isNaN(eosDate.getTime()) && eosDate <= currentDate;
        } catch (e) {
          return false;
        }
      }).length;
      
      const totalEndOfSWVuln = normalizedData.filter(item => {
        const vulnField = item['End of Vulnerability/Security Support'] || 
                         item.end_of_vulnerability_support || 
                         item['End of Security Support'] || '-';
        if (!vulnField || vulnField === '-') return false;
        try {
          const vulnDate = new Date(vulnField);
          return !isNaN(vulnDate.getTime()) && vulnDate <= currentDate;
        } catch (e) {
          return false;
        }
      }).length;
      
      const totalLastDaySupport = normalizedData.filter(item => {
        if (!item.last_day_support || item.last_day_support === '-') return false;
        try {
          const ldosDate = new Date(item.last_day_support);
          return !isNaN(ldosDate.getTime()) && ldosDate <= currentDate;
        } catch (e) {
          return false;
        }
      }).length;
      
      // Manufacturer Breakdown
      const manufacturerBreakdown = {};
      normalizedData.forEach(item => {
        const mfg = item.mfg && item.mfg !== '-' ? item.mfg : 'Unknown';
        if (!manufacturerBreakdown[mfg]) {
          manufacturerBreakdown[mfg] = {
            count: 0,
            quantity: 0,
            activeCount: 0,
            expiredCount: 0
          };
        }
        manufacturerBreakdown[mfg].count++;
        manufacturerBreakdown[mfg].quantity += parseInt(item.qty) || 0;
        
        if (item.support_coverage === 'Active') {
          manufacturerBreakdown[mfg].activeCount++;
        } else if (item.support_coverage === 'Expired') {
          manufacturerBreakdown[mfg].expiredCount++;
        }
      });
      
      // Category Breakdown
      const categoryBreakdown = {};
      normalizedData.forEach(item => {
        const cat = item.category || 'Uncategorized';
        if (!categoryBreakdown[cat]) {
          categoryBreakdown[cat] = { 
            count: 0,
            quantity: 0,
            activeCount: 0,
            expiredCount: 0
          };
        }
        categoryBreakdown[cat].count++;
        categoryBreakdown[cat].quantity += parseInt(item.qty) || 0;
        
        if (item.support_coverage === 'Active') {
          categoryBreakdown[cat].activeCount++;
        } else if (item.support_coverage === 'Expired') {
          categoryBreakdown[cat].expiredCount++;
        }
      });
      
      // Data Completeness
      const requiredFields = [
        'mfg', 
        'category', 
        'product_id', 
        'description', 
        'support_coverage', 
        'end_of_sale', 
        'last_day_support', 
        'asset_type', 
        'ship_date'
      ];
      
      const fieldCompleteness = {};
      requiredFields.forEach(field => {
        const filled = normalizedData.filter(item => 
          item[field] && 
          item[field] !== '-' && 
          item[field] !== '' &&
          item[field] !== 'N/A'
        ).length;
        fieldCompleteness[field] = Math.round((filled / normalizedData.length) * 100);
      });
      
      // Lifecycle Status by Category
      const lifecycleByCategory = {};
      Object.keys(categoryBreakdown).forEach(category => {
        const categoryItems = normalizedData.filter(item => 
          (item.category || 'Uncategorized') === category
        );
        
        let totalQty = 0;
        let endOfSaleCount = 0;
        let endOfSWVulnCount = 0;
        let lastDaySupportCount = 0;
        
        categoryItems.forEach(item => {
          totalQty += parseInt(item.qty) || 0;
          
          if (item.end_of_sale && item.end_of_sale !== '-') {
            try {
              const eosDate = new Date(item.end_of_sale);
              if (!isNaN(eosDate.getTime()) && eosDate <= currentDate) {
                endOfSaleCount++;
              }
            } catch (e) {}
          }
          
          const vulnField = item['End of Vulnerability/Security Support'] || 
                           item.end_of_vulnerability_support || 
                           item['End of Security Support'] || '-';
          if (vulnField && vulnField !== '-') {
            try {
              const vulnDate = new Date(vulnField);
              if (!isNaN(vulnDate.getTime()) && vulnDate <= currentDate) {
                endOfSWVulnCount++;
              }
            } catch (e) {}
          }
          
          if (item.last_day_support && item.last_day_support !== '-') {
            try {
              const ldosDate = new Date(item.last_day_support);
              if (!isNaN(ldosDate.getTime()) && ldosDate <= currentDate) {
                lastDaySupportCount++;
              }
            } catch (e) {}
          }
        });
        
        lifecycleByCategory[category] = {
          totalQty,
          endOfSale: endOfSaleCount,
          endOfSWVuln: endOfSWVulnCount,
          lastDaySupport: lastDaySupportCount,
          total: categoryItems.length
        };
      });
      
      // Create summary
      const uniqueCategories = [...new Set(normalizedData.map(item => item.category || 'Uncategorized'))];
      const totalCategories = uniqueCategories.length;
      const totalServiceContracts = activeSupport;
      const totalManufacturers = [...new Set(normalizedData.map(item => item.mfg).filter(m => m && m !== '-'))].length;
            // Add this BEFORE the exclusions are loaded
      const originalItemCount = normalizedData.length;
      const summary = {
        total_items: totalRecords,
        original_items: originalItemCount,  // <-- Add this
        filtered_items: totalRecords,       // <-- Add this (totalRecords is after filtering)
        items_excluded: originalItemCount - totalRecords,  // <-- Add this
        total_quantity: totalQuantity,
        total_value: 0,
        total_manufacturers: totalManufacturers,
        active_support: activeSupport,
        expired_support: expiredSupport,
        total_categories: totalCategories,
        total_service_contracts: totalServiceContracts,
        total_end_of_sale: totalEndOfSale,
        total_end_of_sw_vuln: totalEndOfSWVuln,
        total_last_day_support: totalLastDaySupport,
        totalRecords,
        supportCoverage: totalRecords > 0 ? Math.round((activeSupport / totalRecords) * 100) : 0,
        categoryBreakdown,
        manufacturerBreakdown,
        fieldCompleteness,
        lifecycleByCategory,
        // Add filter information
        appliedFilter,
        filterStats
      };
      
      // Right before storing job data
      console.log('STORING DATA - First 5 items:');
      normalizedData.slice(0, 5).forEach(item => {
        console.log(`  ${item.product_id}`);
      });



      // LOAD EXCLUSIONS FROM FILE
      let exclusions = {
        productIdPatterns: [],
        descriptionKeywords: [],
        productTypes: []
      };
      
      try {
        const exclusionsPath = path.join(__dirname, '../../data/exclusions.json');
        const exclusionsData = fs.readFileSync(exclusionsPath, 'utf8');
        const loadedExclusions = JSON.parse(exclusionsData);
        exclusions = loadedExclusions.exclusions || exclusions;
        console.log('Loaded exclusions from file');
        console.log(`  - ${exclusions.productIdPatterns.length} product ID patterns`);
        console.log(`  - ${exclusions.descriptionKeywords.length} description keywords`);
        console.log(`  - ${exclusions.productTypes.length} product types`);
      } catch (error) {
        console.log('No exclusions file found, using defaults');
        // Fallback to basic exclusions if file doesn't exist
        exclusions = {
          productIdPatterns: ['PWR', 'CAB', 'FAN', 'CON-', 'LIC-'],
          descriptionKeywords: ['POWER SUPPLY', 'CABLE', 'LICENSE', 'SERVICE'],
          productTypes: ['SERVICE', 'SOFTWARE', 'LICENSE']
        };
      }
      
      normalizedData = normalizedData.filter(item => {
        const pid = (item.product_id || '').toUpperCase();
        const desc = (item.description || '').toUpperCase();
        const type = (item.type || '').toUpperCase();
        
        // Skip empty values
        if (pid === '-' || pid === '') {
          // Don't check product ID patterns for empty values
        } else {
          // Check product ID against all patterns
          for (const pattern of exclusions.productIdPatterns) {
            if (pid.includes(pattern.toUpperCase())) {
              console.log(`  Excluding by Product ID: ${item.product_id} (matched pattern: ${pattern})`);
              return false;
            }
          }
        }
        
        // Check description against all keywords
        if (desc !== '-' && desc !== '') {
          for (const keyword of exclusions.descriptionKeywords) {
            if (desc.includes(keyword.toUpperCase())) {
              console.log(`  Excluding by Description: ${item.product_id} (matched keyword: ${keyword})`);
              return false;
            }
          }
        }
        
        // Check type against excluded types
        for (const excludedType of exclusions.productTypes) {
          if (type === excludedType.toUpperCase()) {
            console.log(`  Excluding by Type: ${item.product_id} (type: ${item.type})`);
            return false;
          }
        }
        
        return true; // Keep this item
      });
      
      // Re-index after filtering
      normalizedData = normalizedData.map((item, index) => ({
        ...item,
        id: index + 1
      }));
      
      const excludedByFile = originalItemCount - normalizedData.length;
      console.log(`\nExclusions applied: ${originalItemCount} → ${normalizedData.length} items`);
      console.log(`Removed ${excludedByFile} items based on exclusions file\n`);
      console.log(`FINAL COUNT BEFORE STORAGE: ${normalizedData.length} items`);

      // Update summary with actual filtered counts
      summary.filtered_items = normalizedData.length;
      summary.items_excluded = originalItemCount - normalizedData.length;

      // Also update total_items to reflect filtered count
      summary.total_items = normalizedData.length;

      // Update other counts that depend on filtered data
      summary.active_support = normalizedData.filter(item => item.support_coverage === 'Active').length;
      summary.expired_support = normalizedData.filter(item => item.support_coverage === 'Expired').length;

      // Store job data using shared jobStorage
      const jobData = {
        jobId,
        customerName: customerName || 'Unknown',
        filename: req.file.originalname,
        status: 'completed',
        data: normalizedData,
        summary,
        analytics: {
          categories: categoryBreakdown,
          manufacturerBreakdown,
          completeness: fieldCompleteness,
          lifecycle: lifecycleByCategory,
          totalCategories,
          totalServiceContracts,
          totalEndOfSale,
          totalEndOfSWVuln,
          totalLastDaySupport
        },
        timestamp: new Date(),
        rows_processed: normalizedData.length
      };
      
      jobStorage.set(jobId, jobData);
      
      console.log('Job stored with ID:', jobId);
      console.log('Summary:', summary);
      
      res.json({
        job_id: jobId,
        status: 'processing',
        rows_uploaded: normalizedData.length,
        message: 'File uploaded successfully'
      });
      
    } catch (parseError) {
      console.error('File parsing error:', parseError);
      res.status(500).json({ 
        error: 'Failed to parse file', 
        details: parseError.message,
        fileType: fileExt
      });
    }
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Status handler
const getJobStatus = async (req, res) => {
  const { jobId } = req.params;
  const job = jobStorage.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json({
    status: job.status,
    job_id: jobId,
    customer_name: job.customerName,
    filename: job.filename,
    rows_processed: job.rows_processed,
    timestamp: job.timestamp,
    results: {
      findings: [
        `Processed ${job.rows_processed} items`,
        `${job.summary.active_support} items with active support`,
        `${job.summary.expired_support} items with expired support`
      ]
    }
  });
};

// Results handler
const getResults = async (req, res) => {
  const { jobId } = req.params;
  const job = jobStorage.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  const limit = parseInt(req.query.limit) || job.data.length;
  const offset = parseInt(req.query.offset) || 0;
  
  res.json({
    products: job.data.slice(offset, offset + limit),
    summary: job.summary,
    analytics: job.analytics,
    pagination: {
      total: job.data.length,
      limit: limit,
      offset: offset
    }
  });
};

// Export handler
const exportResults = async (req, res) => {
  const { jobId } = req.params;
  const job = jobStorage.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  try {
    const format = req.query.format || 'csv';
    
    if (format === 'excel' || format === 'xlsx') {
      // Export as Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Analysis Results');
      
      // Add headers
      worksheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Manufacturer', key: 'mfg', width: 15 },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Asset Type', key: 'asset_type', width: 15 },
        { header: 'Type', key: 'type', width: 15 },
        { header: 'Product ID', key: 'product_id', width: 20 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Ship Date', key: 'ship_date', width: 12 },
        { header: 'Quantity', key: 'qty', width: 10 },
        { header: 'Total Value', key: 'total_value', width: 15 },
        { header: 'Support Coverage', key: 'support_coverage', width: 15 },
        { header: 'End of Sale', key: 'end_of_sale', width: 12 },
        { header: 'Last Support', key: 'last_day_support', width: 12 }
      ];
      
      // Add data
      job.data.forEach(row => {
        worksheet.addRow(row);
      });
      
      // Style the header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      
      const filename = `export_${job.customerName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      await workbook.xlsx.write(res);
      res.end();
      
    } else {
      // Export as CSV (default)
      const csv = Papa.unparse(job.data);
      const filename = `export_${job.customerName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed', details: error.message });
  }
};

// Filter management handlers
const getFilterSets = async (req, res) => {
  try {
    const filterSets = await phase1FilterService.getAllFilterSets();
    const activeFilter = await phase1FilterService.getActiveFilter();
    
    res.json({
      filterSets,
      activeFilterId: activeFilter?.id || null
    });
  } catch (error) {
    console.error('Error getting filter sets:', error);
    res.status(500).json({ error: 'Failed to get filter sets' });
  }
};

const getFilterSet = async (req, res) => {
  try {
    const { filterId } = req.params;
    const filterSet = await phase1FilterService.getFilterSet(filterId);
    
    if (!filterSet) {
      return res.status(404).json({ error: 'Filter set not found' });
    }
    
    res.json(filterSet);
  } catch (error) {
    console.error('Error getting filter set:', error);
    res.status(500).json({ error: 'Failed to get filter set' });
  }
};

const createFilterSet = async (req, res) => {
  try {
    const filterData = req.body;
    
    if (!filterData.name) {
      return res.status(400).json({ error: 'Filter name is required' });
    }
    
    const result = await phase1FilterService.createFilterSet(filterData);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error creating filter set:', error);
    res.status(500).json({ error: 'Failed to create filter set' });
  }
};

const updateFilterSet = async (req, res) => {
  try {
    const { filterId } = req.params;
    const updates = req.body;
    
    const result = await phase1FilterService.updateFilterSet(filterId, updates);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error updating filter set:', error);
    res.status(500).json({ error: 'Failed to update filter set' });
  }
};

const deleteFilterSet = async (req, res) => {
  try {
    const { filterId } = req.params;
    
    const result = await phase1FilterService.deleteFilterSet(filterId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error deleting filter set:', error);
    res.status(500).json({ error: 'Failed to delete filter set' });
  }
};

const setActiveFilter = async (req, res) => {
  try {
    const { filterId } = req.body;
    
    const result = await phase1FilterService.setActiveFilter(filterId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error setting active filter:', error);
    res.status(500).json({ error: 'Failed to set active filter' });
  }
};

const previewFilter = async (req, res) => {
  try {
    const { filterId, sampleData } = req.body;
    
    if (!filterId || !sampleData) {
      return res.status(400).json({ error: 'Filter ID and sample data are required' });
    }
    
    const filterSet = await phase1FilterService.getFilterSet(filterId);
    
    if (!filterSet) {
      return res.status(404).json({ error: 'Filter set not found' });
    }
    
    // Apply filter to sample data
    const filtered = phase1FilterService.applyFilters(sampleData, filterSet);
    const stats = await phase1FilterService.getFilterStats(filterId, sampleData);
    
    res.json({
      filtered,
      stats
    });
  } catch (error) {
    console.error('Error previewing filter:', error);
    res.status(500).json({ error: 'Failed to preview filter' });
  }
};

module.exports = {
  upload: upload.single('file'),
  uploadFile,
  getJobStatus,
  getResults,
  exportResults,
  // Filter management
  getFilterSets,
  getFilterSet,
  createFilterSet,
  updateFilterSet,
  deleteFilterSet,
  setActiveFilter,
  previewFilter,
  jobStorage  // Export for shared access
};