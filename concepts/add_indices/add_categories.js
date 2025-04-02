/**
 * This is a javascript transformation function for extracting hierarchical categories
 * and generating additional categories in the Algolia category index.
 * @param {SourceRecord} record - Represent one item from your dataset - Type is inferred from the input record.
 * @param {Helper} helper - Use it to reference Secrets and get Metadata.
 * @returns {SourceRecord|Array<SourceRecord>} - Return a record or an array of records.
 */
async function transform(record, helper) {
    const config = {
      apiKey: "API_KEY",
      applicationId: "APP_ID"
    };
  
    const indexName = "ecommerce_transformed";
    const attributesToRetrieve = ["author", "title", "content"];
  
    // Skip processing if the record doesn't have hierarchical categories
    if (!record.hierarchical_categories) {
      return; // Return original record unchanged if no categories exist
    }
  
    // Extract categories from the actual record (not testRecord)
    const categories = extractCategories(record.hierarchical_categories);
    console.log(categories)
    // Create category records for each extracted category
    const categoryRecords = generateCategoryRecords(categories, record.i18n);
  
    // Check and add each category record to the Algolia index
    for (const categoryRecord of categoryRecords) {
      await checkAndAddObject(categoryRecord, indexName, attributesToRetrieve, config);
    }
  
    // Return the generated category records
    return;
  }
  
  /**
   * Adds an object to the specified Algolia index
   * @param {Object} item - The item to add to the index
   * @param {string} indexName - The name of the index
   * @param {Object} config - The configuration object with API key and application ID
   * @returns {Object} - The API response
   */
  async function addObject(item, indexName, config) {
    const apiUrl = `https://${config.applicationId}.algolia.net/1/indexes/${indexName}`;
    const requestBody = item;
  
    console.log(`Adding object to index: ${indexName}`);
  
    let response = {};
    try {
      const algoliaResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Algolia-API-Key': config.apiKey,
          'X-Algolia-Application-ID': config.applicationId
        },
        body: JSON.stringify(requestBody)
      });
  
      if (!algoliaResponse.ok) {
        const errorData = await algoliaResponse.json();
        throw new Error('Algolia API error: ' + JSON.stringify(errorData));
      }
  
      response = await algoliaResponse.json();
    } catch (error) {
      console.error('Error calling Algolia API:', error);
      response = { error: error.message };
    }
  
    return response;
  }
  
  /**
   * Gets an object by ID from the specified Algolia index
   * @param {string} objectID - The ID of the object to retrieve
   * @param {string} indexName - The name of the index
   * @param {Array<string>} attributesToRetrieve - The attributes to retrieve
   * @param {Object} config - The configuration object with API key and application ID
   * @returns {Object} - The API response
   */
  async function getObjectByID(objectID, indexName, attributesToRetrieve, config) {
    // Construct the API URL for getting specific objects
    const apiUrl = `https://${config.applicationId}.algolia.net/1/indexes/*/objects`;
  
    // Construct the request body
    const requestBody = {
      requests: [
        {
          objectID: objectID,
          indexName: indexName,
          attributesToRetrieve: attributesToRetrieve
        }
      ]
    };
  
    let response = {};
    try {
      const algoliaResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Algolia-API-Key': config.apiKey,
          'X-Algolia-Application-ID': config.applicationId
        },
        body: JSON.stringify(requestBody)
      });
  
      if (!algoliaResponse.ok) {
        const errorData = await algoliaResponse.json();
        throw new Error('Algolia API error: ' + JSON.stringify(errorData));
      }
  
      response = await algoliaResponse.json();
    } catch (error) {
      console.error('Error calling Algolia API:', error);
      response = { error: error.message };
    }
  
    return response;
  }
  
  /**
   * Checks if an object exists in the index and adds it if it doesn't
   * @param {Object} item - The item to check and potentially add
   * @param {string} indexName - The name of the index
   * @param {Array<string>} attributesToRetrieve - The attributes to retrieve
   * @param {Object} config - The configuration object with API key and application ID
   * @returns {Object} - An object with the check response, add response, and whether the item was added
   */
  async function checkAndAddObject(item, indexName, attributesToRetrieve, config) {
    // Check if object exists
    const checkResponse = await getObjectByID(item.objectID, indexName, attributesToRetrieve, config);
  
    let addResponse = null;
    let wasAdded = false;
  
    // If results is empty or has an error, add the object
    if (!checkResponse.results || checkResponse.results.length === 0 || checkResponse.error) {
      console.log("Object not found. Adding to Algolia index.");
      addResponse = await addObject(item, indexName, config);
      wasAdded = true;
    } else {
      console.log("Object already exists in Algolia index.");
    }
  
    return {
      checkResponse,
      addResponse,
      wasAdded
    };
  }
  
  /**
   * Extracts all unique categories from the hierarchical structure
   * @param {Object} hierarchicalCategories - The hierarchical categories object
   * @returns {Array<Object>} - Array of category objects with level and path information
   */
  function extractCategories(hierarchicalCategories) {
    const categories = [];
  
    // Get all levels (lvl0, lvl1, lvl2, etc.)
    const levels = Object.keys(hierarchicalCategories).filter(key => key.startsWith('lvl'));
  
    // Sort levels numerically
    levels.sort((a, b) => parseInt(a.substring(3)) - parseInt(b.substring(3)));
  
    // Extract each category with its level and full path
    levels.forEach(level => {
      const levelNum = parseInt(level.substring(3));
      const fullPath = hierarchicalCategories[level];
  
      // Skip if this category path is empty
      if (!fullPath) return;
  
      // Add this category with its metadata
      categories.push({
        level: levelNum,
        fullPath: fullPath,
        name: extractCategoryNameFromPath(fullPath, levelNum),
        parent: levelNum > 0 ? hierarchicalCategories[`lvl${levelNum - 1}`] : null
      });
    });
  
    return categories;
  }
  
  /**
   * Extracts the category name from a full path based on level
   * @param {string} fullPath - The full category path (e.g., "Women > Shoes > Loafers")
   * @param {number} level - The level of the category
   * @returns {string} - The category name
   */
  function extractCategoryNameFromPath(fullPath, level) {
    const parts = fullPath.split(' > ');
    return parts[level];
  }
  
  /**
   * Generates category records for the category index
   * @param {Array<Object>} categories - Array of extracted categories
   * @param {Object} i18n - Internationalization data if available
   * @returns {Array<Object>} - Array of category records for the index
   */
  function generateCategoryRecords(categories, i18n) {
    return categories.map(category => {
      const categoryRecord = {
        objectID: `category-${category.fullPath.replace(/\s+>\s+/g, '-').toLowerCase()}`,
        name: category.name,
        path: category.fullPath,
        level: category.level,
        isLeaf: true, // Will update this below
        parent: category.parent
      };
  
      // Check if this category is a parent of any other category
      const isParent = categories.some(c => c.parent === category.fullPath);
      if (isParent) {
        categoryRecord.isLeaf = false;
      }
  
      return categoryRecord;
    });
  }