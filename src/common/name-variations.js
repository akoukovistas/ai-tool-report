/**
 * Name variations utilities for user matching
 * 
 * This module loads name variations from external JSON configuration
 * and provides utilities for matching users across different systems
 * (GitHub, Cursor, organizational data).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Get the directory of this module and locate config
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load name groups from JSON configuration
let NAME_GROUPS;
try {
  const configPath = path.join(__dirname, '../config/name-groups.json');
  NAME_GROUPS = JSON.parse(readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error(
    `Failed to load name groups configuration from "${path.join(__dirname, '../config/name-groups.json')}".\n` +
    `Error: ${error.message}\n` +
    'Please ensure that the file exists and is a valid JSON array of name groups.\n' +
    'Setup instructions: Create a "name-groups.json" file in the "src/config" directory with the required name groups. Refer to the documentation for the expected format.'
  );
  // Fallback to empty array if configuration fails to load
  NAME_GROUPS = [];
}

/**
 * Generate bidirectional name variations mapping
 * Each name maps to an array of all its variations (excluding itself)
 * 
 * @returns {Object} Mapping of name -> array of variations
 */
function generateNameVariations() {
  const variations = {};
  
  for (const group of NAME_GROUPS) {
    for (const name of group) {
      // Map each name to all other names in its group
      variations[name.toLowerCase()] = group
        .filter(n => n.toLowerCase() !== name.toLowerCase())
        .map(n => n.toLowerCase());
    }
  }
  
  return variations;
}

/**
 * Check if two names are variations of each other
 * 
 * @param {string} name1 - First name to compare
 * @param {string} name2 - Second name to compare
 * @returns {boolean} True if names are variations of each other
 */
function areNameVariations(name1, name2) {
  if (!name1 || !name2) return false;
  
  const normalizedName1 = name1.toLowerCase().trim();
  const normalizedName2 = name2.toLowerCase().trim();
  
  // Exact match
  if (normalizedName1 === normalizedName2) return true;
  
  // Check if name2 is a variation of name1
  const variations1 = NAME_VARIATIONS[normalizedName1];
  if (variations1 && variations1.includes(normalizedName2)) return true;
  
  // Check if name1 is a variation of name2
  const variations2 = NAME_VARIATIONS[normalizedName2];
  if (variations2 && variations2.includes(normalizedName1)) return true;
  
  return false;
}

/**
 * Get all variations for a given name
 * 
 * @param {string} name - Name to get variations for
 * @returns {string[]} Array of name variations (excluding the input name)
 */
function getNameVariations(name) {
  if (!name) return [];
  
  const normalizedName = name.toLowerCase().trim();
  return NAME_VARIATIONS[normalizedName] || [];
}

/**
 * Get the canonical (first) name for a given name or variation
 * 
 * @param {string} name - Name to get canonical form for
 * @returns {string} Canonical name, or the input name if no group found
 */
function getCanonicalName(name) {
  if (!name) return name;
  
  const normalizedName = name.toLowerCase().trim();
  
  // Find the group that contains this name
  for (const group of NAME_GROUPS) {
    if (group.some(n => n.toLowerCase() === normalizedName)) {
      return group[0]; // Return the first (canonical) name in the group
    }
  }
  
  return name; // Return original if no group found
}

// Generate the variations mapping
export const NAME_VARIATIONS = generateNameVariations();

// Export utility functions
export {
  areNameVariations,
  getNameVariations,
  getCanonicalName,
  NAME_GROUPS
};
