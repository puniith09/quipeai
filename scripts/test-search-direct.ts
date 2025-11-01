/**
 * Direct test of searchBusinesses function
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { searchBusinesses } from '../src/lib/ai-tools';

async function test() {
  console.log('🔍 Testing searchBusinesses function directly...\n');

  const args = {
    query: 'salon',
    location: { lat: 17.433, lng: 78.449 }, // Original coords (will normalize to 17.438, 78.448)
    businessType: 'salon',
    limit: 10,
    suggestedComponents: ['card', 'text']
  };

  console.log('Search args:', JSON.stringify(args, null, 2));

  try {
    const result = await searchBusinesses(args, 'test-user-123');
    console.log('\n✅ Search completed!');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n❌ Search failed:', error);
  }
}

test();
