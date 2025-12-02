'use server';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

export async function getUserCategoryMappings(firestore: any, userId: string): Promise<string> {
    if (!firestore || !userId) {
        return "No custom mappings provided.";
    }
    const mappingsSnapshot = await getDocs(collection(firestore, `users/${userId}/categoryMappings`));
    if (mappingsSnapshot.empty) {
        return "No custom mappings provided.";
    }
    const mappings = mappingsSnapshot.docs.map(doc => {
        const data = doc.data();
        return `- Description: "${data.transactionDescription}" -> Category: ${data.primaryCategory} > ${data.secondaryCategory} > ${data.subcategory}`;
    });
    return mappings.join('\n');
}
