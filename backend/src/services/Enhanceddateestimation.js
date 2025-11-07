/**
 * Enhanced Date Estimation Service
 * Estimates missing lifecycle dates with industry-standard intervals
 * Sets confidence at 85% for estimated dates
 * 
 * Standard intervals:
 * - End of SW Maintenance = EOS + 3 years
 * - End of SW Vulnerability = EOS + 4 years
 * - Last Day of Support = EOS + 5 years
 * 
 * Ensures 100% date coverage when at least one date is known
 */

class EnhancedDateEstimation {
  constructor() {
    // Standard lifecycle intervals (in years)
    this.standardIntervals = {
      eos_to_sw_maintenance: 3,
      eos_to_sw_vulnerability: 4,
      eos_to_last_support: 5,
      sw_maintenance_to_sw_vulnerability: 1,
      sw_maintenance_to_last_support: 2,
      sw_vulnerability_to_last_support: 1
    };
    
    // Vendor-specific adjustments
    this.vendorAdjustments = {
      cisco: {
        eos_to_sw_maintenance: 1,      // Cisco typically 1 year
        eos_to_sw_vulnerability: 3,    // Cisco typically 3 years
        eos_to_last_support: 5         // Standard 5 years
      },
      microsoft: {
        eos_to_sw_maintenance: 5,      // Microsoft longer support
        eos_to_sw_vulnerability: 8,    // Extended security updates
        eos_to_last_support: 10        // Very long support cycles
      },
      hp: {
        eos_to_sw_maintenance: 3,      // Standard
        eos_to_sw_vulnerability: 4,    // Standard
        eos_to_last_support: 5         // Standard
      },
      dell: {
        eos_to_sw_maintenance: 3,      // Standard
        eos_to_sw_vulnerability: 4,    // Standard
        eos_to_last_support: 5         // Standard
      }
    };
    
    // Confidence levels
    this.ESTIMATED_DATE_CONFIDENCE = 85; // 85% confidence for estimated dates
    this.FOUND_DATE_CONFIDENCE = 95;     // 95% confidence for AI-found dates
  }

  /**
   * Main entry point - estimates all missing dates
   * @param {Object} product - Product with some dates potentially missing
   * @returns {Object} Product with all dates filled and estimation metadata
   */
  estimateMissingDates(product) {
    console.log(`📊 Starting date estimation for ${product.product_id}`);
    
    // Extract existing dates
    const originalDates = {
      date_introduced: product.date_introduced,
      end_of_sale_date: product.end_of_sale_date,
      end_of_sw_maintenance_date: product.end_of_sw_maintenance_date,
      end_of_sw_vulnerability_maintenance_date: product.end_of_sw_vulnerability_maintenance_date,
      last_day_of_support_date: product.last_day_of_support_date || product.end_of_life_date
    };
    
    // Count original dates found
    const originalDatesCount = Object.values(originalDates).filter(d => d !== null && d !== undefined).length;
    console.log(`📅 Original dates found: ${originalDatesCount}/5`);
    
    // Get vendor-specific intervals
    const intervals = this.getVendorIntervals(product.manufacturer);
    
    // Create working copy of dates
    let estimatedDates = { ...originalDates };
    let estimationMetadata = {
      estimated_fields: {},
      estimation_basis: null,
      estimation_confidence: 100,
      original_dates_count: originalDatesCount,
      estimated_dates_count: 0,
      vendor_specific: false
    };
    
    // Try different estimation strategies in order of preference
    if (originalDates.end_of_sale_date) {
      // Strategy 1: Estimate from End of Sale (most common scenario)
      console.log('🎯 Using EOS-based estimation strategy');
      estimatedDates = this.estimateFromEOS(estimatedDates, intervals, estimationMetadata);
      estimationMetadata.estimation_basis = 'end_of_sale';
    } else if (originalDates.last_day_of_support_date) {
      // Strategy 2: Estimate from Last Day of Support (work backwards)
      console.log('🎯 Using LDOS-based estimation strategy');
      estimatedDates = this.estimateFromLDOS(estimatedDates, intervals, estimationMetadata);
      estimationMetadata.estimation_basis = 'last_day_of_support';
    } else if (originalDates.end_of_sw_maintenance_date) {
      // Strategy 3: Estimate from SW Maintenance date
      console.log('🎯 Using SW Maintenance-based estimation strategy');
      estimatedDates = this.estimateFromSWMaintenance(estimatedDates, intervals, estimationMetadata);
      estimationMetadata.estimation_basis = 'sw_maintenance';
    } else if (originalDates.end_of_sw_vulnerability_maintenance_date) {
      // Strategy 4: Estimate from SW Vulnerability date (rare)
      console.log('🎯 Using SW Vulnerability-based estimation strategy');
      estimatedDates = this.estimateFromSWVulnerability(estimatedDates, intervals, estimationMetadata);
      estimationMetadata.estimation_basis = 'sw_vulnerability';
    } else {
      // No dates to work with
      console.log('⚠️ No dates available for estimation');
      estimationMetadata.estimation_basis = 'none';
      estimationMetadata.estimation_confidence = 0;
    }
    
    // Calculate final confidence
    estimationMetadata.estimated_dates_count = Object.keys(estimationMetadata.estimated_fields).filter(
      key => estimationMetadata.estimated_fields[key] === true
    ).length;
    
    // Set confidence: 85% for estimated dates, higher if we have more original dates
    if (estimationMetadata.estimated_dates_count > 0) {
      if (originalDatesCount >= 2) {
        estimationMetadata.estimation_confidence = this.ESTIMATED_DATE_CONFIDENCE;
      } else if (originalDatesCount === 1) {
        estimationMetadata.estimation_confidence = this.ESTIMATED_DATE_CONFIDENCE - 5; // 80%
      } else {
        estimationMetadata.estimation_confidence = this.ESTIMATED_DATE_CONFIDENCE - 10; // 75%
      }
    }
    
    // Check if vendor-specific adjustments were used
    const manufacturer = (product.manufacturer || '').toLowerCase();
    estimationMetadata.vendor_specific = this.vendorAdjustments.hasOwnProperty(
      manufacturer.split(' ')[0] // Get first word (cisco, hp, dell, etc.)
    );
    
    // Log estimation summary
    console.log(`✅ Estimation complete: ${estimationMetadata.estimated_dates_count} dates estimated`);
    console.log(`📈 Confidence: ${estimationMetadata.estimation_confidence}%`);
    
    // Return enhanced product with all dates and metadata
    return {
      ...product,
      ...estimatedDates,
      estimation_metadata: estimationMetadata,
      // Update overall confidence to 85% if dates were estimated
      lifecycle_confidence: estimationMetadata.estimated_dates_count > 0 
        ? Math.max(product.lifecycle_confidence || 0, this.ESTIMATED_DATE_CONFIDENCE)
        : product.lifecycle_confidence,
      overall_confidence: estimationMetadata.estimated_dates_count > 0
        ? Math.max(product.overall_confidence || 0, this.ESTIMATED_DATE_CONFIDENCE)
        : product.overall_confidence
    };
  }

  /**
   * Estimate dates based on End of Sale date
   */
  estimateFromEOS(dates, intervals, metadata) {
    const eosDate = new Date(dates.end_of_sale_date);
    
    // Estimate SW Maintenance
    if (!dates.end_of_sw_maintenance_date) {
      const swMaintDate = new Date(eosDate);
      swMaintDate.setFullYear(swMaintDate.getFullYear() + intervals.eos_to_sw_maintenance);
      dates.end_of_sw_maintenance_date = this.formatDate(swMaintDate);
      metadata.estimated_fields.end_of_sw_maintenance = true;
      console.log(`  📅 Estimated SW Maintenance: ${dates.end_of_sw_maintenance_date}`);
    }
    
    // Estimate SW Vulnerability
    if (!dates.end_of_sw_vulnerability_maintenance_date) {
      const swVulnDate = new Date(eosDate);
      swVulnDate.setFullYear(swVulnDate.getFullYear() + intervals.eos_to_sw_vulnerability);
      dates.end_of_sw_vulnerability_maintenance_date = this.formatDate(swVulnDate);
      metadata.estimated_fields.end_of_sw_vulnerability = true;
      console.log(`  📅 Estimated SW Vulnerability: ${dates.end_of_sw_vulnerability_maintenance_date}`);
    }
    
    // Estimate Last Day of Support
    if (!dates.last_day_of_support_date) {
      const ldosDate = new Date(eosDate);
      ldosDate.setFullYear(ldosDate.getFullYear() + intervals.eos_to_last_support);
      dates.last_day_of_support_date = this.formatDate(ldosDate);
      metadata.estimated_fields.last_day_of_support = true;
      console.log(`  📅 Estimated LDOS: ${dates.last_day_of_support_date}`);
    }
    
    return dates;
  }

  /**
   * Estimate dates working backwards from Last Day of Support
   */
  estimateFromLDOS(dates, intervals, metadata) {
    const ldosDate = new Date(dates.last_day_of_support_date);
    
    // Estimate End of Sale (5 years before LDOS)
    if (!dates.end_of_sale_date) {
      const eosDate = new Date(ldosDate);
      eosDate.setFullYear(eosDate.getFullYear() - intervals.eos_to_last_support);
      dates.end_of_sale_date = this.formatDate(eosDate);
      metadata.estimated_fields.end_of_sale = true;
      console.log(`  📅 Estimated EOS: ${dates.end_of_sale_date}`);
    }
    
    // Estimate SW Vulnerability (1 year before LDOS)
    if (!dates.end_of_sw_vulnerability_maintenance_date) {
      const swVulnDate = new Date(ldosDate);
      swVulnDate.setFullYear(swVulnDate.getFullYear() - intervals.sw_vulnerability_to_last_support);
      dates.end_of_sw_vulnerability_maintenance_date = this.formatDate(swVulnDate);
      metadata.estimated_fields.end_of_sw_vulnerability = true;
      console.log(`  📅 Estimated SW Vulnerability: ${dates.end_of_sw_vulnerability_maintenance_date}`);
    }
    
    // Estimate SW Maintenance (2 years before LDOS)
    if (!dates.end_of_sw_maintenance_date) {
      const swMaintDate = new Date(ldosDate);
      swMaintDate.setFullYear(swMaintDate.getFullYear() - intervals.sw_maintenance_to_last_support);
      dates.end_of_sw_maintenance_date = this.formatDate(swMaintDate);
      metadata.estimated_fields.end_of_sw_maintenance = true;
      console.log(`  📅 Estimated SW Maintenance: ${dates.end_of_sw_maintenance_date}`);
    }
    
    return dates;
  }

  /**
   * Estimate dates based on SW Maintenance date
   */
  estimateFromSWMaintenance(dates, intervals, metadata) {
    const swMaintDate = new Date(dates.end_of_sw_maintenance_date);
    
    // Estimate End of Sale (3 years before SW Maintenance)
    if (!dates.end_of_sale_date) {
      const eosDate = new Date(swMaintDate);
      eosDate.setFullYear(eosDate.getFullYear() - intervals.eos_to_sw_maintenance);
      dates.end_of_sale_date = this.formatDate(eosDate);
      metadata.estimated_fields.end_of_sale = true;
      console.log(`  📅 Estimated EOS: ${dates.end_of_sale_date}`);
    }
    
    // Estimate SW Vulnerability (1 year after SW Maintenance)
    if (!dates.end_of_sw_vulnerability_maintenance_date) {
      const swVulnDate = new Date(swMaintDate);
      swVulnDate.setFullYear(swVulnDate.getFullYear() + intervals.sw_maintenance_to_sw_vulnerability);
      dates.end_of_sw_vulnerability_maintenance_date = this.formatDate(swVulnDate);
      metadata.estimated_fields.end_of_sw_vulnerability = true;
      console.log(`  📅 Estimated SW Vulnerability: ${dates.end_of_sw_vulnerability_maintenance_date}`);
    }
    
    // Estimate Last Day of Support (2 years after SW Maintenance)
    if (!dates.last_day_of_support_date) {
      const ldosDate = new Date(swMaintDate);
      ldosDate.setFullYear(ldosDate.getFullYear() + intervals.sw_maintenance_to_last_support);
      dates.last_day_of_support_date = this.formatDate(ldosDate);
      metadata.estimated_fields.last_day_of_support = true;
      console.log(`  📅 Estimated LDOS: ${dates.last_day_of_support_date}`);
    }
    
    return dates;
  }

  /**
   * Estimate dates based on SW Vulnerability date
   */
  estimateFromSWVulnerability(dates, intervals, metadata) {
    const swVulnDate = new Date(dates.end_of_sw_vulnerability_maintenance_date);
    
    // Estimate End of Sale (4 years before SW Vulnerability)
    if (!dates.end_of_sale_date) {
      const eosDate = new Date(swVulnDate);
      eosDate.setFullYear(eosDate.getFullYear() - intervals.eos_to_sw_vulnerability);
      dates.end_of_sale_date = this.formatDate(eosDate);
      metadata.estimated_fields.end_of_sale = true;
      console.log(`  📅 Estimated EOS: ${dates.end_of_sale_date}`);
    }
    
    // Estimate SW Maintenance (1 year before SW Vulnerability)
    if (!dates.end_of_sw_maintenance_date) {
      const swMaintDate = new Date(swVulnDate);
      swMaintDate.setFullYear(swMaintDate.getFullYear() - intervals.sw_maintenance_to_sw_vulnerability);
      dates.end_of_sw_maintenance_date = this.formatDate(swMaintDate);
      metadata.estimated_fields.end_of_sw_maintenance = true;
      console.log(`  📅 Estimated SW Maintenance: ${dates.end_of_sw_maintenance_date}`);
    }
    
    // Estimate Last Day of Support (1 year after SW Vulnerability)
    if (!dates.last_day_of_support_date) {
      const ldosDate = new Date(swVulnDate);
      ldosDate.setFullYear(ldosDate.getFullYear() + intervals.sw_vulnerability_to_last_support);
      dates.last_day_of_support_date = this.formatDate(ldosDate);
      metadata.estimated_fields.last_day_of_support = true;
      console.log(`  📅 Estimated LDOS: ${dates.last_day_of_support_date}`);
    }
    
    return dates;
  }

  /**
   * Get vendor-specific intervals or default to standard
   */
  getVendorIntervals(manufacturer) {
    if (!manufacturer) {
      return this.standardIntervals;
    }
    
    const mfgLower = manufacturer.toLowerCase();
    
    // Check for vendor-specific adjustments
    for (const [vendor, adjustments] of Object.entries(this.vendorAdjustments)) {
      if (mfgLower.includes(vendor)) {
        console.log(`📋 Using ${vendor}-specific intervals`);
        return { ...this.standardIntervals, ...adjustments };
      }
    }
    
    // Use standard intervals
    console.log('📋 Using standard industry intervals');
    return this.standardIntervals;
  }

  /**
   * Format date to YYYY-MM-DD
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Generate estimation report for logging/debugging
   */
  generateEstimationReport(product, estimatedProduct) {
    const report = {
      product_id: product.product_id,
      manufacturer: product.manufacturer,
      original_dates: {},
      estimated_dates: {},
      estimation_summary: estimatedProduct.estimation_metadata
    };
    
    const dateFields = [
      'end_of_sale_date',
      'end_of_sw_maintenance_date', 
      'end_of_sw_vulnerability_maintenance_date',
      'last_day_of_support_date'
    ];
    
    for (const field of dateFields) {
      if (product[field]) {
        report.original_dates[field] = product[field];
      }
      if (estimatedProduct[field] && !product[field]) {
        report.estimated_dates[field] = estimatedProduct[field];
      }
    }
    
    return report;
  }

  /**
   * Validate estimated dates for logical consistency
   */
  validateDates(dates) {
    const issues = [];
    
    // Convert to Date objects for comparison
    const dateObjs = {};
    for (const [key, value] of Object.entries(dates)) {
      if (value && key.includes('date')) {
        dateObjs[key] = new Date(value);
      }
    }
    
    // EOS should come before SW Maintenance
    if (dateObjs.end_of_sale_date && dateObjs.end_of_sw_maintenance_date) {
      if (dateObjs.end_of_sale_date >= dateObjs.end_of_sw_maintenance_date) {
        issues.push('EOS date should be before SW Maintenance date');
      }
    }
    
    // SW Maintenance should come before SW Vulnerability
    if (dateObjs.end_of_sw_maintenance_date && dateObjs.end_of_sw_vulnerability_maintenance_date) {
      if (dateObjs.end_of_sw_maintenance_date >= dateObjs.end_of_sw_vulnerability_maintenance_date) {
        issues.push('SW Maintenance date should be before SW Vulnerability date');
      }
    }
    
    // SW Vulnerability should come before LDOS
    if (dateObjs.end_of_sw_vulnerability_maintenance_date && dateObjs.last_day_of_support_date) {
      if (dateObjs.end_of_sw_vulnerability_maintenance_date >= dateObjs.last_day_of_support_date) {
        issues.push('SW Vulnerability date should be before LDOS');
      }
    }
    
    // EOS should come before LDOS
    if (dateObjs.end_of_sale_date && dateObjs.last_day_of_support_date) {
      if (dateObjs.end_of_sale_date >= dateObjs.last_day_of_support_date) {
        issues.push('EOS date should be before LDOS');
      }
    }
    
    if (issues.length > 0) {
      console.warn('⚠️ Date validation issues:', issues);
    }
    
    return issues.length === 0;
  }
}

module.exports = new EnhancedDateEstimation();