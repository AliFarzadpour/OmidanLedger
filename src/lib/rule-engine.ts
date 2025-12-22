
'use server';

import { db } from '@/lib/admin-db';
import { createHash } from 'crypto';

/**
 * Creates or updates a specific categorization rule in Firestore.
 * Can handle both property-level and unit-level rules.
 * @param userId - The user's ID.
 * @param keyword - The keyword to match in a transaction.
 * @param categories - The category mapping.
 * @param propertyId - The associated property ID.
 * @param unitId - The associated unit ID (optional).
 * @param mappingKey - The composite key for multi-family rules (optional).
 */
async function setRule(
  userId: string,
  keyword: string,
  categories: { primary: string; secondary: string; sub: string },
  propertyId: string,
  unitId?: string | null,
  mappingKey?: string | null
) {
  if (!keyword) return;

  // Create a unique ID for the rule based on its specific context
  const idContent = `${userId}-${keyword}-${propertyId}` + (unitId ? `-${unitId}` : '');
  const mappingId = createHash('md5').update(idContent.toUpperCase()).digest('hex');
  
  const ruleRef = db.collection('users').doc(userId).collection('categoryMappings').doc(mappingId);

  const ruleData: any = {
    userId,
    transactionDescription: keyword,
    primaryCategory: categories.primary,
    secondaryCategory: categories.secondary,
    subcategory: categories.sub,
    propertyId: propertyId,
    source: 'Auto-Generated',
    updatedAt: new Date(),
  };

  if (unitId) {
    ruleData.unitId = unitId;
  }
  if (mappingKey) {
    ruleData.mappingKey = mappingKey;
  }

  await ruleRef.set(ruleData, { merge: true });
}

/**
 * Generates categorization rules from property data.
 * Differentiates between single-family and multi-family properties.
 * @param propertyId - The ID of the property.
 * @param propertyData - The full property data object.
 * @param userId - The ID of the user who owns the property.
 */
export async function generateRulesForProperty(propertyId: string, propertyData: any, userId: string) {
  if (!propertyId || !userId) {
    throw new Error('Property ID and User ID are required.');
  }

  try {
    const isMultiUnit = propertyData.isMultiUnit === true;
    const propertyNickname = propertyData.name;

    // --- Building-Wide Expense Rules (Apply to ALL property types) ---

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
    if (propertyData.hoa?.hasHoa === 'yes' && propertyData.hoa.contactName) {
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

    // --- Tenant Income Rules (Logic branches here) ---
    if (isMultiUnit) {
      // MULTI-FAMILY LOGIC
      if (propertyData.units && Array.isArray(propertyData.units)) {
        for (const unit of propertyData.units) {
          if (unit.tenants && Array.isArray(unit.tenants)) {
            for (const tenant of unit.tenants) {
              // Rule 1: Composite Key for Rent (e.g., "Irvine-101")
              const mappingKey = `${propertyNickname}-${unit.unitNumber}`;
              await setRule(userId, mappingKey, {
                primary: 'Income',
                secondary: 'Operating Income',
                sub: 'Rental Income'
              }, propertyId, unit.id, mappingKey);

              // Rule 2: Tenant Full Name (as a fallback)
              if (tenant.firstName && tenant.lastName) {
                const fullName = `${tenant.firstName} ${tenant.lastName}`;
                await setRule(userId, fullName, {
                  primary: 'Income',
                  secondary: 'Operating Income',
                  sub: 'Rental Income'
                }, propertyId, unit.id);
              }
            }
          }
        }
      }
    } else {
      // SINGLE-FAMILY LOGIC (Unchanged)
      if (propertyData.tenants && Array.isArray(propertyData.tenants)) {
        for (const tenant of propertyData.tenants) {
          if (tenant.firstName && tenant.lastName) {
            const fullName = `${tenant.firstName} ${tenant.lastName}`;
            await setRule(userId, fullName, {
              primary: 'Income',
              secondary: 'Operating Income',
              sub: 'Rental Income'
            }, propertyId);
          }
        }
      }
    }

    return { success: true, message: 'Rules generated successfully.' };

  } catch (error: any) {
    console.error("Failed to generate rules:", error);
    throw new Error(`Could not generate smart rules: ${error.message}`);
  }
}
