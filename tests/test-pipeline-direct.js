/**
 * Direct backend test for hybrid pipeline
 * Tests with real catalog from root directory
 */

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🧪 Testing Hybrid Pipeline Backend\n');

  // Read catalog
  const catalogPath = path.join(__dirname, '../test-file.pdf');

  if (!fs.existsSync(catalogPath)) {
    console.error('❌ Catalog not found:', catalogPath);
    process.exit(1);
  }

  console.log('📄 Reading catalog...');
  const fileBuffer = fs.readFileSync(catalogPath);
  const base64 = fileBuffer.toString('base64');
  console.log(`✅ File loaded: ${(fileBuffer.size / 1024 / 1024).toFixed(2)} MB\n`);

  // Import Convex client
  const { ConvexHttpClient } = require('convex/browser');
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || 'https://clean-mammoth-892.convex.cloud';
  const client = new ConvexHttpClient(convexUrl);

  console.log('📤 Calling hybrid pipeline action...');
  console.log('⏱️  This may take 1-2 minutes...\n');

  try {
    const startTime = Date.now();

    // Call the ingest action
    const result = await client.action('ingest/ingestCatalog', {
      fileBase64: base64,
      mimeType: 'application/pdf',
    });

    const duration = Date.now() - startTime;

    // Display results
    console.log('\n✅ Pipeline Complete!\n');
    console.log('📊 Results:');
    console.log(`   - Processed: ${result.processed} products`);
    console.log(`   - Needs Review: ${result.needsReview}`);
    console.log(`   - Failed Chunks: ${result.failedChunks.length}`);
    console.log(`   - Total Chunks: ${result.totalChunks}`);
    console.log(`   - Duration: ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`   - Actual Time: ${(duration / 1000).toFixed(1)}s\n`);

    console.log('📄 Document Metadata:');
    console.log(`   - Type: ${result.metadata.documentType}`);
    console.log(`   - Pages: ${result.metadata.pages}`);
    console.log(`   - Sections: ${result.metadata.sections}`);
    console.log(`   - Ambiguities: ${result.metadata.ambiguities}\n`);

    if (result.failedChunks.length > 0) {
      console.log('⚠️  Failed chunks:', result.failedChunks.join(', '));
    }

    if (result.needsReview > 0) {
      console.log(`⚠️  ${result.needsReview} products require review`);
    }

    // Verify success
    if (result.processed > 0) {
      console.log('\n✅ TEST PASSED: Pipeline processed products successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ TEST FAILED: No products processed');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
