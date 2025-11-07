// Lifecycle Analysis Service
// Handles analysis logic and calculations for Phase 3

class LifecycleAnalysisService {
  
  // Calculate support coverage percentage based on lifecycle dates
  calculateSupportCoverage(product) {
    const currentDate = new Date();
    
    if (!product.last_day_of_support_date) {
      return product.is_current_product ? 100 : 0;
    }
    
    const ldosDate = new Date(product.last_day_of_support_date);
    const monthsRemaining = Math.floor((ldosDate - currentDate) / (1000 * 60 * 60 * 24 * 30));
    
    if (monthsRemaining <= 0) return 0;
    if (monthsRemaining >= 36) return 100;
    
    // Linear decline over 3 years
    return Math.round((monthsRemaining / 36) * 100);
  }
  
  // Calculate risk score based on lifecycle status
  calculateRiskScore(product) {
    const currentDate = new Date();
    let riskScore = 0;
    
    // Check End of Sale
    if (product.end_of_sale_date) {
      const eosDate = new Date(product.end_of_sale_date);
      if (eosDate <= currentDate) {
        riskScore += 25;
      }
    }
    
    // Check Last Day of Support
    if (product.last_day_of_support_date) {
      const ldosDate = new Date(product.last_day_of_support_date);
      const monthsRemaining = Math.floor((ldosDate - currentDate) / (1000 * 60 * 60 * 24 * 30));
      
      if (monthsRemaining <= 0) {
        riskScore += 50;
      } else if (monthsRemaining <= 6) {
        riskScore += 35;
      } else if (monthsRemaining <= 12) {
        riskScore += 20;
      } else if (monthsRemaining <= 24) {
        riskScore += 10;
      }
    }
    
    // Check SW Vulnerability Support
    if (product.end_of_sw_vulnerability_maintenance_date) {
      const vulnDate = new Date(product.end_of_sw_vulnerability_maintenance_date);
      if (vulnDate <= currentDate) {
        riskScore += 25;
      }
    }
    
    return Math.min(100, riskScore);
  }
  
  // Determine lifecycle status
  getLifecycleStatus(product) {
    const currentDate = new Date();
    
    if (product.is_current_product) {
      return 'Current';
    }
    
    if (product.last_day_of_support_date) {
      const ldosDate = new Date(product.last_day_of_support_date);
      if (ldosDate <= currentDate) {
        return 'End of Life';
      }
    }
    
    if (product.end_of_sale_date) {
      const eosDate = new Date(product.end_of_sale_date);
      if (eosDate <= currentDate) {
        return 'End of Sale';
      }
    }
    
    return 'Active';
  }
  
  // Aggregate statistics for reporting
  aggregateStatistics(products) {
    const stats = {
      total: products.length,
      current: 0,
      endOfLife: 0,
      endOfSale: 0,
      active: 0,
      avgRiskScore: 0,
      avgSupportCoverage: 0,
      criticalRisk: 0,
      highRisk: 0,
      mediumRisk: 0,
      lowRisk: 0
    };
    
    let totalRisk = 0;
    let totalCoverage = 0;
    
    products.forEach(product => {
      const status = this.getLifecycleStatus(product);
      const riskScore = this.calculateRiskScore(product);
      const coverage = this.calculateSupportCoverage(product);
      
      // Status counts
      switch (status) {
        case 'Current':
          stats.current++;
          break;
        case 'End of Life':
          stats.endOfLife++;
          break;
        case 'End of Sale':
          stats.endOfSale++;
          break;
        default:
          stats.active++;
      }
      
      // Risk categories
      if (riskScore >= 75) {
        stats.criticalRisk++;
      } else if (riskScore >= 50) {
        stats.highRisk++;
      } else if (riskScore >= 25) {
        stats.mediumRisk++;
      } else {
        stats.lowRisk++;
      }
      
      totalRisk += riskScore;
      totalCoverage += coverage;
    });
    
    stats.avgRiskScore = products.length > 0 ? Math.round(totalRisk / products.length) : 0;
    stats.avgSupportCoverage = products.length > 0 ? Math.round(totalCoverage / products.length) : 0;
    
    return stats;
  }
  
  // Generate year distribution from raw inventory
  async generateYearDistribution(jobId, productId, db) {
    try {
      const result = await db.query(
        `SELECT 
          EXTRACT(YEAR FROM COALESCE(purchase_date, ship_date)) as year,
          SUM(quantity) as quantity
        FROM raw_inventory
        WHERE job_id = $1 AND UPPER(TRIM(product_id)) = UPPER(TRIM($2))
          AND COALESCE(purchase_date, ship_date) IS NOT NULL
        GROUP BY year
        ORDER BY year`,
        [jobId, productId]
      );
      
      const distribution = {};
      result.rows.forEach(row => {
        distribution[row.year] = parseInt(row.quantity);
      });
      
      return distribution;
    } catch (error) {
      console.error('Error generating year distribution:', error);
      return {};
    }
  }
  
  // Validate lifecycle dates
  validateLifecycleDates(dates) {
    const validationResult = {
      isValid: true,
      errors: []
    };
    
    // Check EOS before LDOS
    if (dates.end_of_sale_date && dates.last_day_of_support_date) {
      const eos = new Date(dates.end_of_sale_date);
      const ldos = new Date(dates.last_day_of_support_date);
      
      if (eos >= ldos) {
        validationResult.isValid = false;
        validationResult.errors.push('End of Sale date must be before Last Day of Support');
      }
    }
    
    // Check SW dates before LDOS
    if (dates.end_of_sw_maintenance_date && dates.last_day_of_support_date) {
      const swMaint = new Date(dates.end_of_sw_maintenance_date);
      const ldos = new Date(dates.last_day_of_support_date);
      
      if (swMaint > ldos) {
        validationResult.isValid = false;
        validationResult.errors.push('SW Maintenance end must be before or equal to Last Day of Support');
      }
    }
    
    return validationResult;
  }
  
  // Estimate missing dates based on industry patterns
  estimateMissingDates(product) {
    const estimated = { ...product };
    
    // If we have LDOS but missing other dates
    if (product.last_day_of_support_date) {
      const ldos = new Date(product.last_day_of_support_date);
      
      // EOS is typically 3-5 years before LDOS
      if (!product.end_of_sale_date) {
        const eos = new Date(ldos);
        eos.setFullYear(eos.getFullYear() - 4);
        estimated.end_of_sale_date = eos.toISOString().split('T')[0];
        estimated.end_of_sale_date_estimated = true;
      }
      
      // SW Maintenance typically ends 1 year before LDOS
      if (!product.end_of_sw_maintenance_date) {
        const swMaint = new Date(ldos);
        swMaint.setFullYear(swMaint.getFullYear() - 1);
        estimated.end_of_sw_maintenance_date = swMaint.toISOString().split('T')[0];
        estimated.sw_maintenance_date_estimated = true;
      }
      
      // SW Vulnerability typically same as SW Maintenance
      if (!product.end_of_sw_vulnerability_maintenance_date) {
        estimated.end_of_sw_vulnerability_maintenance_date = estimated.end_of_sw_maintenance_date;
        estimated.sw_vulnerability_date_estimated = true;
      }
    }
    
    return estimated;
  }
}

module.exports = new LifecycleAnalysisService();