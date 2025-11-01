/**
 * List all memories to see what's actually in Supermemory
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { listMemories } from '../src/lib/supermemory/client';

async function test() {
  console.log('📋 Listing all memories...\n');

  try {
    const result = await listMemories(undefined, undefined, 1, 20);
    console.log(`Found ${result.memories.length} memories`);
    console.log('Pagination:', result.pagination);
    
    if (result.memories.length > 0) {
      console.log('\nFirst few memories:');
      result.memories.slice(0, 5).forEach((mem, i) => {
        console.log(`\n${i + 1}. ID: ${mem.id}`);
        console.log(`   Content: ${mem.content?.substring(0, 100)}...`);
        console.log(`   Tags: ${JSON.stringify(mem.containerTags)}`);
      });
    }
  } catch (error) {
    console.error('❌ Failed:', error);
  }
}

test();
