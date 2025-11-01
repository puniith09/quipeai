/**
 * Seed Supermemory with Sample Business Data
 * 
 * Run this script to populate Supermemory with test business data
 * for different zones and business types.
 */

// Load environment variables FIRST before any imports
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { addMemory } from '../src/lib/supermemory/client';
import { getZoneForCoordinates } from '../src/lib/supermemory/zone-utils';

// Sample locations - using coordinates near the app's default location (17.433, 78.449)
// This ensures businesses are in the same zone as searches
const locations = {
  banjaraHills: { lat: 17.433, lng: 78.449 },  // Main location
  hitech: { lat: 17.435, lng: 78.451 },       // Nearby
  kondapur: { lat: 17.431, lng: 78.447 },     // Nearby
  gachibowli: { lat: 17.437, lng: 78.450 },   // Nearby
  madhapur: { lat: 17.434, lng: 78.448 },     // Nearby
};

// Sample businesses
const businesses = [
  // Salons
  {
    name: "Luxury Hair Studio",
    type: "salon",
    location: locations.banjaraHills,
    description: "Premium hair salon offering haircuts, styling, coloring, and spa treatments. Expert stylists with 10+ years experience.",
    services: ["haircut", "coloring", "styling", "spa", "bridal makeup"],
    priceMin: 500,
    priceMax: 5000,
    phone: "+91 9876543210",
    address: "Road No. 12, Banjara Hills, Hyderabad",
    rating: 4.7,
  },
  {
    name: "Glow Beauty Salon",
    type: "salon",
    location: locations.kondapur,
    description: "Modern unisex salon specializing in hair care, facials, and beauty treatments. Walk-ins welcome.",
    services: ["haircut", "facial", "waxing", "manicure", "pedicure"],
    priceMin: 300,
    priceMax: 3000,
    phone: "+91 9876543211",
    address: "Kondapur Main Road, Hyderabad",
    rating: 4.5,
  },
  {
    name: "Style Studio",
    type: "salon",
    location: locations.hitech,
    description: "Trendy salon with latest hair styling techniques, keratin treatments, and hair spa services.",
    services: ["haircut", "keratin treatment", "hair spa", "highlights"],
    priceMin: 400,
    priceMax: 4000,
    phone: "+91 9876543212",
    address: "Cyber Towers, Hitech City, Hyderabad",
    rating: 4.6,
  },
  
  // Restaurants
  {
    name: "Spice Garden",
    type: "restaurant",
    location: locations.banjaraHills,
    description: "Fine dining Indian restaurant with authentic North Indian and Mughlai cuisine. Romantic ambiance perfect for dates.",
    services: ["fine dining", "north indian", "mughlai", "tandoor"],
    priceMin: 800,
    priceMax: 2500,
    phone: "+91 9876543220",
    address: "Road No. 1, Banjara Hills, Hyderabad",
    rating: 4.8,
  },
  {
    name: "The Biryani House",
    type: "restaurant",
    location: locations.gachibowli,
    description: "Famous for authentic Hyderabadi biryani and traditional dishes. Family-friendly atmosphere with quick service.",
    services: ["biryani", "hyderabadi cuisine", "takeaway", "delivery"],
    priceMin: 300,
    priceMax: 1200,
    phone: "+91 9876543221",
    address: "Gachibowli Main Road, Hyderabad",
    rating: 4.7,
  },
  {
    name: "Cafe Delight",
    type: "restaurant",
    location: locations.madhapur,
    description: "Cozy cafe serving continental cuisine, pizzas, pastas, and specialty coffees. Great for casual meetings.",
    services: ["continental", "pizza", "pasta", "coffee", "desserts"],
    priceMin: 250,
    priceMax: 1000,
    phone: "+91 9876543222",
    address: "Madhapur Circle, Hyderabad",
    rating: 4.4,
  },

  // Gyms
  {
    name: "FitZone Gym",
    type: "gym",
    location: locations.hitech,
    description: "State-of-the-art fitness center with modern equipment, personal trainers, and group classes. 24/7 access.",
    services: ["gym", "personal training", "yoga", "zumba", "cardio"],
    priceMin: 2000,
    priceMax: 10000,
    phone: "+91 9876543230",
    address: "Hitech City Road, Hyderabad",
    rating: 4.6,
  },
  {
    name: "PowerHouse Fitness",
    type: "gym",
    location: locations.kondapur,
    description: "Premium gym with CrossFit area, swimming pool, and nutrition counseling. Expert trainers available.",
    services: ["gym", "crossfit", "swimming", "nutrition", "weight training"],
    priceMin: 3000,
    priceMax: 15000,
    phone: "+91 9876543231",
    address: "Kondapur Village, Hyderabad",
    rating: 4.8,
  },

  // Spas
  {
    name: "Serenity Spa",
    type: "spa",
    location: locations.banjaraHills,
    description: "Luxury spa offering therapeutic massages, aromatherapy, and wellness treatments in a peaceful environment.",
    services: ["massage", "aromatherapy", "body scrub", "facial", "couples spa"],
    priceMin: 1500,
    priceMax: 8000,
    phone: "+91 9876543240",
    address: "Banjara Hills, Hyderabad",
    rating: 4.9,
  },
  {
    name: "Wellness Retreat",
    type: "spa",
    location: locations.gachibowli,
    description: "Modern spa with Thai massage, hot stone therapy, and rejuvenation packages. Experienced therapists.",
    services: ["thai massage", "hot stone", "reflexology", "head massage"],
    priceMin: 1000,
    priceMax: 6000,
    phone: "+91 9876543241",
    address: "Gachibowli, Hyderabad",
    rating: 4.5,
  },

  // Clinics
  {
    name: "HealthCare Plus Clinic",
    type: "clinic",
    location: locations.madhapur,
    description: "Multi-specialty clinic with general physicians, dentists, and diagnostic facilities. Insurance accepted.",
    services: ["general medicine", "dental", "diagnostics", "pediatrics"],
    priceMin: 300,
    priceMax: 3000,
    phone: "+91 9876543250",
    address: "Madhapur Main Road, Hyderabad",
    rating: 4.6,
  },
  {
    name: "DentalCare Center",
    type: "clinic",
    location: locations.hitech,
    description: "Specialized dental clinic with cosmetic dentistry, orthodontics, and dental implants. Latest technology.",
    services: ["dental cleaning", "orthodontics", "implants", "whitening"],
    priceMin: 500,
    priceMax: 50000,
    phone: "+91 9876543251",
    address: "Hitech City, Hyderabad",
    rating: 4.7,
  },

  // Hotels
  {
    name: "Grand Plaza Hotel",
    type: "hotel",
    location: locations.banjaraHills,
    description: "5-star luxury hotel with elegant rooms, rooftop restaurant, and conference facilities. Premium service.",
    services: ["accommodation", "restaurant", "conference", "gym", "pool"],
    priceMin: 5000,
    priceMax: 25000,
    phone: "+91 9876543260",
    address: "Banjara Hills, Hyderabad",
    rating: 4.8,
  },
  {
    name: "Business Stay Inn",
    type: "hotel",
    location: locations.gachibowli,
    description: "Budget-friendly hotel perfect for business travelers. Clean rooms, free WiFi, and complimentary breakfast.",
    services: ["accommodation", "wifi", "breakfast", "parking"],
    priceMin: 1500,
    priceMax: 4000,
    phone: "+91 9876543261",
    address: "Gachibowli IT Hub, Hyderabad",
    rating: 4.3,
  },
];

async function seedSupermemory() {
  console.log('🌱 Starting Supermemory seeding...\n');

  let successCount = 0;
  let failCount = 0;

  for (const business of businesses) {
    try {
      // Calculate zone tag
      const zoneTag = getZoneForCoordinates(
        business.location.lat,
        business.location.lng
      );

      // Create content for semantic search
      const content = `${business.name} - ${business.description} Located at ${business.address}. Services: ${business.services.join(', ')}. Price range: ₹${business.priceMin}-₹${business.priceMax}. Rating: ${business.rating}/5`;

      // Metadata for filtering
      const metadata = {
        businessName: business.name,
        businessType: business.type,
        services: business.services,
        priceMin: business.priceMin,
        priceMax: business.priceMax,
        phone: business.phone,
        address: business.address,
        rating: business.rating,
        lat: business.location.lat,
        lng: business.location.lng,
        addedAt: new Date().toISOString(),
      };

      // Add to Supermemory with zone tag
      // Use timestamp in ID to create fresh data each time
      const timestamp = Date.now();
      const result = await addMemory(
        content,
        [zoneTag, `business_${business.type}`],
        metadata,
        `business_${business.name.toLowerCase().replace(/\s+/g, '_')}_${timestamp}`
      );

      console.log(`✅ Added: ${business.name} (${business.type})`);
      console.log(`   Zone: ${zoneTag}`);
      console.log(`   ID: ${result.id}\n`);

      successCount++;
    } catch (error) {
      console.error(`❌ Failed to add ${business.name}:`, error);
      failCount++;
    }
  }

  console.log('\n📊 Seeding Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📍 Total: ${businesses.length}`);
}

// Run the seeding
seedSupermemory()
  .then(() => {
    console.log('\n✨ Seeding completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Seeding failed:', error);
    process.exit(1);
  });
