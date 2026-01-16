
'use server';

import { getAppUrl } from "@/lib/url-utils";
import { Resend } from 'resend';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { createHash, randomBytes } from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { sendTenantInviteEmail } from "@/lib/email";

const db = getAdminDb();
const resend = new Resend(process.env.RESEND_API_KEY);

interface InviteTenantParams {
  email: string;
  propertyId: string;
  unitId?: string;
  landlordId: string;
  landlordName: string;
  propertyName: string;
}

export async function inviteTenantWithToken(params: InviteTenantParams) {
    const { email, propertyId, unitId, landlordId, landlordName, propertyName } = params;

    if (!email || !propertyId || !landlordId) {
        throw new Error("Missing required parameters for invitation.");
    }

    try {
        // 1. Generate a secure, URL-safe token and its hash
        const token = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(token).digest('hex');

        // 2. Set an expiration date (e.g., 72 hours from now)
        const expiresAt = Timestamp.fromMillis(Date.now() + 72 * 60 * 60 * 1000);

        // 3. Create the invite document in a new top-level collection
        const inviteRef = db.collection('tenantInvites').doc();
        await inviteRef.set({
            tenantEmail: email.toLowerCase(),
            tokenHash,
            expiresAt,
            propertyId,
            ...(unitId && { unitId }),
            landlordId,
            status: 'pending', // 'pending', 'accepted', 'expired'
            createdAt: Timestamp.now(),
        });
        
        // 4. Construct the invitation link
        const baseUrl = getAppUrl();
        const inviteLink = `${baseUrl}/tenant/accept?inviteId=${inviteRef.id}&token=${token}`;

        // 5. Send the email via Resend
        await sendTenantInviteEmail({
          to: email,
          landlordName,
          propertyName,
          link: inviteLink
        });

        return { success: true, message: `An invitation has been sent to ${email}.` };

    } catch (err: any) {
        console.error('Tenant Invite Error:', err.message);
        throw new Error('Could not send tenant invitation. Please try again later.');
    }
}


export async function verifyInviteToken(inviteId: string, token: string) {
    if (!inviteId || !token) {
        throw new Error("Invite ID and token are required.");
    }

    const inviteRef = db.collection('tenantInvites').doc(inviteId);
    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists) {
        throw new Error("This invitation is not valid or has been deleted.");
    }

    const invite = inviteDoc.data()!;
    const now = Timestamp.now();

    if (invite.status !== 'pending') {
        throw new Error("This invitation has already been used or expired.");
    }

    if (now > invite.expiresAt) {
        // Optionally, update status to 'expired'
        await inviteRef.update({ status: 'expired' });
        throw new Error("This invitation has expired.");
    }

    const providedTokenHash = createHash('sha256').update(token).digest('hex');
    if (providedTokenHash !== invite.tokenHash) {
        throw new Error("Invalid invitation token.");
    }

    // Token is valid, return the necessary data for the client
    return {
        success: true,
        email: invite.tenantEmail,
        propertyId: invite.propertyId,
        unitId: invite.unitId,
    };
}


export async function finalizeInviteAcceptance(userId: string, inviteId: string, token: string) {
    if (!userId || !inviteId || !token) {
        throw new Error("Missing required data to finalize invitation.");
    }

    const batch = db.batch();
    
    // 1. Re-verify the token to prevent race conditions or misuse
    const inviteRef = db.collection('tenantInvites').doc(inviteId);
    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists || inviteDoc.data()?.status !== 'pending') {
        throw new Error("Invitation is no longer valid.");
    }
    
    const inviteData = inviteDoc.data()!;
    const providedTokenHash = createHash('sha256').update(token).digest('hex');
    if (providedTokenHash !== inviteData.tokenHash) {
        throw new Error("Invalid token provided for finalization.");
    }

    // 2. Create the Tenant Profile document
    const tenantProfileRef = db.collection('tenantProfiles').doc(userId);
    batch.set(tenantProfileRef, {
        tenantUid: userId,
        email: inviteData.tenantEmail,
        landlordId: inviteData.landlordId,
        propertyId: inviteData.propertyId,
        unitId: inviteData.unitId || null,
        acceptedInviteId: inviteId,
        createdAt: Timestamp.now(),
        // Initialize billing object for the tenant
        billing: {
            balance: 0,
            lastPaymentDate: null,
        },
    }, { merge: true });

    // 3. Create/update the main user document for auth purposes
    const userRef = db.collection('users').doc(userId);
    batch.set(userRef, {
        uid: userId,
        email: inviteData.tenantEmail,
        role: 'tenant',
    }, { merge: true });


    // 4. Mark the invite as accepted
    batch.update(inviteRef, {
        status: 'accepted',
        acceptedAt: Timestamp.now(),
        acceptedByUid: userId,
    });
    
    await batch.commit();

    return { success: true };
}


export async function sendTenantMessage(data: {
    userId: string;
    landlordId: string;
    propertyId: string;
    unitId?: string;
    threadSubject: string;
    messageBody: string;
    senderName: string;
    senderEmail: string;
}) {
    const { userId, landlordId, ...payload } = data;

    try {
        const batch = db.batch();
        const threadRef = db.collection('users').doc(landlordId).collection('opsThreads').doc();
        batch.set(threadRef, {
            uid: threadRef.id,
            subject: payload.threadSubject,
            status: 'open',
            priority: 'normal',
            propertyId: payload.propertyId,
            unitId: payload.unitId || null,
            tenantId: userId,
            lastMessageAt: Timestamp.now(),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });

        const messageRef = threadRef.collection('messages').doc();
        batch.set(messageRef, {
            uid: messageRef.id,
            threadId: threadRef.id,
            senderType: 'tenant',
            senderName: payload.senderName,
            senderEmail: payload.senderEmail,
            body: payload.messageBody,
            createdAt: Timestamp.now()
        });

        await batch.commit();

        // After successfully creating the message, find the landlord's email and send a notification.
        const landlordDoc = await db.collection('users').doc(landlordId).get();
        if (landlordDoc.exists) {
            const landlordEmail = landlordDoc.data()?.email;
            if (landlordEmail) {
                await resend.emails.send({
                    from: process.env.RESEND_FROM || 'onboarding@omidanledger.com',
                    to: landlordEmail,
                    subject: `New Message from ${payload.senderName}: ${payload.threadSubject}`,
                    html: `
                        <p>You have a new message from ${payload.senderName} (${payload.senderEmail}) regarding "${payload.threadSubject}".</p>
                        <p>Message:</p>
                        <p><em>${payload.messageBody}</em></p>
                        <p><a href="${getAppUrl()}/dashboard/operations">View in Operations Center</a></p>
                    `
                });
            }
        }
        
        return { success: true, threadId: threadRef.id };

    } catch (e: any) {
        console.error("Failed to send tenant message:", e);
        throw new Error("Could not send message. Please try again later.");
    }
}
