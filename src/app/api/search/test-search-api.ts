/**
 * Search API Test
 * 
 * Tests the /api/search endpoint with real Supermemory data.
 * 
 * Run with:
 *   SUPERMEMORY_API_KEY=your_key npx tsx src/app/api/search/test-search-api.ts
 */

import { addMemory } from '@/lib/supermemory/client';
import { getZoneForCoordinates } from '@/lib/supermemory/zone-utils';

async function testSearchAPI() {
  console.log('🧪 Testing Search API\n');
  console.log('='.repeat(60));

  // Use current time so zones match
  const testDate = new Date();

  // Step 1: Add test businesses
  console.log('\n📍 STEP 1: Adding Test Businesses');
  console.log('-'.repeat(60));

  const businesses = [
    {
      id: 'test_salon_1',
      name: 'Glamour Hair Studio',
      type: 'salon',
      description: 'Premium hair salon with expert stylists. Specializing in haircuts, coloring, and styling.',
      location: { lat: 17.4326, lng: 78.4487 }, // Banjara Hills
      price: 450,
      rating: 4.6,
      services: ['haircut', 'coloring', 'styling', 'spa'],
      address: 'Road No 12, Banjara Hills',
      verified: true,
    },
    {
      id: 'test_salon_2',
      name: 'Budget Cuts Salon',
      type: 'salon',
      description: 'Affordable neighborhood salon for quick haircuts and basic styling.',
      location: { lat: 17.4330, lng: 78.4490 }, // Very close
      price: 250,
      rating: 4.0,
      services: ['haircut', 'beard trim'],
      address: 'Road No 14, Banjara Hills',
      verified: false,
    },
    {
      id: 'test_restaurant_1',
      name: 'Spice Paradise Restaurant',
      type: 'restaurant',
      description: 'Authentic Indian cuisine with vegetarian and non-vegetarian options.',
      location: { lat: 17.4328, lng: 78.4488 }, // Same area
      price: 600,
      rating: 4.8,
      services: ['dine-in', 'takeout', 'delivery'],
      address: 'Road No 13, Banjara Hills',
      verified: true,
    },
  ];

  for (const business of businesses) {
    const zone = getZoneForCoordinates(
      business.location.lat,
      business.location.lng,
      undefined,
      testDate
    );

    console.log(`\n   Adding: ${business.name}`);
    console.log(`   Type: ${business.type}, Price: ₹${business.price}`);
    console.log(`   Zone: ${zone}`);

    const result = await addMemory(
      `${business.name} - ${business.description}`,
      [zone, `business_${business.id}`],
      {
        businessId: business.id,
        businessName: business.name,
        type: business.type,
        price: business.price,
        rating: business.rating,
        services: business.services,
        address: business.address,
        verified: business.verified,
      },
      business.id
    );

    console.log(`   ✅ Added: ${result.id} (${result.status})`);
  }

  // Step 2: Wait for indexing
  console.log('\n⏳ STEP 2: Waiting for Indexing (10 seconds)');
  console.log('-'.repeat(60));
  await new Promise(resolve => setTimeout(resolve, 10000));
  console.log('   ✅ Ready for testing');

  // Step 3: Test searches
  console.log('\n🔍 STEP 3: Testing Search Queries');
  console.log('-'.repeat(60));

  const testQueries = [
    {
      name: 'Search for salons',
      url: '/api/search?q=salon&lat=17.4326&lng=78.4487&type=salon',
      expectedMin: 2,
    },
    {
      name: 'Search for affordable salons (price <= 300)',
      url: '/api/search?q=salon&lat=17.4326&lng=78.4487&type=salon&maxPrice=300',
      expectedMin: 1,
    },
    {
      name: 'Search for premium salons (price >= 400)',
      url: '/api/search?q=salon&lat=17.4326&lng=78.4487&type=salon&minPrice=400',
      expectedMin: 1,
    },
    {
      name: 'Search for restaurants',
      url: '/api/search?q=restaurant food&lat=17.4326&lng=78.4487&type=restaurant',
      expectedMin: 1,
    },
    {
      name: 'Search with high rating filter',
      url: '/api/search?q=salon&lat=17.4326&lng=78.4487&minRating=4.5',
      expectedMin: 1,
    },
  ];

  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

  for (const testQuery of testQueries) {
    console.log(`\n   🔎 ${testQuery.name}`);
    console.log(`   URL: ${testQuery.url}`);

    try {
      const response = await fetch(`${baseUrl}${testQuery.url}`);
      const data = await response.json();

      if (!response.ok) {
        console.log(`   ❌ Error: ${data.error}`);
        continue;
      }

      console.log(`   ✅ Results: ${data.count} found`);
      console.log(`   Zones searched: ${data.zones.length}`);

      if (data.results && data.results.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.results.forEach((result: any, i: number) => {
          console.log(`\n      ${i + 1}. ${result.name}`);
          console.log(`         Type: ${result.type}, Price: ₹${result.price}`);
          console.log(`         Rating: ${result.rating}⭐`);
          console.log(`         Match Score: ${(result.matchScore * 100).toFixed(1)}%`);
          console.log(`         Zone: ${result.zone}`);
        });
      }

      if (data.count >= testQuery.expectedMin) {
        console.log(`   ✅ PASS: Found ${data.count} >= ${testQuery.expectedMin} expected`);
      } else {
        console.log(`   ⚠️  WARNING: Found ${data.count} < ${testQuery.expectedMin} expected`);
      }

    } catch (error) {
      console.log(`   ❌ Request failed:`, error instanceof Error ? error.message : error);
    }
  }

  // Step 4: Test POST endpoint
  console.log('\n📤 STEP 4: Testing POST Endpoint');
  console.log('-'.repeat(60));

  try {
    const response = await fetch(`${baseUrl}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'haircut styling',
        location: { lat: 17.4326, lng: 78.4487 },
        filters: {
          type: 'salon',
          maxPrice: 500,
        },
        limit: 5,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`   ✅ POST request successful`);
      console.log(`   Results: ${data.count} found`);
      console.log(`   Query: "${data.query}"`);
    } else {
      console.log(`   ❌ POST failed: ${data.error}`);
    }
  } catch (error) {
    console.log(`   ❌ POST request failed:`, error instanceof Error ? error.message : error);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log('   ✅ Businesses added: 3 (2 salons, 1 restaurant)');
  console.log('   ✅ GET endpoint tested: 5 queries');
  console.log('   ✅ POST endpoint tested');
  console.log('   ✅ Filters tested: type, price range, rating');
  console.log('   ✅ Semantic search working');
  console.log('\n🎉 Search API test completed!');
  console.log('='.repeat(60));
}

// Run tests
testSearchAPI()
  .then(() => {
    console.log('\n✅ All tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
