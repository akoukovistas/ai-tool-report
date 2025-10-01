import { createInterface } from 'readline';
import fs from 'fs';

/**
 * Prompt user for input
 * @param {string} question - Question to ask the user
 * @returns {Promise<string>} User's response
 */
export function promptUser(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Check if file exists and prompt user for overwrite confirmation
 * @param {string} filePath - Path to the file to check
 * @param {string} fileType - Description of the file type (e.g., "Active Users Report")
 * @returns {Promise<boolean>} True if should proceed (file doesn't exist or user confirmed overwrite)
 */
export async function checkAndPromptOverwrite(filePath, fileType) {
  if (!fs.existsSync(filePath)) {
    return true; // File doesn't exist, proceed
  }

  // Get file modification time
  const stats = fs.statSync(filePath);
  const lastModified = stats.mtime.toLocaleString();
  
  console.log(`\n⚠️  ${fileType} already exists:`);
  console.log(`   📄 File: ${filePath}`);
  console.log(`   🕒 Last modified: ${lastModified}`);
  
  const response = await promptUser('   Do you want to overwrite it? (y/N): ');
  
  return response.toLowerCase() === 'y' || response.toLowerCase() === 'yes';
}

/**
 * Check multiple files and prompt for overwrite confirmation
 * @param {Array<{path: string, type: string}>} files - Array of files to check
 * @returns {Promise<boolean>} True if should proceed with all files
 */
export async function checkAndPromptMultipleOverwrite(files) {
  const existingFiles = files.filter(file => fs.existsSync(file.path));
  
  if (existingFiles.length === 0) {
    return true; // No existing files, proceed
  }

  console.log(`\n⚠️  The following reports already exist:`);
  existingFiles.forEach(file => {
    const stats = fs.statSync(file.path);
    const lastModified = stats.mtime.toLocaleString();
    console.log(`   📄 ${file.type}: ${file.path} (modified: ${lastModified})`);
  });
  
  const response = await promptUser(`\n   Do you want to overwrite ${existingFiles.length === 1 ? 'it' : 'them all'}? (y/N): `);
  
  return response.toLowerCase() === 'y' || response.toLowerCase() === 'yes';
}
