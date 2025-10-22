# Supermemory Integration

QuipeAI's spatiotemporal knowledge graph powered by Supermemory.

## Overview

This module provides the core client library for managing spatiotemporal zones and user context using Supermemory's vector database and semantic search capabilities.

## Files

- **`client.ts`** - Core Supermemory client with all CRUD operations
- **`test-client.ts`** - Unit tests for the client library

## Setup

1. Add your Supermemory API key to `.env.local`:
```bash
SUPERMEMORY_API_KEY=sm_your_api_key_here
```

2. The client is automatically initialized with the API key from environment variables.

## Usage

```typescript
import {
  addMemory,
  searchMemories,
  listMemories,
  deleteMemory,
  bulkDeleteByTags,
} from '@/lib/supermemory/client';

// Add a business memory to a zone
await addMemory(
  'Amazing Hair Studio - Great haircuts and styling',
  ['zone_17.485_78.366_1km_2025-10-23_14', 'business_12345'],
  {
    businessName: 'Amazing Hair Studio',
    type: 'salon',
    price: 500,
    rating: 4.5,
    services: ['haircut', 'styling', 'coloring'],
  }
);

// Search for businesses in a zone
const results = await searchMemories(
  'affordable salon haircut',
  ['zone_17.485_78.366_1km_2025-10-23_14'],
  {
    AND: [
      {
        key: 'price',
        value: '600',
        filterType: 'numeric',
        numericOperator: '<=',
      },
    ],
  },
  10
);

// Delete expired zone
await bulkDeleteByTags(['zone_17.485_78.366_1km_2025-10-23_08']);
```

## Container Tags

Container tags are used to organize memories into logical groups:

- **Zone tags**: `zone_{lat}_{lng}_{gridSize}_{date}_{hourWindow}`
  - Example: `zone_17.485_78.366_1km_2025-10-23_14`
  - Represents a 1km grid cell active from 14:00-20:00

- **User tags**: `user_{userId}`
  - Example: `user_abc123`
  - Persistent user preferences and context

- **Business tags**: `business_{businessId}`
  - Example: `business_salon_456`
  - Links memories to specific businesses

## Metadata Fields

Metadata is searchable and filterable:

```typescript
{
  businessName: string;
  type: 'salon' | 'restaurant' | 'spa' | 'gym' | ...;
  price: number;              // Average price
  rating: number;             // 0-5 scale
  services: string[];         // Array of services
  location: string;           // Address
  hours: string;              // Business hours
  amenities: string[];        // Features
  verified: boolean;          // Verification status
}
```

## Testing

### Unit Tests

Run the comprehensive unit tests:

```bash
# With environment variables
SUPERMEMORY_API_KEY=your_key npx tsx src/lib/supermemory/test-client.ts

# Or if .env.local is configured
npx tsx src/lib/supermemory/test-client.ts
```

Expected output:
- ✅ Zone utilities: 9/9 tests passed
- ✅ Client functions: 5/5 tests passed

### Salon Scenario Test

Run the complete end-to-end salon discovery scenario:

```bash
SUPERMEMORY_API_KEY=your_key npx tsx src/lib/supermemory/test-salon-scenario.ts
```

This test simulates:
1. Business owner onboards "Amazing Hair Studio" in Banjara Hills
2. User Sarah searches for "affordable salon haircut"
3. System resolves zones and performs spatiotemporal search
4. User views and books appointment
5. Interactions tracked in user context
6. Zone expires after 6 hours, cleanup runs
7. User data persists (never expires)

## Important Notes

1. **Async Processing**: Supermemory processes memories asynchronously. Newly added memories may not appear in search/list results immediately (status: "queued").

2. **Container Tags Array**: The SDK supports `containerTags` as an array, allowing memories to belong to multiple groups.

3. **Bulk Delete**: The `bulkDeleteByTags()` function uses a direct API call since the SDK doesn't have a bulk delete method yet.

4. **Error Handling**: All functions include proper error handling and logging for monitoring.

## Architecture

This client library is the foundation for:
- Zone lifecycle management
- User context tracking
- Business onboarding
- Spatiotemporal search
- Automated cleanup jobs

See `SUPERMEMORY_INTEGRATION_PLAN.md` in the root directory for the full implementation roadmap.
