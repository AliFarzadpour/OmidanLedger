

'use server';

import { db } from '@/lib/admin-db';
import { createHash } from 'crypto';

/**
 * Creates or updates a specific categorization rule in Firestore.
 * Now prepends the property nickname to the subcategory for clarity.
 * @param userId - The user's ID.
 * @param keyword - The keyword to match in a transaction.
 * @param categories - The base category mapping.
 * @param propertyId - The associated property ID.
 * @param propertyNickname - The nickname of the property for descriptive categories.
 * @param unitId - The associated unit ID (optional).
 */
async function setRule(
  userId: string,
  keyword: string,
  categories: { primary: string; secondary: string; sub: string },
  propertyId: string,
  propertyNickname: string,
  unitId?: string | null
) {
  if (!keyword) return;

  const idContent = `${userId}-${keyword}-${propertyId}` + (unitId ? `-${unitId}` : '');
  const mappingId = createHash('md5').update(idContent.toUpperCase()).digest('hex');
  
  const ruleRef = db.collection('users').doc(userId).collection('categoryMappings').doc(mappingId);

  const ruleData: any = {
    userId,
    transactionDescription: keyword,
    primaryCategory: categories.primary,
    secondaryCategory: categories.secondary,
    subcategory: `[${propertyNickname}] - ${categories.sub}`, // The new descriptive format
    propertyId: propertyId,
    source: 'Auto-Generated',
    updatedAt: new Date(),
  };

  if (unitId) {
    ruleData.unitId = unitId;
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
    const propertyAddress = propertyData.address?.street;

    if (!propertyNickname) {
        console.warn(`Skipping rule generation for property ${propertyId} because it has no nickname.`);
        return;
    }

    // Rule for the property nickname itself, often used in manual Zelle/Venmo notes.
    await setRule(userId, propertyNickname, {
        primary: 'Income',
        secondary: 'Rental Income',
        sub: 'Rents Received'
    }, propertyId, propertyNickname);
    
    // Rule for the property address, often found in mortgage or utility payments.
    if (propertyAddress) {
        await setRule(userId, propertyAddress, {
            primary: 'Expenses',
            secondary: 'Property Operations', // A general bucket for address matches
            sub: 'Unassigned Property Expense'
        }, propertyId, propertyNickname);
    }

    // --- SCHEDULE E: EXPENSE RULES ---

    // Mortgage Interest
    if (propertyData.mortgage?.lenderName) {
      await setRule(userId, propertyData.mortgage.lenderName, {
        primary: 'Expenses',
        secondary: 'Mortgage Interest',
        sub: 'Mortgage Interest Paid'
      }, propertyId, propertyNickname);
    }

    // Insurance
    if (propertyData.taxAndInsurance?.insuranceProvider) {
      await setRule(userId, propertyData.taxAndInsurance.insuranceProvider, {
        primary: 'Expenses',
        secondary: 'Insurance',
        sub: 'Property Insurance Premiums'
      }, propertyId, propertyNickname);
    }
    
    // Management Fees
    if (propertyData.management?.isManaged === 'professional' && propertyData.management.companyName) {
      await setRule(userId, propertyData.management.companyName, {
          primary: 'Expenses',
          secondary: 'Management Fees',
          sub: 'Property Management Fees'
      }, propertyId, propertyNickname);
    }

    // Utilities
    if (propertyData.utilities && Array.isArray(propertyData.utilities)) {
        for (const util of propertyData.utilities) {
            if (util.providerName) {
                await setRule(userId, util.providerName, {
                    primary: 'Expenses',
                    secondary: 'Utilities',
                    sub: util.type 
                }, propertyId, propertyNickname);
            }
        }
    }
    
    // Repairs, Maintenance, and Vendors
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
                }, propertyId, propertyNickname);
            }
        }
    }
    
    // HOA Dues
    if (propertyData.hoa?.hasHoa === 'yes' && propertyData.hoa.contactName) {
        await setRule(userId, propertyData.hoa.contactName, {
            primary: 'Expenses',
            secondary: 'Dues & Fees',
            sub: 'HOA Dues'
        }, propertyId, propertyNickname);
    }

    // --- SCHEDULE E: INCOME RULES (TENANTS) ---
    const processTenants = (tenants: any[], unitId?: string) => {
        if (tenants && Array.isArray(tenants)) {
            for (const tenant of tenants) {
                if (tenant.firstName && tenant.lastName) {
                    const fullName = `${tenant.firstName} ${tenant.lastName}`;
                    setRule(userId, fullName, {
                        primary: 'Income',
                        secondary: 'Rental Income',
                        sub: 'Rents Received'
                    }, propertyId, propertyNickname, unitId);
                }
            }
        }
    };
    
    if (isMultiUnit && propertyData.units) {
      propertyData.units.forEach((unit: any) => processTenants(unit.tenants, unit.id));
    } else {
      processTenants(propertyData.tenants);
    }


    return { success: true, message: 'Schedule E rules generated successfully.' };

  } catch (error: any) {
    console.error("Failed to generate rules:", error);
    throw new Error(`Could not generate smart rules: ${error.message}`);
  }
}
