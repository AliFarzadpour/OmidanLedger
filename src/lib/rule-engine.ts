
'use server';

import { db } from '@/lib/firebaseAdmin';
import { createHash } from 'crypto';

/**
 * Creates or updates a specific categorization rule in Firestore.
 * Saves the new 4-level category hierarchy.
 */
async function setRule(
  userId: string,
  keyword: string,
  categories: { l0: string; l1: string; l2: string; l3: string },
  propertyId: string
) {
  if (!keyword) return;

  // Use a consistent ID generation scheme. Using propertyId ensures property-specific rules
  // for the same keyword (e.g., "Water Bill") don't overwrite each other.
  const idContent = `${userId}-${keyword.toUpperCase()}-${propertyId}`;
  const mappingId = createHash('md5').update(idContent).digest('hex');
  
  const ruleRef = db.collection('users').doc(userId).collection('categoryMappings').doc(mappingId);

  const ruleData = {
    userId,
    transactionDescription: keyword, // The string to match against
    categoryHierarchy: categories,   // The 4-level object to apply
    propertyId: propertyId,          // Link the rule to the property
    source: 'Auto-Generated (Property)',
    updatedAt: new Date(),
  };

  await ruleRef.set(ruleData, { merge: true });
}

/**
 * Generates categorization rules from property data, aligned with the new 4-level hierarchy.
 */
export async function generateRulesForProperty(propertyId: string, propertyData: any, userId: string) {
  if (!propertyId || !userId) {
    throw new Error('Property ID and User ID are required.');
  }

  try {
    const propertyNickname = propertyData.name;

    if (!propertyNickname) {
      console.warn(`Skipping rule generation for property ${propertyId} because it has no nickname.`);
      return;
    }
    
    // --- INCOME RULES ---
    const processTenants = (tenants: any[], propNick: string) => {
      if (tenants && Array.isArray(tenants)) {
        for (const tenant of tenants) {
          if (tenant.firstName && tenant.lastName) {
            const fullName = `${tenant.firstName} ${tenant.lastName}`;
            setRule(userId, fullName, {
              l0: 'Income',
              l1: 'Rental Income',
              l2: 'Line 3: Rents Received',
              l3: `${propNick} - ${fullName}`
            }, propertyId);
          }
        }
      }
    };
    processTenants(propertyData.tenants, propertyNickname);

    // --- EXPENSE RULES ---

    // Mortgage Interest
    if (propertyData.mortgage?.lenderName) {
      await setRule(userId, propertyData.mortgage.lenderName, {
        l0: 'Expense',
        l1: 'Financing',
        l2: 'Line 12: Mortgage Interest',
        l3: propertyNickname
      }, propertyId);
    }

    // Insurance
    if (propertyData.taxAndInsurance?.insuranceProvider) {
      await setRule(userId, propertyData.taxAndInsurance.insuranceProvider, {
        l0: 'Expense',
        l1: 'Insurance',
        l2: 'Line 9: Insurance',
        l3: propertyNickname
      }, propertyId);
    }
    
    // Management Fees
    if (propertyData.management?.isManaged === 'professional' && propertyData.management.companyName) {
      await setRule(userId, propertyData.management.companyName, {
        l0: 'Expense',
        l1: 'Management',
        l2: 'Line 10: Professional Fees',
        l3: propertyNickname
      }, propertyId);
    }

    // Utilities
    if (propertyData.utilities && Array.isArray(propertyData.utilities)) {
      for (const util of propertyData.utilities) {
        if (util.providerName) {
          await setRule(userId, util.providerName, {
            l0: 'Expense',
            l1: 'Utilities',
            l2: 'Line 17: Utilities',
            l3: `${propertyNickname} - ${util.type}`
          }, propertyId);
        }
      }
    }
    
    // Vendors
    if (propertyData.preferredVendors && Array.isArray(propertyData.preferredVendors)) {
      for (const vendor of propertyData.preferredVendors) {
        if (vendor.name) {
          await setRule(userId, vendor.name, {
            l0: 'Expense',
            l1: 'Repairs',
            l2: 'Line 14: Repairs',
            l3: `${propertyNickname} - ${vendor.role || 'General'}`
          }, propertyId);
        }
      }
    }
    
    // HOA Dues
    if (propertyData.hoa?.hasHoa === 'yes' && propertyData.hoa.contactName) {
      await setRule(userId, propertyData.hoa.contactName, {
        l0: 'Expense',
        l1: 'HOA',
        l2: 'Line 19: Other Expenses',
        l3: `${propertyNickname} HOA`
      }, propertyId);
    }


    return { success: true, message: '4-level rules generated successfully.' };

  } catch (error: any) {
    console.error("Failed to generate rules:", error);
    throw new Error(`Could not generate smart rules: ${error.message}`);
  }
}
