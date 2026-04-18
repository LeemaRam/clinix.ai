#!/usr/bin/env node

/**
 * Stripe Subscription Plans Seeder
 * 
 * This script populates the MongoDB database with subscription plans
 * linked to Stripe price IDs.
 * 
 * Usage:
 *   node seed-stripe-plans.js
 * 
 * Make sure to:
 * 1. Have MongoDB running
 * 2. Update the STRIPE_PRICE_IDS object with your actual Stripe price IDs
 * 3. Set MONGODB_URI in .env or update the connection string below
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Define the subscription plan schema
const subscriptionPlanSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  currency: String,
  interval: String,
  transcriptionsPerMonth: Number,
  diskSpaceGB: Number,
  features: [String],
  stripePriceId: String,
  popular: Boolean,
  trialDays: Number,
  active: Boolean,
  deleted: Boolean,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

// ⚠️ IMPORTANT: Replace these with your actual Stripe price IDs
// Get these from: Stripe Dashboard → Products → [Select Product] → Price ID
const STRIPE_PRICE_IDS = {
  starter_monthly: 'price_YOUR_STARTER_MONTHLY_ID_HERE',
  pro_monthly: 'price_YOUR_PRO_MONTHLY_ID_HERE',
  starter_yearly: 'price_YOUR_STARTER_YEARLY_ID_HERE',
  pro_yearly: 'price_YOUR_PRO_YEARLY_ID_HERE'
};

const SUBSCRIPTION_PLANS = [
  {
    name: 'Starter',
    description: 'For solo practitioners getting started.',
    price: 29,
    currency: 'usd',
    interval: 'month',
    transcriptionsPerMonth: 120,
    diskSpaceGB: 10,
    features: ['AI transcription', 'SOAP reports', 'Basic analytics'],
    stripePriceId: STRIPE_PRICE_IDS.starter_monthly,
    popular: false,
    trialDays: 14,
    active: true,
    deleted: false
  },
  {
    name: 'Pro',
    description: 'For growing clinics with higher volume.',
    price: 79,
    currency: 'usd',
    interval: 'month',
    transcriptionsPerMonth: 600,
    diskSpaceGB: 80,
    features: ['Everything in Starter', 'Priority processing', 'Team support'],
    stripePriceId: STRIPE_PRICE_IDS.pro_monthly,
    popular: true,
    trialDays: 14,
    active: true,
    deleted: false
  },
  {
    name: 'Starter',
    description: 'For solo practitioners getting started.',
    price: 290,
    currency: 'usd',
    interval: 'year',
    transcriptionsPerMonth: 120,
    diskSpaceGB: 10,
    features: ['AI transcription', 'SOAP reports', 'Basic analytics'],
    stripePriceId: STRIPE_PRICE_IDS.starter_yearly,
    popular: false,
    trialDays: 14,
    active: true,
    deleted: false
  },
  {
    name: 'Pro',
    description: 'For growing clinics with higher volume.',
    price: 790,
    currency: 'usd',
    interval: 'year',
    transcriptionsPerMonth: 600,
    diskSpaceGB: 80,
    features: ['Everything in Starter', 'Priority processing', 'Team support'],
    stripePriceId: STRIPE_PRICE_IDS.pro_yearly,
    popular: true,
    trialDays: 14,
    active: true,
    deleted: false
  }
];

async function seedDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/clinix_ai';
  
  console.log('🔗 Connecting to MongoDB:', mongoUri);
  
  try {
    // Connect to MongoDB
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB\n');
    
    // Check for missing Stripe price IDs
    const hasMissingIds = SUBSCRIPTION_PLANS.some(plan => 
      plan.stripePriceId.includes('YOUR_')
    );
    
    if (hasMissingIds) {
      console.log('⚠️  WARNING: Some Stripe price IDs are still placeholders!');
      console.log('\n📋 Update the following in this file:\n');
      
      SUBSCRIPTION_PLANS.forEach((plan, idx) => {
        if (plan.stripePriceId.includes('YOUR_')) {
          console.log(`  ${idx + 1}. ${plan.name} (${plan.interval.toUpperCase()}): ${plan.stripePriceId}`);
        }
      });
      
      console.log('\n💡 Get these from: Stripe Dashboard → Products → [Select Product] → Price ID\n');
      
      // Exit early if all IDs are placeholders or too many are missing
      const missingCount = SUBSCRIPTION_PLANS.filter(p => p.stripePriceId.includes('YOUR_')).length;
      if (missingCount > 0) {
        console.log('❌ Cannot seed with placeholder price IDs. Please update the STRIPE_PRICE_IDS object.\n');
        await mongoose.disconnect();
        process.exit(1);
      }
    }
    
    // Clear existing plans (optional - comment out to preserve existing data)
    const result = await SubscriptionPlan.deleteMany({});
    console.log(`🗑️  Cleared ${result.deletedCount} existing plans\n`);
    
    // Insert new plans
    const inserted = await SubscriptionPlan.insertMany(SUBSCRIPTION_PLANS);
    
    console.log('✨ Successfully seeded subscription plans:\n');
    inserted.forEach((plan, idx) => {
      console.log(`  ${idx + 1}. ${plan.name} - $${plan.price}/${plan.interval}`);
      console.log(`     ID: ${plan._id}`);
      console.log(`     Stripe Price: ${plan.stripePriceId}\n`);
    });
    
    console.log('✅ Seeding completed successfully!\n');
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB\n');
    
  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
    console.error('\nDebugging info:');
    console.error('  - MongoDB URI:', mongoUri);
    console.error('  - Node Version:', process.version);
    console.error('\nMake sure:');
    console.error('  1. MongoDB is running');
    console.error('  2. MONGODB_URI is set in .env');
    console.error('  3. Stripe price IDs are updated in this file');
    
    process.exit(1);
  }
}

// Run the seeder
seedDatabase();
