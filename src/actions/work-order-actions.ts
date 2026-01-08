
'use server';

import { db } from '@/lib/admin-db';
import { adminApp } from '@/lib/admin-db';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const WorkOrderSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  propertyId: z.string().min(1, 'Property is required'),
  unitId: z.string().optional(),
  tenantId: z.string().optional(),
  vendorId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(['Low', 'Normal', 'High', 'Emergency']),
  status: z.enum(['New', 'Scheduled', 'In Progress', 'Waiting', 'Completed', 'Canceled']),
  dueDate: z.date().optional().nullable(),
  scheduledAt: z.date().optional().nullable(),
  estimatedCost: z.coerce.number().optional().nullable(),
  actualCost: z.coerce.number().optional().nullable(),
  visibility: z.enum(['landlord_only', 'shared_with_tenant', 'shared_with_vendor']),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string(),
    storagePath: z.string(),
  })).optional(),
});

type WorkOrderData = z.infer<typeof WorkOrderSchema>;

export async function saveWorkOrder(data: WorkOrderData) {
  const validation = WorkOrderSchema.safeParse(data);
  if (!validation.success) {
    throw new Error(`Validation failed: ${validation.error.message}`);
  }

  const { id, userId, ...workOrderData } = validation.data;
  
  const payload = {
    ...workOrderData,
    updatedAt: FieldValue.serverTimestamp(),
  };

  try {
    if (id) {
      // Update existing work order
      const docRef = db.collection('users').doc(userId).collection('opsWorkOrders').doc(id);
      await docRef.update(payload);
      revalidatePath(`/dashboard/operations/work-orders/${id}`);
      return { success: true, id };
    } else {
      // Create new work order
      const docRef = db.collection('users').doc(userId).collection('opsWorkOrders').doc();
      await docRef.set({
        ...payload,
        id: docRef.id,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: { type: 'landlord', id: userId, name: 'Owner' } // Add creator info
      });

      // Add an initial "created" message to the timeline
      const messageRef = docRef.collection('messages').doc();
      await messageRef.set({
          userId: userId,
          workOrderId: docRef.id,
          createdAt: FieldValue.serverTimestamp(),
          author: { type: 'system', id: null, name: 'System' },
          visibility: 'internal',
          body: 'Work order created.'
      });
      
      revalidatePath('/dashboard/operations/work-orders');
      return { success: true, id: docRef.id };
    }
  } catch (error: any) {
    console.error('Failed to save work order:', error);
    throw new Error('Could not save work order data.');
  }
}

export async function deleteWorkOrder(userId: string, workOrderId: string) {
    if (!userId || !workOrderId) {
        throw new Error("User ID and Work Order ID are required for deletion.");
    }

    try {
        await db.collection('users').doc(userId).collection('opsWorkOrders').doc(workOrderId).delete();
        revalidatePath('/dashboard/operations/work-orders');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to delete work order:', error);
        throw new Error('Could not delete the work order.');
    }
}
