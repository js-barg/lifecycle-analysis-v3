// backend/src/utils/columnMapper.js

const normalizeSupport = (value) => {
  if (!value || value === '' || value === null || value === undefined) {
    return 'Expired';
  }
  
  const strValue = value.toString().trim();
  const upperValue = strValue.toUpperCase();
  
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

const processData = (data) => {
  return data.map((row, index) => {
    return {
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
        
        if (coveredLineStatus) {
          return normalizeSupport(coveredLineStatus);
        }
        
        if (coverage) {
          return normalizeSupport(coverage);
        }
        
        return 'Expired';
      })(),
      end_of_sale: row['End of Product Sale Date'] || row['End of Product Sale'] || row.end_of_sale || row.end_of_product_sale || '-',
      last_day_support: row['Last Date of Support'] || row.last_day_support || row.last_date_of_support || row['Last Support'] || '-'
    };
  });
};

module.exports = {
  processData
};