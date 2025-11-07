const logger = require('../config/logger');

class DataProcessor {
  async processInventory(jobId, dbClient) {
    try {
      logger.info(`Processing inventory for job: ${jobId}`);
      
      // Aggregate products from raw_inventory
      const aggregatedData = await dbClient.query(`
        SELECT 
          product_id,
          manufacturer,
          description,
          product_category,
          product_type,
          business_entity,
          asset_type,
          service_contract,
          MIN(purchase_date) as earliest_purchase,
          MAX(purchase_date) as latest_purchase,
          MAX(end_of_sale_date) as end_of_sale_date,
          MAX(last_day_of_support_date) as last_day_of_support_date,
          MAX(end_of_life_date) as end_of_life_date,
          SUM(quantity) as total_quantity,
          SUM(quantity * cost) as total_value,
          COUNT(CASE WHEN support_contract_active = true THEN 1 END) as support_count,
          COUNT(*) as total_records,
          jsonb_object_agg(
            COALESCE(EXTRACT(YEAR FROM purchase_date)::text, 'Unknown'),
            quantity
          ) as quantities_by_year
        FROM raw_inventory
        WHERE job_id = $1
        GROUP BY product_id, manufacturer, description, product_category, 
                 product_type, business_entity, asset_type, service_contract
      `, [jobId]);

      if (aggregatedData.rows.length === 0) {
        throw new Error('No data to aggregate');
      }

      // Insert aggregated analysis
      for (const product of aggregatedData.rows) {
        const lifecycleStatus = this.determineLifecycleStatus(
          product.end_of_sale_date,
          product.last_day_of_support_date,
          product.end_of_life_date
        );
        
        const supportCoverage = product.total_records > 0 
          ? (product.support_count / product.total_records * 100).toFixed(2)
          : 0;

        await dbClient.query(`
          INSERT INTO inventory_analysis (
            job_id, tenant_id, product_id, description, manufacturer,
            product_category, product_type, business_entity, asset_type,
            service_contract, total_quantity, total_value, support_coverage_percent,
            purchase_dates, end_of_sale_date, last_day_of_support_date,
            end_of_life_date, lifecycle_status, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW()
          )`, [
            jobId,
            'default-tenant',
            product.product_id,
            product.description,
            product.manufacturer,
            product.product_category,
            product.product_type,
            product.business_entity,
            product.asset_type,
            product.service_contract,
            product.total_quantity,
            product.total_value,
            supportCoverage,
            product.quantities_by_year,
            product.end_of_sale_date,
            product.last_day_of_support_date,
            product.end_of_life_date,
            lifecycleStatus
          ]);
      }

      const summary = await this.generateSummary(jobId, dbClient);
      logger.info(`Processing complete for job ${jobId}. Aggregated ${aggregatedData.rows.length} products.`);
      return summary;
      
    } catch (error) {
      logger.error('Error processing inventory:', error);
      throw error;
    }
  }

  determineLifecycleStatus(endOfSale, lastSupport, endOfLife) {
    const today = new Date();
    
    if (endOfLife && new Date(endOfLife) < today) {
      return 'End of Life';
    }
    if (lastSupport && new Date(lastSupport) < today) {
      return 'End of Support';
    }
    if (endOfSale && new Date(endOfSale) < today) {
      return 'End of Sale';
    }
    return 'Current';
  }

  async generateSummary(jobId, dbClient) {
    const summary = await dbClient.query(`
      SELECT 
        COUNT(DISTINCT product_id) as unique_products,
        SUM(total_quantity) as total_items,
        SUM(total_value) as total_inventory_value,
        COUNT(CASE WHEN lifecycle_status = 'End of Life' THEN 1 END) as eol_products,
        COUNT(CASE WHEN lifecycle_status = 'End of Support' THEN 1 END) as eos_products
      FROM inventory_analysis 
      WHERE job_id = $1
    `, [jobId]);
    
    return summary.rows[0];
  }
}

module.exports = new DataProcessor();