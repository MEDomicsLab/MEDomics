/**
 * MEDomicsLab Danfo.js Replacement
 * A lightweight drop-in replacement for danfojs without TensorFlow.js dependencies
 */

// Basic utility functions similar to danfojs Utils
class Utils {
  constructor() {}
  
  /**
   * Convert array-like object to array
   * @param {*} obj - Array-like object
   * @returns {Array}
   */
  toArray(obj) {
    if (Array.isArray(obj)) {
      return obj;
    }
    return Array.from(obj);
  }

  /**
   * Get data types of columns
   * @param {Object} data - Data object
   * @returns {Object} - Column types mapping
   */
  inferDtypes(data) {
    const types = {};
    if (!data || typeof data !== 'object') return types;
    
    Object.keys(data).forEach(key => {
      if (Array.isArray(data[key])) {
        const sample = data[key].find(val => val !== null && val !== undefined);
        if (sample !== undefined) {
          if (typeof sample === 'number') {
            types[key] = 'float32';
          } else if (typeof sample === 'boolean') {
            types[key] = 'boolean';
          } else if (typeof sample === 'string') {
            types[key] = 'string';
          } else if (sample instanceof Date) {
            types[key] = 'datetime';
          } else {
            types[key] = 'object';
          }
        } else {
          types[key] = 'undefined';
        }
      }
    });
    
    return types;
  }

  /**
   * Check if value is NaN
   * @param {*} val - Value to check
   * @returns {boolean}
   */
  isNaN(val) {
    return Number.isNaN(val);
  }

  /**
   * Get unique values from array
   * @param {Array} arr - Input array
   * @returns {Array} - Array with unique values
   */
  unique(arr) {
    return [...new Set(arr)];
  }
}

// Simplified DataFrame class similar to danfojs DataFrame
class DataFrame {
  /**
   * Create DataFrame
   * @param {Object|Array} data - Data object or array
   * @param {Object} options - Additional options
   */
  constructor(data, options = {}) {
    this.options = options;
    this.data = this._processInput(data);
    this.columns = this._getColumns();
    this.index = this._getIndex();
    this.dtypes = this._inferDtypes();
    this.shape = this._getShape();
  }

  /**
   * Process input data
   */
  _processInput(data) {
    if (Array.isArray(data)) {
      if (data.length === 0) return {};
      
      if (Array.isArray(data[0])) {
        // Array of arrays
        const columns = this.options.columns || 
          Array.from({ length: data[0].length }, (_, i) => `Column_${i}`);
        
        return columns.reduce((obj, col, i) => {
          obj[col] = data.map(row => row[i]);
          return obj;
        }, {});
      } else {
        // Array of objects
        const keys = Object.keys(data[0] || {});
        return keys.reduce((obj, key) => {
          obj[key] = data.map(item => item[key]);
          return obj;
        }, {});
      }
    } else if (data && typeof data === 'object') {
      // Object with column arrays
      return { ...data };
    }
    
    return {};
  }

  /**
   * Get column names
   */
  _getColumns() {
    return Object.keys(this.data);
  }

  /**
   * Get index array
   */
  _getIndex() {
    const dataLength = this.data[this.columns[0]]?.length || 0;
    return Array.from({ length: dataLength }, (_, i) => i);
  }

  /**
   * Infer data types
   */
  _inferDtypes() {
    const dfUtils = new Utils();
    return dfUtils.inferDtypes(this.data);
  }

  /**
   * Get shape as [rows, columns]
   */
  _getShape() {
    const rows = this.index.length;
    const cols = this.columns.length;
    return [rows, cols];
  }

  /**
   * Print DataFrame information
   */
  print() {
    console.log(`DataFrame: ${this.shape[0]} rows x ${this.shape[1]} columns`);
    console.log('Columns:', this.columns);
    console.log('Types:', this.dtypes);
    
    // Print first few rows
    const sample = {};
    const rowsToShow = Math.min(5, this.shape[0]);
    
    this.columns.forEach(col => {
      sample[col] = this.data[col].slice(0, rowsToShow);
    });
    
    console.table(sample);
  }

  /**
   * Select specific columns
   * @param {string|Array} columnNames - Column name(s) to select
   * @returns {DataFrame} - New DataFrame with selected columns
   */
  loc({ columns }) {
    const colNames = Array.isArray(columns) ? columns : [columns];
    const newData = {};
    
    colNames.forEach(col => {
      if (this.data[col]) {
        newData[col] = [...this.data[col]];
      }
    });
    
    return new DataFrame(newData);
  }

  /**
   * Get a row or rows by index
   * @param {number|Array} rowIdx - Row index or indices
   * @returns {DataFrame} - New DataFrame with selected rows
   */
  iloc(rowIdx) {
    const newData = {};
    
    if (typeof rowIdx === 'number') {
      // Single row
      this.columns.forEach(col => {
        newData[col] = [this.data[col][rowIdx]];
      });
    } else if (Array.isArray(rowIdx)) {
      // Multiple rows
      this.columns.forEach(col => {
        newData[col] = rowIdx.map(idx => this.data[col][idx]);
      });
    }
    
    return new DataFrame(newData);
  }

  /**
   * Convert DataFrame to Array of Objects
   * @returns {Array} - Array of row objects
   */
  toJSON() {
    return this.index.map(idx => {
      const row = {};
      this.columns.forEach(col => {
        row[col] = this.data[col][idx];
      });
      return row;
    });
  }

  /**
   * Add a new column to the DataFrame
   * @param {string} name - Column name
   * @param {Array} values - Column values
   * @returns {DataFrame} - This DataFrame with added column
   */
  addColumn(name, values) {
    if (values.length !== this.shape[0]) {
      throw new Error(`Length mismatch: Expected ${this.shape[0]} but got ${values.length}`);
    }
    
    this.data[name] = [...values];
    this.columns = this._getColumns();
    this.dtypes = this._inferDtypes();
    this.shape = this._getShape();
    
    return this;
  }

  /**
   * Get column values as array
   * @param {string} column - Column name
   * @returns {Array} - Column values
   */
  column(column) {
    return this.data[column] ? [...this.data[column]] : [];
  }

  /**
   * Replace values in DataFrame
   * @param {*} oldValue - Value to replace
   * @param {*} newValue - Replacement value
   * @returns {DataFrame} - Updated DataFrame
   */
  replace(oldValue, newValue) {
    const newData = {};
    
    this.columns.forEach(col => {
      newData[col] = this.data[col].map(val => 
        val === oldValue ? newValue : val);
    });
    
    return new DataFrame(newData);
  }

  /**
   * Drop columns
   * @param {string|Array} columns - Column(s) to drop
   * @returns {DataFrame} - New DataFrame without specified columns
   */
  drop({ columns }) {
    const colsToDrop = Array.isArray(columns) ? columns : [columns];
    const newData = {};
    
    this.columns.forEach(col => {
      if (!colsToDrop.includes(col)) {
        newData[col] = [...this.data[col]];
      }
    });
    
    return new DataFrame(newData);
  }

  /**
   * Group by column
   * @param {string|Array} columnNames - Column(s) to group by
   * @returns {Object} - GroupBy object with aggregation methods
   */
  groupby(columnNames) {
    const cols = Array.isArray(columnNames) ? columnNames : [columnNames];
    const groups = {};
    
    // Group indices by values in group columns
    this.index.forEach(idx => {
      const key = cols.map(col => this.data[col][idx]).join('|');
      
      if (!groups[key]) {
        groups[key] = [];
      }
      
      groups[key].push(idx);
    });
    
    // Create methods for aggregation
    return {
      groups,
      count: () => {
        const result = {};
        cols.forEach(col => {
          result[col] = [];
        });
        result['count'] = [];
        
        Object.entries(groups).forEach(([key, indices]) => {
          const values = key.split('|');
          cols.forEach((col, i) => {
            result[col].push(values[i]);
          });
          result['count'].push(indices.length);
        });
        
        return new DataFrame(result);
      },
      
      sum: () => {
        const result = {};
        cols.forEach(col => {
          result[col] = [];
        });
        
        // Add sum columns for numeric columns
        const numericCols = this.columns.filter(col => 
          !cols.includes(col) && 
          this.dtypes[col] && 
          ['float32', 'int32', 'number'].includes(this.dtypes[col])
        );
        
        numericCols.forEach(col => {
          result[`${col}_sum`] = [];
        });
        
        Object.entries(groups).forEach(([key, indices]) => {
          const values = key.split('|');
          cols.forEach((col, i) => {
            result[col].push(values[i]);
          });
          
          numericCols.forEach(numCol => {
            const sum = indices.reduce((acc, idx) => acc + (this.data[numCol][idx] || 0), 0);
            result[`${numCol}_sum`].push(sum);
          });
        });
        
        return new DataFrame(result);
      },
      
      mean: () => {
        const result = {};
        cols.forEach(col => {
          result[col] = [];
        });
        
        // Add mean columns for numeric columns
        const numericCols = this.columns.filter(col => 
          !cols.includes(col) && 
          this.dtypes[col] && 
          ['float32', 'int32', 'number'].includes(this.dtypes[col])
        );
        
        numericCols.forEach(col => {
          result[`${col}_mean`] = [];
        });
        
        Object.entries(groups).forEach(([key, indices]) => {
          const values = key.split('|');
          cols.forEach((col, i) => {
            result[col].push(values[i]);
          });
          
          numericCols.forEach(numCol => {
            const sum = indices.reduce((acc, idx) => acc + (this.data[numCol][idx] || 0), 0);
            const mean = indices.length > 0 ? sum / indices.length : 0;
            result[`${numCol}_mean`].push(mean);
          });
        });
        
        return new DataFrame(result);
      }
    };
  }

  /**
   * Sort DataFrame by column values
   * @param {Object} options - Sort options
   * @returns {DataFrame} - Sorted DataFrame
   */
  sort_values({ by, ascending = true }) {
    const columns = Array.isArray(by) ? by : [by];
    const ascValues = Array.isArray(ascending) ? ascending : [ascending];
    
    // Create sorted indices
    const sortedIndices = [...this.index].sort((a, b) => {
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const asc = i < ascValues.length ? ascValues[i] : ascValues[0];
        
        const valA = this.data[col][a];
        const valB = this.data[col][b];
        
        if (valA < valB) return asc ? -1 : 1;
        if (valA > valB) return asc ? 1 : -1;
      }
      return 0;
    });
    
    // Create new data with sorted values
    const sortedData = {};
    this.columns.forEach(col => {
      sortedData[col] = sortedIndices.map(idx => this.data[col][idx]);
    });
    
    return new DataFrame(sortedData);
  }
}

// Export as CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DataFrame,
    Utils,
    read_csv: (filePath, options = {}) => {
      // This is a stub - in a real implementation, you'd need to parse CSV
      console.warn('read_csv is a stub in danfo.js replacement');
      return new DataFrame({});
    },
    read_json: (jsonData, options = {}) => {
      try {
        const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        return new DataFrame(data, options);
      } catch (err) {
        console.error('Error parsing JSON:', err);
        return new DataFrame({});
      }
    }
  };
}

// Also export as ES modules
export { DataFrame, Utils };
export default {
  DataFrame,
  Utils
};