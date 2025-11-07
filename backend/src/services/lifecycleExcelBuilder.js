// lifecycleExcelBuilder.js
// Comprehensive Excel workbook builder for lifecycle reports

const ExcelJS = require('exceljs');

class LifecycleExcelBuilder {
  constructor() {
    this.colors = {
      navy: 'FF002D62',
      critical: 'FFDC3545',
      high: 'FFFD7E14',
      medium: 'FFFFC107',
      low: 'FF28A745',
      none: 'FF6C757D',
      header: 'FF002D62',
      subheader: 'FF4A5F7F',
      eol: 'FFEF4444',
      eos: 'FFFBBF24',
      current: 'FF10B981'
    };
  }

  /**
   * Build comprehensive multi-sheet Excel report
   */
  async buildComprehensiveReport(reportData) {
    const { data, statistics, charts, riskAnalysis, recommendations, options } = reportData;
    const workbook = new ExcelJS.Workbook();
    
    // Set workbook properties
    workbook.creator = 'Lifecycle Analysis System';
    workbook.lastModifiedBy = 'Lifecycle Report Generator';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.properties.subject = 'Lifecycle Analysis Report';
    workbook.properties.company = options.customerName || 'Organization';
    
    // Create all worksheets
    // NOTE: The following 4 sheets have been removed: Executive Summary, Risk Assessment, Data Quality, Recommendations
    //     await this.createExecutiveSummary(workbook, statistics, recommendations, options);
    await this.createDetailedAnalysis(workbook, data.products, statistics);
    //     await this.createRiskAssessment(workbook, riskAnalysis, data.products);
    await this.createLifecycleTimeline(workbook, data.products, options);
    await this.createEOLProducts(workbook, data.products);
    await this.createCategoryAnalysis(workbook, data.categoryStats, statistics);
    await this.createManufacturerAnalysis(workbook, data.manufacturerStats, statistics);
    //     await this.createDataQuality(workbook, data.products, statistics);
    //     await this.createRecommendations(workbook, recommendations);
    
    return workbook;
  }

  /**
   * Sheet 1: Executive Summary
   */
  async createExecutiveSummary(workbook, statistics, recommendations, options) {
    const sheet = workbook.addWorksheet('Executive Summary');
    let row = 1;
    
    // Title section
    sheet.mergeCells(`A${row}:H${row}`);
    const titleCell = sheet.getCell(`A${row}`);
    titleCell.value = 'LIFECYCLE ANALYSIS REPORT - EXECUTIVE SUMMARY';
    titleCell.font = { size: 16, bold: true, color: { argb: this.colors.navy } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    row += 2;
    
    // Customer and date info
    sheet.getCell(`A${row}`).value = 'Customer:';
    sheet.getCell(`B${row}`).value = options.customerName || 'Organization';
    sheet.getCell(`D${row}`).value = 'Generated:';
    sheet.getCell(`E${row}`).value = new Date().toLocaleDateString();
    sheet.getCell(`G${row}`).value = 'EOL Basis:';
    sheet.getCell(`H${row}`).value = options.eolYearBasis || 'Last Day of Support';
    row += 2;
    
    // Health Scores Section
    this.addSectionHeader(sheet, row, 'HEALTH SCORES', 8);
    row += 2;
    
    const healthScores = [
      ['Overall Health Score', statistics.overallHealthScore, this.getScoreColor(statistics.overallHealthScore)],
      ['Risk Score', statistics.riskScore, this.getScoreColor(100 - statistics.riskScore)],
      ['Data Quality Score', statistics.dataQualityScore, this.getScoreColor(statistics.dataQualityScore)]
    ];
    
    healthScores.forEach(([label, value, color]) => {
      sheet.getCell(`A${row}`).value = label;
      sheet.getCell(`B${row}`).value = value;
      sheet.getCell(`C${row}`).value = '/100';
      
      // Add visual bar
      const barLength = Math.round(value / 10);
      sheet.getCell(`D${row}`).value = '█'.repeat(barLength);
      sheet.getCell(`D${row}`).font = { color: { argb: color } };
      row++;
    });
    row += 2;
    
    // Key Metrics Section
    this.addSectionHeader(sheet, row, 'KEY METRICS', 8);
    row += 2;
    
    const metrics = [
      ['Total Products', statistics.totalProducts, ''],
      ['Total Quantity', statistics.totalQuantity.toLocaleString(), ''],
      ['Unique Manufacturers', statistics.uniqueManufacturers, ''],
      ['Product Categories', statistics.uniqueCategories, ''],
      ['', '', ''],
      ['Critical Risk Products', statistics.criticalRiskCount, `${statistics.percentages.criticalRisk}%`],
      ['High Risk Products', statistics.highRiskCount, `${statistics.percentages.highRisk}%`],
      ['Products at EOL', statistics.productsAtEOL, `${statistics.percentages.eolProducts}%`],
      ['', '', ''],
      ['AI Enhanced', statistics.aiEnhancement.enhanced, `${statistics.aiEnhancement.percentageEnhanced}%`],
      ['Average Confidence', `${statistics.confidenceAnalysis.average}%`, ''],
      ['Support Coverage', `${statistics.supportCoverage.averageCoverage}%`, '']
    ];
    
    metrics.forEach(([label, value, percentage]) => {
      if (label) {
        sheet.getCell(`A${row}`).value = label;
        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.getCell(`B${row}`).value = value;
        if (percentage) {
          sheet.getCell(`C${row}`).value = percentage;
          sheet.getCell(`C${row}`).font = { italic: true };
        }
      }
      row++;
    });
    row += 2;
    
    // Top Insights Section
    this.addSectionHeader(sheet, row, 'TOP INSIGHTS & ALERTS', 8);
    row += 2;
    
    statistics.topInsights.forEach((insight, index) => {
      const prioritySymbol = insight.type === 'critical' ? '🔴' : 
                            insight.type === 'warning' ? '🟡' : 
                            insight.type === 'info' ? '🔵' : '🟢';
      
      sheet.mergeCells(`A${row}:H${row}`);
      const insightCell = sheet.getCell(`A${row}`);
      insightCell.value = `${prioritySymbol} ${insight.title}: ${insight.message}`;
      insightCell.font = { bold: insight.type === 'critical' };
      row++;
    });
    row += 2;
    
    // Financial Impact Section
    this.addSectionHeader(sheet, row, 'FINANCIAL IMPACT (ESTIMATED)', 8);
    row += 2;
    
    const financial = [
      ['Total Inventory Value', `$${statistics.financialMetrics.estimatedTotalValue.toLocaleString()}`],
      ['Value at Risk', `$${statistics.financialMetrics.valueAtRisk.toLocaleString()}`],
      ['Critical Value', `$${statistics.financialMetrics.criticalValue.toLocaleString()}`],
      ['Recommended Budget', `$${statistics.financialMetrics.replacementBudget.toLocaleString()}`]
    ];
    
    financial.forEach(([label, value]) => {
      sheet.getCell(`A${row}`).value = label;
      sheet.getCell(`A${row}`).font = { bold: true };
      sheet.getCell(`B${row}`).value = value;
      sheet.getCell(`B${row}`).font = { color: { argb: this.colors.critical } };
      row++;
    });
    
    // Format columns
    sheet.getColumn('A').width = 30;
    sheet.getColumn('B').width = 20;
    sheet.getColumn('C').width = 15;
    sheet.getColumn('D').width = 25;
    sheet.columns.forEach(col => {
      if (col.number <= 8) col.alignment = { vertical: 'middle' };
    });
  }

  /**
   * Sheet 2: Detailed Analysis
   */
  async createDetailedAnalysis(workbook, products, statistics) {
    const sheet = workbook.addWorksheet('Detailed Analysis');
    
    // Headers
    const headers = [
      'Product ID',
      'Description',
      'Manufacturer',
      'Category',
      'Total Quantity',
      'Lifecycle Status',
      'Risk Level',
      'End of Sale',
      'End SW Maint',
      'End SW Vuln',
      'Last Day Support',
      'Support Coverage %',
      'AI Enhanced',
      'Confidence Score',
      'Requires Review'
    ];
    
    const headerRow = sheet.addRow(headers);
    this.formatHeaderRow(headerRow);
    
    // Add data rows
    products.forEach(product => {
      const row = sheet.addRow([
        product.product_id,
        product.description || '-',
        product.manufacturer || '-',
        product.product_category || '-',
        product.total_quantity,
        product.lifecycle_status || 'Unknown',
        product.risk_level || 'none',
        this.formatDate(product.end_of_sale_date),
        this.formatDate(product.end_of_sw_maintenance_date),
        this.formatDate(product.end_of_sw_vulnerability_maintenance_date),
        this.formatDate(product.last_day_of_support_date),
        product.support_coverage_percentage || 0,
        product.ai_enhanced ? 'Yes' : 'No',
        product.overall_confidence || 0,
        product.requires_review ? 'Yes' : 'No'
      ]);
      
      // Apply conditional formatting
      // Risk level coloring
      const riskCell = row.getCell(7);
      const riskColor = this.getRiskColor(product.risk_level);
      riskCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: riskColor }
      };
      if (product.risk_level === 'critical' || product.risk_level === 'high') {
        riskCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      }
      
      // Lifecycle status coloring
      const statusCell = row.getCell(6);
      if (product.lifecycle_status === 'EOL' || product.lifecycle_status === 'End of Life') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: this.colors.eol }
        };
        statusCell.font = { color: { argb: 'FFFFFFFF' } };
      } else if (product.lifecycle_status === 'End of Sale') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: this.colors.eos }
        };
      }
      
      // Confidence score coloring
      const confCell = row.getCell(14);
      if (product.overall_confidence >= 80) {
        confCell.font = { color: { argb: 'FF28A745' } };
      } else if (product.overall_confidence < 60) {
        confCell.font = { color: { argb: 'FFDC3545' } };
      }
    });
    
    // Auto-filter
    sheet.autoFilter = {
      from: 'A1',
      to: `O${products.length + 1}`
    };
    
    // Freeze header row
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
    
    // Set column widths
    const columnWidths = [15, 40, 20, 20, 12, 15, 10, 12, 12, 12, 12, 15, 10, 12, 12];
    columnWidths.forEach((width, index) => {
      sheet.getColumn(index + 1).width = width;
    });
  }

  /**
   * Sheet 3: Risk Assessment
   */
  async createRiskAssessment(workbook, riskAnalysis, products) {
    const sheet = workbook.addWorksheet('Risk Assessment');
    let row = 1;
    
    // Title
    this.addSectionHeader(sheet, row, 'RISK ASSESSMENT SUMMARY', 10);
    row += 2;
    
    // Risk distribution table
    const riskLevels = ['critical', 'high', 'medium', 'low', 'none'];
    const riskHeaders = ['Risk Level', 'Product Count', 'Total Quantity', 'Percentage', 'Action Required'];
    
    const riskHeaderRow = sheet.addRow(riskHeaders);
    this.formatHeaderRow(riskHeaderRow);
    row++;
    
    riskLevels.forEach(level => {
      const levelProducts = riskAnalysis.summary[level];
      const percentage = ((levelProducts.length / products.length) * 100).toFixed(1);
      const totalQty = levelProducts.reduce((sum, p) => sum + p.total_quantity, 0);
      
      const action = level === 'critical' ? 'IMMEDIATE REPLACEMENT' :
                    level === 'high' ? 'Plan Migration (3-6 months)' :
                    level === 'medium' ? 'Schedule Review (6-12 months)' :
                    level === 'low' ? 'Monitor' : 'None';
      
      const dataRow = sheet.addRow([
        level.toUpperCase(),
        levelProducts.length,
        totalQty,
        `${percentage}%`,
        action
      ]);
      
      // Color the risk level cell
      const riskCell = dataRow.getCell(1);
      riskCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: this.getRiskColor(level) }
      };
      if (level === 'critical' || level === 'high') {
        riskCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      }
      row++;
    });
    row += 2;
    
    // Timeline analysis
    this.addSectionHeader(sheet, row, 'EOL TIMELINE ANALYSIS', 10);
    row += 2;
    
    const timelineHeaders = ['Timeline', 'Product Count', 'Action'];
    sheet.addRow(timelineHeaders).font = { bold: true };
    row++;
    
    const timelineData = [
      ['Next 6 Months', riskAnalysis.timeline.next6Months.length, 'Urgent - Begin replacement process'],
      ['6-12 Months', riskAnalysis.timeline.next12Months.length, 'High Priority - Plan migration'],
      ['12-24 Months', riskAnalysis.timeline.next24Months.length, 'Medium Priority - Budget planning']
    ];
    
    timelineData.forEach(([period, count, action]) => {
      sheet.addRow([period, count, action]);
      row++;
    });
    row += 2;
    
    // Financial impact
    this.addSectionHeader(sheet, row, 'FINANCIAL IMPACT', 10);
    row += 2;
    
    const financialData = [
      ['Total Value at Risk', `$${riskAnalysis.financialImpact.totalAtRisk.toLocaleString()}`],
      ['Critical Products Value', `$${riskAnalysis.financialImpact.criticalValue.toLocaleString()}`],
      ['Estimated Replacement Cost', `$${riskAnalysis.financialImpact.replacementCost.toLocaleString()}`]
    ];
    
    financialData.forEach(([label, value]) => {
      const dataRow = sheet.addRow([label, value]);
      dataRow.getCell(1).font = { bold: true };
      dataRow.getCell(2).font = { color: { argb: this.colors.critical } };
      row++;
    });
    
    // Format columns
    sheet.getColumn('A').width = 30;
    sheet.getColumn('B').width = 20;
    sheet.getColumn('C').width = 20;
    sheet.getColumn('D').width = 15;
    sheet.getColumn('E').width = 35;
  }


  /**
   * Sheet 4: Lifecycle Timeline (Year view) - EXACTLY matching screen display
   */
  async createLifecycleTimeline(workbook, products, options) {
    const sheet = workbook.addWorksheet('Lifecycle Timeline');
    
    // Calculate dynamic year range (EXACTLY as frontend does)
    const currentYear = new Date().getFullYear();
    let dataMinYear = currentYear;
    let dataMaxYear = currentYear;
    
    // Analyze products to find actual date range
    products.forEach(product => {
      // Check purchase years from year_quantities
      if (product.year_quantities) {
        Object.keys(product.year_quantities).forEach(yearStr => {
          const year = parseInt(yearStr);
          if (!isNaN(year) && product.year_quantities[yearStr] > 0) {
            dataMinYear = Math.min(dataMinYear, year);
            dataMaxYear = Math.max(dataMaxYear, year);
          }
        });
      }
      
      // Check LDOS year
      if (product.last_day_of_support_date) {
        const ldosYear = new Date(product.last_day_of_support_date).getFullYear();
        if (!isNaN(ldosYear)) {
          dataMaxYear = Math.max(dataMaxYear, ldosYear);
        }
      }
      
      // Check EOS year
      if (product.end_of_sale_date) {
        const eosYear = new Date(product.end_of_sale_date).getFullYear();
        if (!isNaN(eosYear)) {
          dataMinYear = Math.min(dataMinYear, eosYear);
        }
      }
    });
    
    // Apply business rules (same as frontend)
    const minYear = Math.min(dataMinYear, currentYear - 10);
    const maxYear = Math.max(dataMaxYear + 2, currentYear + 5);
    
    console.log('Excel Timeline range:', {
      dataMinYear,
      dataMaxYear,
      displayMinYear: minYear,
      displayMaxYear: maxYear
    });
    
    // Build year columns array
    const yearColumns = [];
    for (let year = minYear; year <= maxYear; year++) {
      yearColumns.push(year);
    }
    
    // Define border style for all cells (light gray)
    const borderStyle = {
      top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
      right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
    };
    
    // Headers
    const headers = [
      'Manufacturer',
      'Category',
      'Product ID',
      'Description',
      'Total Qty',
      'EOS Year',
      'LDOS Year',
      ...yearColumns
    ];
    
    const headerRow = sheet.addRow(headers);
    
    // Format headers (navy background, white text)
    headerRow.eachCell((cell, colNumber) => {
      const isYearColumn = colNumber > 7;
      const isCurrentYear = isYearColumn && headers[colNumber - 1] === currentYear;
      
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isCurrentYear ? 'FF004D8C' : 'FF002D62' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = borderStyle;
      
      // Add (Current) text for current year
      if (isCurrentYear) {
        cell.value = {
          richText: [
            { text: currentYear.toString(), font: { bold: true, color: { argb: 'FFFFFFFF' } } },
            { text: '\n(Current)', font: { size: 10, color: { argb: 'FFFFFFFF' } } }
          ]
        };
        cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
      }
    });
    
    // Add product rows
    products.forEach((product, index) => {
      const eosYear = product.end_of_sale_date ? 
        new Date(product.end_of_sale_date).getFullYear() : '-';
      const ldosYear = product.last_day_of_support_date ? 
        new Date(product.last_day_of_support_date).getFullYear() : '-';
      
      // Fixed columns data
      const rowData = [
        product.manufacturer || '-',
        product.product_category || '-',
        product.product_id,
        product.description || '-',
        product.total_quantity || 0,
        eosYear,
        ldosYear
      ];
      
      const row = sheet.addRow(rowData);
      
      // Apply alternating row colors and borders to fixed columns
      const rowBgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF9F9F9';
      for (let col = 1; col <= 7; col++) {
        const cell = row.getCell(col);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBgColor }
        };
        cell.border = borderStyle;
        
        // Special formatting
        if (col === 5) { // Total Qty - right align and format number
          cell.alignment = { horizontal: 'right' };
          cell.numFmt = '#,##0';
        } else if (col === 6 || col === 7) { // EOS/LDOS Year - center align
          cell.alignment = { horizontal: 'center' };
          if (col === 7) { // LDOS Year - bold
            cell.font = { bold: true };
          }
        }
      }
      
      // Add year columns with quantities and LDOS dates
      yearColumns.forEach((year, yearIndex) => {
        const col = 8 + yearIndex;
        const cell = row.getCell(col);
        
        // Get year quantity (MUST convert year to string!)
        const yearStr = year.toString();
        const yearQty = product.year_quantities?.[yearStr] || 0;
        
        // Check if LDOS falls in this year
        let ldosDateInYear = '';
        if (product.last_day_of_support_date) {
          const ldosDate = new Date(product.last_day_of_support_date);
          if (ldosDate.getFullYear() === year) {
            const monthName = ldosDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
            const day = ldosDate.getDate();
            ldosDateInYear = `${monthName} ${day}`;
          }
        }
        
        // Set cell value (combining quantity and LDOS date)
        if (yearQty > 0 && ldosDateInYear) {
          // Both quantity and LDOS date
          cell.value = {
            richText: [
              { text: yearQty.toLocaleString(), font: { size: 11 } },
              { text: '\n' },
              { text: ldosDateInYear, font: { size: 10, color: { argb: 'FFDC3545' }, bold: true } }
            ]
          };
          cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
        } else if (yearQty > 0) {
          // Only quantity
          cell.value = yearQty;
          cell.numFmt = '#,##0';
          cell.font = { size: 11 };
          cell.alignment = { horizontal: 'center' };
        } else if (ldosDateInYear) {
          // Only LDOS date
          cell.value = ldosDateInYear;
          cell.font = { size: 10, color: { argb: 'FFDC3545' }, bold: true };
          cell.alignment = { horizontal: 'center' };
        }
        
        // Apply background color based on lifecycle status
        let bgColor = 'FFFFFFFF'; // Default white
        if (ldosYear !== '-' && year >= ldosYear) {
          bgColor = 'FFFFEBEE'; // Light red for EOL
        } else if (eosYear !== '-' && year >= eosYear) {
          bgColor = 'FFFFF9C4'; // Light yellow for EOS
        }
        
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor }
        };
        cell.border = borderStyle;
      });
    });
    
    // Add footer row with totals
    const footerRow = sheet.addRow([
      `Total Products: ${products.length}`,
      '',
      '',
      '',
      products.reduce((sum, p) => sum + (p.total_quantity || 0), 0),
      '',
      ''
    ]);
    
    // Merge cells for footer text
    sheet.mergeCells(footerRow.number, 1, footerRow.number, 4);
    
    // Format footer
    footerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: 'FF002D62' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8EEF4' }
      };
      cell.border = borderStyle;
      
      if (colNumber === 5) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      }
    });
    
    // Add year totals in footer
    yearColumns.forEach((year, index) => {
      const col = 8 + index;
      const yearStr = year.toString();
      const yearTotal = products.reduce((sum, p) => 
        sum + (p.year_quantities?.[yearStr] || 0), 0
      );
      
      const cell = footerRow.getCell(col);
      if (yearTotal > 0) {
        cell.value = yearTotal;
        cell.numFmt = '#,##0';
      }
      cell.font = { bold: true, color: { argb: 'FF002D62' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8EEF4' }
      };
      cell.border = borderStyle;
      cell.alignment = { horizontal: 'center' };
    });
    
    // Add legend below
    const legendRow1 = footerRow.number + 2;
    sheet.getCell(legendRow1, 1).value = 'Legend:';
    sheet.getCell(legendRow1, 1).font = { bold: true };
    
    sheet.getCell(legendRow1, 2).value = 'Past End of Life';
    sheet.getCell(legendRow1, 2).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFEBEE' }
    };
    sheet.getCell(legendRow1, 2).border = borderStyle;
    
    sheet.getCell(legendRow1, 3).value = 'Past End of Sale';
    sheet.getCell(legendRow1, 3).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF9C4' }
    };
    sheet.getCell(legendRow1, 3).border = borderStyle;
    
    sheet.getCell(legendRow1, 4).value = 'MON DD = Last Day of Support Date';
    sheet.getCell(legendRow1, 4).font = { color: { argb: 'FFDC3545' }, bold: true };
    
    // Format columns
    sheet.getColumn('A').width = 20;  // Manufacturer
    sheet.getColumn('B').width = 20;  // Category
    sheet.getColumn('C').width = 15;  // Product ID
    sheet.getColumn('D').width = 40;  // Description
    sheet.getColumn('E').width = 12;  // Total Qty
    sheet.getColumn('F').width = 10;  // EOS Year
    sheet.getColumn('G').width = 10;  // LDOS Year
    
    yearColumns.forEach((year, index) => {
      sheet.getColumn(8 + index).width = 10;
    });
    
    // Freeze panes (first 3 columns and header row)
    sheet.views = [
      {
        state: 'frozen',
        xSplit: 3,
        ySplit: 1,
        topLeftCell: 'D2'
      }
    ];
  }

  /**
   * Sheet 5: EOL Products
   */
  async createEOLProducts(workbook, products) {
    const sheet = workbook.addWorksheet('EOL Products');
    
    const eolProducts = products.filter(p => 
      p.lifecycle_status === 'EOL' || 
      p.lifecycle_status === 'End of Life' ||
      (p.last_day_of_support_date && new Date(p.last_day_of_support_date) < new Date())
    );
    
    // Title
    sheet.mergeCells('A1:H1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `END OF LIFE PRODUCTS (${eolProducts.length} Total)`;
    titleCell.font = { size: 14, bold: true, color: { argb: this.colors.critical } };
    
    // Headers
    const headers = [
      'Product ID',
      'Description',
      'Manufacturer',
      'Category',
      'Quantity',
      'Last Day of Support',
      'Days Past EOL',
      'Replacement Priority'
    ];
    
    const headerRow = sheet.addRow(headers);
    this.formatHeaderRow(headerRow);
    
    // Sort by days past EOL
    const sortedEOL = eolProducts.sort((a, b) => {
      const dateA = a.last_day_of_support_date ? new Date(a.last_day_of_support_date) : new Date('2099-12-31');
      const dateB = b.last_day_of_support_date ? new Date(b.last_day_of_support_date) : new Date('2099-12-31');
      return dateA - dateB;
    });
    
    sortedEOL.forEach(product => {
      const ldosDate = product.last_day_of_support_date ? new Date(product.last_day_of_support_date) : null;
      const daysPastEOL = ldosDate ? Math.floor((new Date() - ldosDate) / (1000 * 60 * 60 * 24)) : 0;
      const priority = daysPastEOL > 365 ? 'CRITICAL' : 
                      daysPastEOL > 180 ? 'HIGH' : 
                      daysPastEOL > 0 ? 'MEDIUM' : 'UPCOMING';
      
      const row = sheet.addRow([
        product.product_id,
        product.description || '-',
        product.manufacturer || '-',
        product.product_category || '-',
        product.total_quantity,
        this.formatDate(product.last_day_of_support_date),
        daysPastEOL > 0 ? daysPastEOL : 'Upcoming',
        priority
      ]);
      
      // Color priority cell
      const priorityCell = row.getCell(8);
      if (priority === 'CRITICAL') {
        priorityCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: this.colors.critical }
        };
        priorityCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      }
    });
    
    // Set column widths
    const widths = [15, 40, 20, 20, 10, 15, 12, 15];
    widths.forEach((width, index) => {
      sheet.getColumn(index + 1).width = width;
    });
  }

  /**
   * Sheet 6: Category Analysis
   */
  async createCategoryAnalysis(workbook, categoryStats, statistics) {
    const sheet = workbook.addWorksheet('Category Analysis');
    
    // Headers
    const headers = [
      'Category',
      'Product Count',
      'Total Quantity',
      'Critical Risk',
      'High Risk',
      'Avg Confidence',
      '% of Total'
    ];
    
    const headerRow = sheet.addRow(headers);
    this.formatHeaderRow(headerRow);
    
    // Add category data
    if (categoryStats && categoryStats.length > 0) {
      categoryStats.forEach(cat => {
        const percentage = ((cat.total_quantity / statistics.totalQuantity) * 100).toFixed(1);
        
        sheet.addRow([
          cat.product_category || 'Uncategorized',
          cat.product_count,
          cat.total_quantity,
          cat.critical_count || 0,
          cat.high_count || 0,
          Math.round(cat.avg_confidence || 0),
          `${percentage}%`
        ]);
      });
    }
    
    // Auto-fit columns
    sheet.columns.forEach((column, index) => {
      column.width = index === 0 ? 30 : 15;
    });
  }

  /**
   * Sheet 7: Manufacturer Analysis
   */
  async createManufacturerAnalysis(workbook, manufacturerStats, statistics) {
    const sheet = workbook.addWorksheet('Manufacturer Analysis');
    
    // Headers
    const headers = [
      'Manufacturer',
      'Product Count',
      'Total Quantity',
      'EOL Count',
      'AI Enhanced',
      'Avg Confidence',
      '% of Total'
    ];
    
    const headerRow = sheet.addRow(headers);
    this.formatHeaderRow(headerRow);
    
    // Add manufacturer data
    if (manufacturerStats && manufacturerStats.length > 0) {
      manufacturerStats.forEach(mfr => {
        const percentage = ((mfr.total_quantity / statistics.totalQuantity) * 100).toFixed(1);
        
        sheet.addRow([
          mfr.manufacturer || 'Unknown',
          mfr.product_count,
          mfr.total_quantity,
          mfr.eol_count || 0,
          mfr.ai_enhanced_count || 0,
          Math.round(mfr.avg_confidence || 0),
          `${percentage}%`
        ]);
      });
    }
    
    // Auto-fit columns
    sheet.columns.forEach((column, index) => {
      column.width = index === 0 ? 30 : 15;
    });
  }

  /**
   * Sheet 8: Data Quality
   */
  async createDataQuality(workbook, products, statistics) {
    const sheet = workbook.addWorksheet('Data Quality');
    let row = 1;
    
    // Title
    this.addSectionHeader(sheet, row, 'DATA QUALITY ASSESSMENT', 10);
    row += 2;
    
    // Overall metrics
    const qualityMetrics = [
      ['Data Quality Score', `${statistics.dataQualityScore}/100`],
      ['AI Enhanced Products', `${statistics.aiEnhancement.enhanced} (${statistics.aiEnhancement.percentageEnhanced}%)`],
      ['Average Confidence', `${statistics.confidenceAnalysis.average}%`],
      ['Products Requiring Review', statistics.confidenceAnalysis.requiresReview]
    ];
    
    qualityMetrics.forEach(([label, value]) => {
      const dataRow = sheet.addRow([label, value]);
      dataRow.getCell(1).font = { bold: true };
      row++;
    });
    row += 2;
    
    // Confidence distribution
    this.addSectionHeader(sheet, row, 'CONFIDENCE DISTRIBUTION', 10);
    row += 2;
    
    const confHeaders = ['Confidence Level', 'Product Count', 'Percentage'];
    sheet.addRow(confHeaders).font = { bold: true };
    row++;
    
    const confData = [
      ['High (80-100%)', statistics.confidenceAnalysis.high, ((statistics.confidenceAnalysis.high / statistics.totalProducts) * 100).toFixed(1)],
      ['Medium (60-79%)', statistics.confidenceAnalysis.medium, ((statistics.confidenceAnalysis.medium / statistics.totalProducts) * 100).toFixed(1)],
      ['Low (<60%)', statistics.confidenceAnalysis.low, ((statistics.confidenceAnalysis.low / statistics.totalProducts) * 100).toFixed(1)]
    ];
    
    confData.forEach(([level, count, pct]) => {
      sheet.addRow([level, count, `${pct}%`]);
      row++;
    });
    row += 2;
    
    // Data completeness
    this.addSectionHeader(sheet, row, 'DATA COMPLETENESS', 10);
    row += 2;
    
    const completenessData = [
      ['Products with End of Sale Date', statistics.dataCompleteness.withEndOfSale],
      ['Products with Last Day of Support', statistics.dataCompleteness.withEndOfSupport],
      ['Products with All EOL Dates', statistics.dataCompleteness.withAllDates],
      ['Products Missing All Dates', statistics.dataCompleteness.missingAllDates]
    ];
    
    completenessData.forEach(([label, value]) => {
      const dataRow = sheet.addRow([label, value]);
      dataRow.getCell(1).font = { bold: true };
      row++;
    });
    
    // Low confidence products list
    row += 2;
    this.addSectionHeader(sheet, row, 'LOW CONFIDENCE PRODUCTS (SAMPLE)', 10);
    row += 2;
    
    const lowConfHeaders = ['Product ID', 'Description', 'Confidence', 'Reason'];
    sheet.addRow(lowConfHeaders).font = { bold: true };
    row++;
    
    const lowConfProducts = products
      .filter(p => p.overall_confidence < 60)
      .slice(0, 10);
    
    lowConfProducts.forEach(product => {
      sheet.addRow([
        product.product_id,
        product.description || '-',
        `${product.overall_confidence}%`,
        product.ai_enhanced ? 'Low source reliability' : 'No AI enhancement'
      ]);
    });
    
    // Format columns
    sheet.getColumn('A').width = 40;
    sheet.getColumn('B').width = 40;
    sheet.getColumn('C').width = 20;
    sheet.getColumn('D').width = 30;
  }

  /**
   * Sheet 9: Recommendations
   */
  async createRecommendations(workbook, recommendations) {
    const sheet = workbook.addWorksheet('Recommendations');
    let row = 1;
    
    // Title
    this.addSectionHeader(sheet, row, 'ACTIONABLE RECOMMENDATIONS', 10);
    row += 2;
    
    // Process each recommendation category
    const categories = [
      { key: 'immediate', title: 'IMMEDIATE ACTIONS (0-3 Months)', color: this.colors.critical },
      { key: 'shortTerm', title: 'SHORT TERM (3-6 Months)', color: this.colors.high },
      { key: 'longTerm', title: 'LONG TERM (6-12 Months)', color: this.colors.medium },
      { key: 'strategic', title: 'STRATEGIC INITIATIVES', color: this.colors.navy }
    ];
    
    categories.forEach(({ key, title, color }) => {
      const recs = recommendations[key];
      if (recs && recs.length > 0) {
        // Category header
        sheet.mergeCells(`A${row}:F${row}`);
        const headerCell = sheet.getCell(`A${row}`);
        headerCell.value = title;
        headerCell.font = { bold: true, color: { argb: color } };
        headerCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' }
        };
        row += 2;
        
        recs.forEach((rec, index) => {
          // Priority
          sheet.getCell(`A${row}`).value = `${index + 1}.`;
          sheet.getCell(`B${row}`).value = rec.priority;
          sheet.getCell(`B${row}`).font = { bold: true, color: { argb: this.getPriorityColor(rec.priority) } };
          
          // Title and description
          sheet.mergeCells(`C${row}:F${row}`);
          sheet.getCell(`C${row}`).value = rec.title;
          sheet.getCell(`C${row}`).font = { bold: true };
          row++;
          
          sheet.mergeCells(`B${row}:F${row}`);
          sheet.getCell(`B${row}`).value = rec.description;
          row++;
          
          // Additional details
          if (rec.products && rec.products.length > 0) {
            sheet.mergeCells(`B${row}:F${row}`);
            sheet.getCell(`B${row}`).value = `Affected Products: ${rec.products.slice(0, 5).join(', ')}${rec.products.length > 5 ? '...' : ''}`;
            sheet.getCell(`B${row}`).font = { italic: true };
            row++;
          }
          
          if (rec.estimatedCost) {
            sheet.mergeCells(`B${row}:F${row}`);
            sheet.getCell(`B${row}`).value = `Estimated Cost: $${rec.estimatedCost.toLocaleString()}`;
            sheet.getCell(`B${row}`).font = { italic: true };
            row++;
          }
          
          if (rec.timeline) {
            sheet.mergeCells(`B${row}:F${row}`);
            sheet.getCell(`B${row}`).value = `Timeline: ${rec.timeline}`;
            sheet.getCell(`B${row}`).font = { italic: true };
            row++;
          }
          
          row++; // Extra space between recommendations
        });
        
        row++; // Extra space between categories
      }
    });
    
    // Format columns
    sheet.getColumn('A').width = 5;
    sheet.getColumn('B').width = 15;
    sheet.getColumn('C').width = 30;
    sheet.getColumn('D').width = 30;
    sheet.getColumn('E').width = 20;
    sheet.getColumn('F').width = 20;
  }

  /**
   * Helper methods
   */
  formatHeaderRow(row) {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: this.colors.header }
    };
    row.alignment = { horizontal: 'center', vertical: 'middle' };
    row.height = 25;
  }
  
  addSectionHeader(sheet, rowNum, title, colSpan) {
    sheet.mergeCells(`A${rowNum}:${String.fromCharCode(64 + colSpan)}${rowNum}`);
    const cell = sheet.getCell(`A${rowNum}`);
    cell.value = title;
    cell.font = { size: 12, bold: true, color: { argb: this.colors.navy } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8EEF4' }
    };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: this.colors.navy } }
    };
  }
  
  formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  
  getRiskColor(risk) {
    const colors = {
      critical: this.colors.critical,
      high: this.colors.high,
      medium: this.colors.medium,
      low: this.colors.low,
      none: this.colors.none
    };
    return colors[risk] || this.colors.none;
  }
  
  getPriorityColor(priority) {
    const colors = {
      CRITICAL: this.colors.critical,
      HIGH: this.colors.high,
      MEDIUM: this.colors.medium,
      LOW: this.colors.low
    };
    return colors[priority] || this.colors.navy;
  }
  
  getScoreColor(score) {
    if (score >= 80) return 'FF28A745';
    if (score >= 60) return 'FFFFC107';
    if (score >= 40) return 'FFFD7E14';
    return 'FFDC3545';
  }
}

module.exports = LifecycleExcelBuilder;