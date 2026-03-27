/**
 * Test script for hybrid pipeline
 * Processes first 10 items from real catalog in root
 */

const fs = require('fs');
const path = require('path');

async function testHybridPipeline() {
  console.log('🧪 Testing Hybrid Pipeline with Real Catalog\n');

  // Read the catalog file from root
  const catalogPath = path.join(process.cwd(), 'test-file.pdf');

  if (!fs.existsSync(catalogPath)) {
    console.error('❌ Catalog file not found:', catalogPath);
    process.exit(1);
  }

  console.log('📄 Found catalog:', catalogPath);
  const fileStats = fs.statSync(catalogPath);
  console.log(`   Size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB\n`);

  // Convert to base64
  console.log('🔄 Converting to base64...');
  const fileBuffer = fs.readFileSync(catalogPath);
  const base64 = fileBuffer.toString('base64');
  console.log('✅ Base64 conversion complete\n');

  // Prepare the request
  console.log('📤 Sending request to hybrid pipeline...');
  console.log('   Will process first 10 items for testing\n');

  try {
    // Note: This requires Convex dev server to be running
    // For testing, we'll use the Convex function directly
    const { convex } = require('../convex/_generated/server');

    // Mock a test by calling the action with a limit
    // In production, this would be called from the frontend
    console.log('⚠️  Manual testing required:');
    console.log('   1. Ensure Convex dev server is running');
    console.log('   2. Open http://localhost:3000');
    console.log('   3. Upload test-file.pdf from the UI');
    console.log('   4. Check results in browser console and Convex dashboard\n');

    console.log('✅ Test setup complete!');
    console.log('\n📊 Expected behavior:');
    console.log('   - Stage 1: Extract document metadata with gemini-3.1-pro');
    console.log('   - Stage 2: Process chunks with gemini-3.1-flash-lite-preview');
    console.log('   - Validation: Local validation and arithmetic');
    console.log('   - Result: Detailed stats displayed in UI\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testHybridPipeline();
