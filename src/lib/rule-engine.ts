
'use server';

import { db } from '@/lib/admin-db';
import { createHash } from 'crypto';

/**
 * Creates or updates a specific categorization rule in Firestore.
 * @param userId - The user's ID.
 * @param keyword - The keyword to match in a transaction (e.g., "Chase Mortgage").
 * @param categories - The category mapping.
 * @param propertyId - The associated property ID.
 */
async function setRule(
  userId: string,
  keyword: string,
  categories: { primary: string; secondary: string; sub: string },
  propertyId: string
) {
  if (!keyword) return;

  const mappingId = createHash('md5').update(userId + keyword.toUpperCase()).digest('hex');
  const ruleRef = db.collection('users').doc(userId).collection('categoryMappings').doc(mappingId);

  await ruleRef.set({
    userId,
    transactionDescription: keyword,
    primaryCategory: categories.primary,
    secondaryCategory: categories.secondary,
    subcategory: categories.sub,
    propertyId: propertyId,
    source: 'Auto-Generated',
    updatedAt: new Date(),
  }, { merge: true });
}

/**
 * Generates categorization rules from property data.
 * @param propertyId - The ID of the property.
 * @param propertyData - The full property data object.
 * @param userId - The ID of the user who owns the property.
 */
export async function generateRulesForProperty(propertyId: string, propertyData: any, userId: string) {
  if (!propertyId || !userId) {
    throw new Error('Property ID and User ID are required.');
  }

  try {
    // 1. Mortgage Lender Rule
    if (propertyData.mortgage?.lenderName) {
      await setRule(userId, propertyData.mortgage.lenderName, {
        primary: 'Operating Expenses',
        secondary: 'Financing',
        sub: 'Mortgage Interest'
      }, propertyId);
    }

    // 2. Insurance Provider Rule
    if (propertyData.taxAndInsurance?.insuranceProvider) {
      await setRule(userId, propertyData.taxAndInsurance.insuranceProvider, {
        primary: 'Operating Expenses',
        secondary: 'Insurance',
        sub: 'Property Insurance'
      }, propertyId);
    }

    // 3. HOA Rule
    if (propertyData.hoa?.contactName) {
      await setRule(userId, propertyData.hoa.contactName, {
        primary: 'Operating Expenses',
        secondary: 'Fees',
        sub: 'HOA Fees'
      }, propertyId);
    }
    
    // 4. Property Management Fee Rule
    if (propertyData.management?.isManaged === 'professional' && propertyData.management.companyName) {
      await setRule(userId, propertyData.management.companyName, {
          primary: 'Operating Expenses',
          secondary: 'Professional Services',
          sub: 'Property Management'
      }, propertyId);
    }

    // 5. Tenant Rent Rules (From both top-level and unit-level tenants)
    const allTenants = [
      ...(propertyData.tenants || []),
      ...(propertyData.units || []).flatMap((u: any) => u.tenants || [])
    ];
    
    for (const tenant of allTenants) {
      if (tenant.firstName && tenant.lastName) {
        const fullName = `${tenant.firstName} ${tenant.lastName}`;
        await setRule(userId, fullName, {
          primary: 'Income',
          secondary: 'Operating Income',
          sub: 'Rental Income'
        }, propertyId);
      }
    }

    return { success: true, message: 'Rules generated successfully.' };

  } catch (error: any) {
    console.error("Failed to generate rules:", error);
    throw new Error(`Could not generate smart rules: ${error.message}`);
  }
}
