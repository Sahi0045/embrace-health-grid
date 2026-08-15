/**
 * Signing Events API Endpoints
 * Record, query, and verify blockchain signing operations
 */

import { createServerFn } from '@tanstack/react-start';
import { getSupabaseServerClient, getVerifiedUser } from '@/lib/supabase.server';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SigningEventRecord {
  signerType: 'phantom' | 'embedded';
  txId: string;
  recordType: string;
  recordHash: string;
  userWallet?: string; // If Phantom: user's public key
  hospitalId: string;
  metadata?: Record<string, unknown>;
}

export interface SigningEventResponse {
  eventId: string;
  txId: string;
  signerType: 'phantom' | 'embedded';
  status: 'success' | 'failed' | 'pending';
  confirmed: boolean;
  created_at: string;
}

// ─── Record Signing Event ────────────────────────────────────────────────────

/**
 * POST /api/signing-events
 * Log a signing operation to audit trail
 */
export const recordSigningEvent = createServerFn({
  method: 'POST',
})
  .middleware(async () => {
    const user = await getVerifiedUser();
    if (!user) throw new Error('Unauthorized');
    return { user };
  })
  .handler(async (opts) => {
    const db = getSupabaseServerClient();
    const user = opts.data?.user || (await getVerifiedUser());

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { signerType, txId, recordType, recordHash, userWallet, hospitalId, metadata } =
      opts.data as SigningEventRecord;

    // Validation
    if (!signerType || !['phantom', 'embedded'].includes(signerType)) {
      throw new Error('Invalid signer type');
    }
    if (!txId || txId.length === 0) {
      throw new Error('Transaction ID required');
    }
    if (!recordHash || recordHash.length === 0) {
      throw new Error('Record hash required');
    }

    try {
      // Insert signing event
      const { data, error } = await db
        .from('signing_events')
        .insert({
          hospital_id: hospitalId,
          user_id: user.id,
          transaction_id: txId,
          record_type: recordType,
          record_hash: recordHash,
          signer_type: signerType,
          signer_wallet: signerType === 'phantom' ? userWallet : null,
          user_wallet: userWallet || null,
          status: 'success',
          confirmed: false,
          metadata: metadata || {},
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error recording signing event:', error);
        throw new Error(`Failed to record event: ${error.message}`);
      }

      console.log(
        `✅ Recorded ${signerType} signing: ${txId} by user ${user.id}`
      );

      return {
        eventId: data.event_id,
        txId: data.transaction_id,
        signerType: data.signer_type,
        status: data.status,
        confirmed: data.confirmed,
        created_at: data.created_at,
      } as SigningEventResponse;
    } catch (error) {
      console.error('Failed to record signing event:', error);
      throw error;
    }
  });

// ─── Update Confirmation Status ──────────────────────────────────────────────

/**
 * POST /api/signing-events/:txId/confirm
 * Mark a signing event as confirmed on blockchain
 */
export const confirmSigningEvent = createServerFn({
  method: 'POST',
})
  .middleware(async () => {
    const user = await getVerifiedUser();
    if (!user) throw new Error('Unauthorized');
    return { user };
  })
  .handler(async (opts) => {
    const db = getSupabaseServerClient();
    const user = opts.data?.user || (await getVerifiedUser());

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { txId, confirmationSlot, confirmationCount } = opts.data || {};

    if (!txId) {
      throw new Error('Transaction ID required');
    }

    try {
      // Update signing event confirmation
      const { error } = await db
        .from('signing_events')
        .update({
          confirmed: true,
          confirmed_at: new Date().toISOString(),
          confirmation_slot: confirmationSlot || null,
          confirmation_count: confirmationCount || 32,
        })
        .eq('transaction_id', txId)
        .eq('hospital_id', user.hospital_id);

      if (error) {
        console.error('Error confirming signing event:', error);
        throw new Error(`Failed to confirm: ${error.message}`);
      }

      console.log(`✅ Confirmed signing event: ${txId}`);

      return { success: true };
    } catch (error) {
      console.error('Failed to confirm signing event:', error);
      throw error;
    }
  });

// ─── Mark Signing Event as Failed ────────────────────────────────────────────

/**
 * POST /api/signing-events/:txId/fail
 * Mark a signing event as failed
 */
export const failSigningEvent = createServerFn({
  method: 'POST',
})
  .middleware(async () => {
    const user = await getVerifiedUser();
    if (!user) throw new Error('Unauthorized');
    return { user };
  })
  .handler(async (opts) => {
    const db = getSupabaseServerClient();
    const user = opts.data?.user || (await getVerifiedUser());

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { txId, errorMessage } = opts.data || {};

    if (!txId) {
      throw new Error('Transaction ID required');
    }

    try {
      const { error } = await db
        .from('signing_events')
        .update({
          status: 'failed',
          error_message: errorMessage || 'Unknown error',
        })
        .eq('transaction_id', txId)
        .eq('hospital_id', user.hospital_id);

      if (error) {
        throw new Error(`Failed to mark as failed: ${error.message}`);
      }

      console.warn(`⚠️ Marked signing event as failed: ${txId} - ${errorMessage}`);

      return { success: true };
    } catch (error) {
      console.error('Failed to mark signing event as failed:', error);
      throw error;
    }
  });

// ─── Get Signing Event by Transaction ID ─────────────────────────────────────

/**
 * GET /api/signing-events/:txId
 * Retrieve a specific signing event
 */
export const getSigningEvent = createServerFn({
  method: 'GET',
})
  .middleware(async () => {
    const user = await getVerifiedUser();
    if (!user) throw new Error('Unauthorized');
    return { user };
  })
  .handler(async (opts) => {
    const db = getSupabaseServerClient();
    const user = opts.data?.user || (await getVerifiedUser());

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { txId } = opts.data || {};

    if (!txId) {
      throw new Error('Transaction ID required');
    }

    try {
      const { data, error } = await db
        .from('signing_events')
        .select('*')
        .eq('transaction_id', txId)
        .eq('hospital_id', user.hospital_id)
        .single();

      if (error?.code === 'PGRST116') {
        throw new Error(`Signing event not found: ${txId}`);
      }

      if (error) {
        throw new Error(`Failed to fetch event: ${error.message}`);
      }

      return {
        eventId: data.event_id,
        txId: data.transaction_id,
        recordType: data.record_type,
        recordHash: data.record_hash,
        signerType: data.signer_type,
        userWallet: data.user_wallet,
        status: data.status,
        confirmed: data.confirmed,
        confirmationSlot: data.confirmation_slot,
        created_at: data.created_at,
        confirmed_at: data.confirmed_at,
      };
    } catch (error) {
      console.error('Failed to get signing event:', error);
      throw error;
    }
  });

// ─── Get User's Signing History ──────────────────────────────────────────────

/**
 * GET /api/signing-events/user/history
 * Get current user's signing history
 */
export const getUserSigningHistory = createServerFn({
  method: 'GET',
})
  .middleware(async () => {
    const user = await getVerifiedUser();
    if (!user) throw new Error('Unauthorized');
    return { user };
  })
  .handler(async (opts) => {
    const db = getSupabaseServerClient();
    const user = opts.data?.user || (await getVerifiedUser());

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { limit = 50 } = opts.data || {};

    try {
      const { data, error } = await db
        .from('signing_events')
        .select('event_id, transaction_id, record_type, signer_type, status, confirmed, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch history: ${error.message}`);
      }

      return (data || []).map((event: any) => ({
        eventId: event.event_id,
        txId: event.transaction_id,
        recordType: event.record_type,
        signerType: event.signer_type,
        status: event.status,
        confirmed: event.confirmed,
        created_at: event.created_at,
      }));
    } catch (error) {
      console.error('Failed to get user signing history:', error);
      throw error;
    }
  });

// ─── Get Hospital Signing Statistics ─────────────────────────────────────────

/**
 * GET /api/signing-events/stats
 * Get signing statistics for hospital (admin only)
 */
export const getHospitalSigningStats = createServerFn({
  method: 'GET',
})
  .middleware(async () => {
    const user = await getVerifiedUser();
    if (!user || user.role !== 'admin') throw new Error('Unauthorized - admin only');
    return { user };
  })
  .handler(async (opts) => {
    const db = getSupabaseServerClient();
    const user = opts.data?.user || (await getVerifiedUser());

    if (!user || user.role !== 'admin') {
      throw new Error('Only admins can view hospital signing statistics');
    }

    try {
      // Use the SQL function to get stats
      const { data, error } = await db
        .rpc('get_signing_stats', { p_hospital_id: user.hospital_id });

      if (error) {
        throw new Error(`Failed to fetch stats: ${error.message}`);
      }

      return {
        totalSignings: data[0]?.total_signings || 0,
        phantomSignings: data[0]?.phantom_signings || 0,
        embeddedSignings: data[0]?.embedded_signings || 0,
        failedSignings: data[0]?.failed_signings || 0,
        confirmedSignings: data[0]?.confirmed_signings || 0,
        successRate: parseFloat(data[0]?.success_rate || 0).toFixed(2),
      };
    } catch (error) {
      console.error('Failed to get hospital signing stats:', error);
      throw error;
    }
  });

// ─── Get Daily Signing Volume ────────────────────────────────────────────────

/**
 * GET /api/signing-events/volume/daily
 * Get signing volume for a specific day
 */
export const getDailySigningVolume = createServerFn({
  method: 'GET',
})
  .middleware(async () => {
    const user = await getVerifiedUser();
    if (!user || user.role !== 'admin') throw new Error('Unauthorized - admin only');
    return { user };
  })
  .handler(async (opts) => {
    const db = getSupabaseServerClient();
    const user = opts.data?.user || (await getVerifiedUser());

    if (!user || user.role !== 'admin') {
      throw new Error('Only admins can view signing volume');
    }

    const { date = new Date().toISOString().split('T')[0] } = opts.data || {};

    try {
      const { data, error } = await db.rpc('get_daily_signing_volume', {
        p_hospital_id: user.hospital_id,
        p_date: date,
      });

      if (error) {
        throw new Error(`Failed to fetch volume: ${error.message}`);
      }

      return {
        date,
        totalSignings: data[0]?.total_signings || 0,
        phantomSignings: data[0]?.phantom_signings || 0,
        embeddedSignings: data[0]?.embedded_signings || 0,
      };
    } catch (error) {
      console.error('Failed to get daily signing volume:', error);
      throw error;
    }
  });
