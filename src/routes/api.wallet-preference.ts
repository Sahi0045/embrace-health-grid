/**
 * Wallet Preference API Endpoints
 * GET/POST user's wallet preference (auto, phantom, or embedded)
 */

import { createServerFn } from '@tanstack/react-start';
import { getSupabaseServerClient, getVerifiedUser } from '@/lib/supabase.server';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WalletPreference {
  walletMode: 'auto' | 'phantom' | 'embedded';
  phantomConnected: boolean;
  phantomPublicKey: string | null;
  updatedAt: string;
}

// ─── Get User Wallet Preference ──────────────────────────────────────────────

/**
 * GET /api/wallet-preference
 * Fetch user's saved wallet preference
 * Returns: { walletMode, phantomConnected, phantomPublicKey }
 */
export const getUserWalletPreference = createServerFn({
  method: 'GET',
})
  .handler(async () => {
    const db = getSupabaseServerClient();
    const user = await getVerifiedUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      // Fetch user's wallet preference
      const { data, error } = await db
        .from('user_wallet_preferences')
        .select('wallet_mode, phantom_public_key, phantom_connected_at, updated_at')
        .eq('user_id', user.id)
        .single();

      // If no preference exists, return defaults
      if (error?.code === 'PGRST116') {
        // No rows found - return default
        return {
          walletMode: 'auto',
          phantomConnected: false,
          phantomPublicKey: null,
          updatedAt: new Date().toISOString(),
        } as WalletPreference;
      }

      if (error) {
        console.error('Error fetching wallet preference:', error);
        throw new Error(`Failed to fetch preference: ${error.message}`);
      }

      return {
        walletMode: data.wallet_mode as 'auto' | 'phantom' | 'embedded',
        phantomConnected: !!data.phantom_connected_at,
        phantomPublicKey: data.phantom_public_key,
        updatedAt: data.updated_at,
      } as WalletPreference;
    } catch (error) {
      console.error('Failed to get wallet preference:', error);
      throw error;
    }
  });

// ─── Save User Wallet Preference ─────────────────────────────────────────────

/**
 * POST /api/wallet-preference
 * Save/update user's wallet preference
 * Body: { walletMode, phantomPublicKey? }
 */
export const saveUserWalletPreference = createServerFn({
  method: 'POST',
})
  .inputValidator((data: { walletMode: 'auto' | 'phantom' | 'embedded'; phantomPublicKey?: string | null }) => data)
  .handler(async ({ data }) => {
    const db = getSupabaseServerClient();
    const user = await getVerifiedUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: profile } = await db
      .from('profiles')
      .select('hospital_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('User profile not found');
    }

    const { walletMode, phantomPublicKey } = data;

    if (!walletMode || !['auto', 'phantom', 'embedded'].includes(walletMode)) {
      throw new Error('Invalid wallet mode. Must be: auto, phantom, or embedded');
    }

    try {
      // Upsert preference (insert or update)
      const { error } = await db.from('user_wallet_preferences').upsert(
        {
          hospital_id: profile.hospital_id,
          user_id: user.id,
          wallet_mode: walletMode,
          phantom_public_key: phantomPublicKey || null,
          phantom_connected_at: phantomPublicKey ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'hospital_id,user_id',
        }
      );

      if (error) {
        console.error('Error saving wallet preference:', error);
        throw new Error(`Failed to save preference: ${error.message}`);
      }

      console.log(
        `✅ Saved wallet preference for user ${user.id}: ${walletMode}${phantomPublicKey ? ` (Phantom: ${phantomPublicKey.slice(0, 8)}...)` : ''}`
      );

      return {
        success: true,
        walletMode,
        phantomPublicKey,
      };
    } catch (error) {
      console.error('Failed to save wallet preference:', error);
      throw error;
    }
  });

// ─── Clear Phantom Connection ────────────────────────────────────────────────

/**
 * POST /api/wallet-preference/disconnect-phantom
 * Clear Phantom connection info (keep other preferences)
 */
export const disconnectPhantom = createServerFn({
  method: 'POST',
})
  .handler(async () => {
    const db = getSupabaseServerClient();
    const user = await getVerifiedUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const { error } = await db
        .from('user_wallet_preferences')
        .update({
          phantom_public_key: null,
          phantom_connected_at: null,
          phantom_disconnected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error disconnecting Phantom:', error);
        throw new Error(`Failed to disconnect: ${error.message}`);
      }

      console.log(`✅ Disconnected Phantom for user ${user.id}`);

      return { success: true };
    } catch (error) {
      console.error('Failed to disconnect Phantom:', error);
      throw error;
    }
  });

// ─── Get Hospital Wallet Statistics ──────────────────────────────────────────

/**
 * GET /api/wallet-preference/stats
 * Get wallet usage statistics for hospital
 * Returns: { autoMode, phantomMode, embeddedMode, counts }
 */
export const getWalletStats = createServerFn({
  method: 'GET',
})
  .handler(async () => {
    const db = getSupabaseServerClient();
    const user = await getVerifiedUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: profile } = await db
      .from('profiles')
      .select('hospital_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      throw new Error('Only admins can view wallet statistics');
    }

    try {
      // Get distribution of wallet modes
      const { data: stats, error } = await db
        .from('user_wallet_preferences')
        .select('wallet_mode')
        .eq('hospital_id', profile.hospital_id);

      if (error) {
        throw new Error(`Failed to fetch stats: ${error.message}`);
      }

      // Count by mode
      const modeCount = {
        auto: 0,
        phantom: 0,
        embedded: 0,
      };

      stats?.forEach((pref: any) => {
        modeCount[pref.wallet_mode as keyof typeof modeCount]++;
      });

      const total = stats?.length || 0;

      return {
        totalUsers: total,
        autoMode: {
          count: modeCount.auto,
          percentage: total > 0 ? ((modeCount.auto / total) * 100).toFixed(1) : '0',
        },
        phantomMode: {
          count: modeCount.phantom,
          percentage: total > 0 ? ((modeCount.phantom / total) * 100).toFixed(1) : '0',
        },
        embeddedMode: {
          count: modeCount.embedded,
          percentage: total > 0 ? ((modeCount.embedded / total) * 100).toFixed(1) : '0',
        },
      };
    } catch (error) {
      console.error('Failed to get wallet stats:', error);
      throw error;
    }
  });
