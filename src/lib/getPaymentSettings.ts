'use server';

import { db } from '@/lib/firebaseAdmin';

interface PaymentSettings {
    stripe: { enabled: boolean };
    zelle: { 
        enabled: boolean;
        recipientName?: string;
        recipientHandle?: string;
        memoTemplate?: string;
        notes?: string;
    };
    offline: {
        enabled: boolean;
        instructions?: string;
    };
}

interface NormalizedSettings {
    stripeEnabled: boolean;
    zelleEnabled: boolean;
    zelleRecipientName: string;
    zelleRecipientHandle: string;
    zelleMemoTemplate: string;
    zelleNotes: string;
}

const defaultSettings: NormalizedSettings = {
    stripeEnabled: false,
    zelleEnabled: true,
    zelleRecipientName: '',
    zelleRecipientHandle: '',
    zelleMemoTemplate: '{{propertyName}} {{month}} Rent',
    zelleNotes: '',
};

/**
 * Fetches the effective payment settings for a given property,
 * falling back to the user's global defaults if necessary.
 * @param userId - The ID of the user.
 * @param propertyId - The ID of the property.
 * @returns A normalized settings object.
 */
export async function getPaymentSettings(userId: string, propertyId: string): Promise<NormalizedSettings> {
    if (!userId || !propertyId) {
        return defaultSettings;
    }

    try {
        // 1. Try to fetch property-specific settings
        const propertyDoc = await db.collection('properties').doc(propertyId).get();
        if (propertyDoc.exists && propertyDoc.data()?.userId === userId) {
            const propertyData = propertyDoc.data();
            if (propertyData?.paymentSettings) {
                const settings = propertyData.paymentSettings as Partial<PaymentSettings>;
                return {
                    stripeEnabled: settings.stripe?.enabled ?? false,
                    zelleEnabled: settings.zelle?.enabled ?? true,
                    zelleRecipientName: settings.zelle?.recipientName ?? '',
                    zelleRecipientHandle: settings.zelle?.recipientHandle ?? '',
                    zelleMemoTemplate: settings.zelle?.memoTemplate ?? '{{propertyName}} {{month}} Rent',
                    zelleNotes: settings.zelle?.notes ?? '',
                };
            }
        }

        // 2. If no property settings, fall back to user defaults
        const userDefaultsDoc = await db.collection('users').doc(userId).collection('paymentSettings').doc('defaults').get();
        if (userDefaultsDoc.exists) {
            const settings = userDefaultsDoc.data() as Partial<PaymentSettings>;
            return {
                stripeEnabled: settings.stripe?.enabled ?? false,
                zelleEnabled: settings.zelle?.enabled ?? true,
                zelleRecipientName: settings.zelle?.recipientName ?? '',
                zelleRecipientHandle: settings.zelle?.recipientHandle ?? '',
                zelleMemoTemplate: settings.zelle?.memoTemplate ?? '{{propertyName}} {{month}} Rent',
                zelleNotes: settings.zelle?.notes ?? '',
            };
        }

        // 3. If no defaults found, return system defaults
        return defaultSettings;

    } catch (error) {
        console.error("Error fetching payment settings:", error);
        // On error, return safe system defaults
        return defaultSettings;
    }
}
