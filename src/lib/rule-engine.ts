
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
 * Generates categorization rules from property data, aligned with IRS Schedule E.
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

    // --- SCHEDULE E: EXPENSE RULES (Apply to ALL property types) ---

    // Line 12: Mortgage Interest
    if (propertyData.mortgage?.lenderName) {
      await setRule(userId, propertyData.mortgage.lenderName, {
        primary: 'Expenses',
        secondary: 'Mortgage Interest',
        sub: 'Mortgage Interest Paid to Banks'
      }, propertyId);
    }

    // Line 9: Insurance
    if (propertyData.taxAndInsurance?.insuranceProvider) {
      await setRule(userId, propertyData.taxAndInsurance.insuranceProvider, {
        primary: 'Expenses',
        secondary: 'Insurance',
        sub: 'Property Insurance Premiums'
      }, propertyId);
    }
    
    // Line 10: Management Fees
    if (propertyData.management?.isManaged === 'professional' && propertyData.management.companyName) {
      await setRule(userId, propertyData.management.companyName, {
          primary: 'Expenses',
          secondary: 'Management Fees',
          sub: 'Property Management Fees'
      }, propertyId);
    }

    // Line 18: Utilities
    if (propertyData.utilities && Array.isArray(propertyData.utilities)) {
        for (const util of propertyData.utilities) {
            if (util.providerName) {
                await setRule(userId, util.providerName, {
                    primary: 'Expenses',
                    secondary: 'Utilities',
                    sub: util.type // e.g., Water, Gas, Electric
                }, propertyId);
            }
        }
    }
    
    // Line 14 & 7: Repairs, Maintenance, and Vendors
    if (propertyData.preferredVendors && Array.isArray(propertyData.preferredVendors)) {
        for (const vendor of propertyData.preferredVendors) {
            let subCat = 'General Repairs';
            if (vendor.role?.toLowerCase().includes('clean') || vendor.role?.toLowerCase().includes('maint')) {
                subCat = 'Cleaning & Maintenance';
            } else if (vendor.role?.toLowerCase().includes('plumber') || vendor.role?.toLowerCase().includes('electric')) {
                subCat = 'Plumbing & Electrical';
            }

            if (vendor.name) {
                await setRule(userId, vendor.name, {
                    primary: 'Expenses',
                    secondary: 'Repairs',
                    sub: subCat
                }, propertyId);
            }
        }
    }

    // --- SCHEDULE E: INCOME RULES ---
    // Line 3: Rents Received
    if (isMultiUnit) {
      if (propertyData.units && Array.isArray(propertyData.units)) {
        for (const unit of propertyData.units) {
          if (unit.tenants && Array.isArray(unit.tenants)) {
            for (const tenant of unit.tenants) {
              const mappingKey = `${propertyNickname}-${unit.unitNumber}`;
              await setRule(userId, mappingKey, {
                primary: 'Income',
                secondary: 'Rental Income',
                sub: 'Rents Received'
              }, propertyId, unit.id, mappingKey);

              if (tenant.firstName && tenant.lastName) {
                const fullName = `${tenant.firstName} ${tenant.lastName}`;
                await setRule(userId, fullName, {
                  primary: 'Income',
                  secondary: 'Rental Income',
                  sub: 'Rents Received'
                }, propertyId, unit.id);
              }
            }
          }
        }
      }
    } else {
      // Single-Family Logic
      if (propertyData.tenants && Array.isArray(propertyData.tenants)) {
        for (const tenant of propertyData.tenants) {
          if (tenant.firstName && tenant.lastName) {
            const fullName = `${tenant.firstName} ${tenant.lastName}`;
            await setRule(userId, fullName, {
              primary: 'Income',
              secondary: 'Rental Income',
              sub: 'Rents Received'
            }, propertyId);
          }
        }
      }
    }

    return { success: true, message: 'Schedule E rules generated successfully.' };

  } catch (error: any) {
    console.error("Failed to generate rules:", error);
    throw new Error(`Could not generate smart rules: ${error.message}`);
  }
}
