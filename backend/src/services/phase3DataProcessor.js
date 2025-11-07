/**
 * Phase 3 Data Processor
 * Ensures all required fields are populated for lifecycle reports
 * Fills in missing fields and calculates derived values
 */

class Phase3DataProcessor {
  /**
   * Process Phase 3 results to ensure all report fields are present
   */
  processForReport(phase3Results) {
    if (!Array.isArray(phase3Results)) {
      phase3Results = [phase3Results];
    }

    return phase3Results.map(item => {
      // Process each product
      const processed = { ...item };

      // 1. Ensure all date fields are present
      this.ensureDateFields(processed);

      // 2. Calculate lifecycle status
      processed.lifecycle_status = this.calculateLifecycleStatus(processed);

      // 3. Calculate risk level
      processed.risk_level = this.calculateRiskLevel(processed);

      // 4. Set Phase 3 specific flags
      processed.ai_enhanced = true; // All Phase 3 results are AI-enhanced
      processed.requires_review = this.determineReviewRequired(processed);

      // 5. Ensure confidence scores are present
      this.ensureConfidenceScores(processed);

      // 6. Format data sources for report
      this.formatDataSources(processed);

      return processed;
    });
  }

  /**
   * Ensure all date fields are populated
   */
  ensureDateFields(item) {
    // Map last_day_of_support_date to end_of_life_date if missing
    if (!item.end_of_life_date && item.last_day_of_support_date) {
      item.end_of_life_date = item.last_day_of_support_date;
    }

    // If we have LDOS but it's called something else, map it
    if (!item.last_day_of_support_date && item.last_day_support_date) {
      item.last_day_of_support_date = item.last_day_support_date;
    }

    // Ensure date format consistency (YYYY-MM-DD)
    const dateFields = [
      'end_of_sale_date',
      'last_day_of_support_date',
      'end_of_life_date',
      'end_of_sw_maintenance_date',
      'end_of_sw_vulnerability_maintenance_date',
      'date_introduced'
    ];

    dateFields.forEach(field => {
      if (item[field]) {
        item[field] = this.formatDate(item[field]);
      }
    });
  }

  /**
   * Calculate lifecycle status based on dates
   */
  calculateLifecycleStatus(item) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if product has reached various milestones
    if (item.end_of_life_date || item.last_day_of_support_date) {
      const eolDate = new Date(item.end_of_life_date || item.last_day_of_support_date);
      
      if (eolDate < today) {
        return 'End of Life';
      }
    }

    if (item.end_of_sale_date) {
      const eosDate = new Date(item.end_of_sale_date);
      
      if (eosDate < today) {
        // Product is past End of Sale but not yet End of Life
        return 'End of Support';
      }
      
      // Check if EOS is coming soon (within 6 months)
      const sixMonthsFromNow = new Date(today);
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
      
      if (eosDate <= sixMonthsFromNow) {
        return 'End of Sale';
      }
    }

    // If is_current_product flag is set
    if (item.is_current_product) {
      return 'Current';
    }

    // Default to Current if no end dates are found
    if (!item.end_of_sale_date && !item.end_of_life_date) {
      return 'Current';
    }

    return 'Unknown';
  }

  /**
   * Calculate risk level based on lifecycle dates and status
   */
  calculateRiskLevel(item) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Critical risk: Already End of Life
    if (item.lifecycle_status === 'End of Life') {
      return 'critical';
    }

    // Check time until End of Life
    if (item.end_of_life_date || item.last_day_of_support_date) {
      const eolDate = new Date(item.end_of_life_date || item.last_day_of_support_date);
      const daysUntilEOL = Math.floor((eolDate - today) / (1000 * 60 * 60 * 24));

      if (daysUntilEOL < 0) {
        return 'critical'; // Past EOL
      } else if (daysUntilEOL <= 180) {
        return 'high'; // EOL within 6 months
      } else if (daysUntilEOL <= 365) {
        return 'medium'; // EOL within 1 year
      } else if (daysUntilEOL <= 730) {
        return 'low'; // EOL within 2 years
      }
    }

    // Check time until End of Sale
    if (item.end_of_sale_date) {
      const eosDate = new Date(item.end_of_sale_date);
      const daysUntilEOS = Math.floor((eosDate - today) / (1000 * 60 * 60 * 24));

      if (daysUntilEOS < 0) {
        return 'medium'; // Past EOS but no EOL date
      } else if (daysUntilEOS <= 90) {
        return 'low'; // EOS within 3 months
      }
    }

    // Current products with good support
    if (item.lifecycle_status === 'Current') {
      return 'none';
    }

    // Unknown or insufficient data
    if (!item.end_of_sale_date && !item.end_of_life_date) {
      // If we have low confidence, consider it medium risk
      if (item.overall_confidence < 50) {
        return 'medium';
      }
      return 'low';
    }

    return 'none';
  }

  /**
   * Determine if manual review is required
   */
  determineReviewRequired(item) {
    // Review required if:
    // 1. Low confidence score
    if (item.overall_confidence < 60 || item.lifecycle_confidence < 60) {
      return true;
    }

    // 2. Critical or high risk with low confidence
    if ((item.risk_level === 'critical' || item.risk_level === 'high') && 
        item.overall_confidence < 80) {
      return true;
    }

    // 3. No dates found
    if (!item.end_of_sale_date && !item.end_of_life_date && !item.last_day_of_support_date) {
      return true;
    }

    // 4. Conflicting data
    if (item.end_of_sale_date && item.end_of_life_date) {
      const eosDate = new Date(item.end_of_sale_date);
      const eolDate = new Date(item.end_of_life_date);
      
      // EOL should be after EOS
      if (eolDate < eosDate) {
        return true;
      }
      
      // Typical support period is 3-7 years
      const yearsDiff = (eolDate - eosDate) / (1000 * 60 * 60 * 24 * 365);
      if (yearsDiff < 2 || yearsDiff > 10) {
        return true;
      }
    }

    return false;
  }

  /**
   * Ensure confidence scores are present and properly formatted
   */
  ensureConfidenceScores(item) {
    // Ensure overall_confidence exists
    if (typeof item.overall_confidence === 'undefined' || item.overall_confidence === null) {
      item.overall_confidence = 0;
    }

    // Ensure lifecycle_confidence exists
    if (typeof item.lifecycle_confidence === 'undefined' || item.lifecycle_confidence === null) {
      item.lifecycle_confidence = item.overall_confidence || 0;
    }

    // Ensure they are numbers
    item.overall_confidence = parseFloat(item.overall_confidence) || 0;
    item.lifecycle_confidence = parseFloat(item.lifecycle_confidence) || 0;

    // Cap at 100
    item.overall_confidence = Math.min(100, item.overall_confidence);
    item.lifecycle_confidence = Math.min(100, item.lifecycle_confidence);
  }

  /**
   * Format data sources for report display
   */
  formatDataSources(item) {
    // Ensure data_sources exists and is an array
    if (!item.data_sources) {
      item.data_sources = [];
    }

    // If data_sources is an object (from research), convert to array
    if (typeof item.data_sources === 'object' && !Array.isArray(item.data_sources)) {
      const sources = [];
      
      if (item.data_sources.vendor_site > 0) {
        sources.push({
          type: 'vendor_site',
          count: item.data_sources.vendor_site,
          reliability: 'high',
          accessed_at: new Date().toISOString()
        });
      }
      
      if (item.data_sources.third_party > 0) {
        sources.push({
          type: 'third_party',
          count: item.data_sources.third_party,
          reliability: 'medium',
          accessed_at: new Date().toISOString()
        });
      }
      
      if (item.data_sources.manual_entry > 0) {
        sources.push({
          type: 'manual_entry',
          count: item.data_sources.manual_entry,
          reliability: 'verified',
          accessed_at: new Date().toISOString()
        });
      }
      
      item.data_sources = sources;
    }

    // Add extraction metadata if present
    if (item.extraction_metadata) {
      if (!item.data_sources_metadata) {
        item.data_sources_metadata = item.extraction_metadata;
      }
      delete item.extraction_metadata; // Clean up
    }
  }

  /**
   * Format date to YYYY-MM-DD
   */
  formatDate(dateValue) {
    if (!dateValue) return null;
    
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        return dateValue; // Return as-is if not a valid date
      }
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error(`Error formatting date ${dateValue}:`, error);
      return dateValue;
    }
  }

  /**
   * Calculate summary statistics for Phase 3 report
   */
  calculateStatistics(processedData) {
    const stats = {
      total_products: processedData.length,
      total_quantity: 0,
      total_value: 0,
      avg_support_coverage: 0,
      
      // Phase 2 metrics
      products_eol: 0,
      products_eos: 0,
      products_current: 0,
      products_unknown: 0,
      products_high_risk: 0,
      products_critical_risk: 0,
      overall_risk_score: 0,
      
      // Phase 3 metrics
      products_ai_enhanced: processedData.length, // All Phase 3 are AI-enhanced
      avg_confidence: 0,
      avg_lifecycle_confidence: 0,
      products_requiring_review: 0,
      products_with_vendor_data: 0,
      products_with_dates: 0
    };

    let totalConfidence = 0;
    let totalLifecycleConfidence = 0;
    let riskScoreSum = 0;

    processedData.forEach(item => {
      // Basic metrics
      stats.total_quantity += item.total_quantity || 0;
      stats.total_value += item.total_value || 0;
      
      // Lifecycle status
      switch (item.lifecycle_status) {
        case 'End of Life':
          stats.products_eol++;
          break;
        case 'End of Support':
          stats.products_eos++;
          break;
        case 'Current':
          stats.products_current++;
          break;
        default:
          stats.products_unknown++;
      }
      
      // Risk levels
      if (item.risk_level === 'critical') {
        stats.products_critical_risk++;
        riskScoreSum += 100;
      } else if (item.risk_level === 'high') {
        stats.products_high_risk++;
        riskScoreSum += 75;
      } else if (item.risk_level === 'medium') {
        riskScoreSum += 50;
      } else if (item.risk_level === 'low') {
        riskScoreSum += 25;
      }
      
      // Confidence scores
      totalConfidence += item.overall_confidence || 0;
      totalLifecycleConfidence += item.lifecycle_confidence || 0;
      
      // Review required
      if (item.requires_review) {
        stats.products_requiring_review++;
      }
      
      // Data sources
      if (item.data_sources && Array.isArray(item.data_sources)) {
        const hasVendor = item.data_sources.some(s => s.type === 'vendor_site');
        if (hasVendor) {
          stats.products_with_vendor_data++;
        }
      }
      
      // Has dates
      if (item.end_of_sale_date || item.end_of_life_date || item.last_day_of_support_date) {
        stats.products_with_dates++;
      }
      
      // Support coverage (if available)
      if (item.support_coverage_percentage) {
        stats.avg_support_coverage += parseFloat(item.support_coverage_percentage) || 0;
      }
    });

    // Calculate averages
    if (processedData.length > 0) {
      stats.avg_confidence = totalConfidence / processedData.length;
      stats.avg_lifecycle_confidence = totalLifecycleConfidence / processedData.length;
      stats.overall_risk_score = riskScoreSum / processedData.length;
      
      if (stats.avg_support_coverage > 0) {
        stats.avg_support_coverage = stats.avg_support_coverage / processedData.length;
      }
    }

    // Round to reasonable precision
    stats.avg_confidence = Math.round(stats.avg_confidence * 10) / 10;
    stats.avg_lifecycle_confidence = Math.round(stats.avg_lifecycle_confidence * 10) / 10;
    stats.overall_risk_score = Math.round(stats.overall_risk_score * 10) / 10;
    stats.avg_support_coverage = Math.round(stats.avg_support_coverage * 10) / 10;

    return stats;
  }
}

module.exports = new Phase3DataProcessor();

/**
 * Usage in Phase 3 Controller:
 * 
 * const phase3DataProcessor = require('./phase3DataProcessor');
 * 
 * // After AI research completes:
 * const rawResults = await researchService.performResearch(product);
 * const processedResults = phase3DataProcessor.processForReport(rawResults);
 * 
 * // Store processedResults in phase3_analysis table
 * // These results will have all required fields for report generation
 */