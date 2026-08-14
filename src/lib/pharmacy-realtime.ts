/**
 * Pharmacy Real-time Subscriptions
 *
 * Manages real-time updates for pharmacy inventory using Supabase Realtime.
 * Enables live dashboards, instant alerts, and multi-user synchronization.
 *
 * Subscribed tables (REPLICA IDENTITY FULL):
 * - inventory_items: Item master changes
 * - stock_levels: Current stock availability
 * - stock_movements: All inventory transactions (append-only audit log)
 * - expiration_alerts: Expiry tracking and history
 * - low_stock_alerts: Stock level monitoring
 * - inventory_batches: Batch tracking updates
 * - purchase_orders: Order status changes
 */

import { getSupabaseServerClient } from "./supabase.server";
import { RealtimeChannel } from "@supabase/supabase-js";

// ─── Subscription Managers ───────────────────────────────────────────────────

/**
 * Subscribe to stock movements (append-only audit log)
 * Fires on every inventory transaction (add, remove, consume, waste, etc.)
 * 
 * Use case: Real-time audit trail, compliance reporting, movement history
 */
export function subscribeToStockMovements(
  hospitalId: string,
  onMovement: (movement: any) => void,
  onError?: (error: any) => void
): RealtimeChannel | null {
  try {
    const supabase = getSupabaseServerClient();
    
    const channel = supabase
      .channel(`pharmacy:stock-movements:${hospitalId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE
          schema: "public",
          table: "stock_movements",
          filter: `hospital_id=eq.${hospitalId}`,
        },
        (payload: any) => {
          // All movements are INSERTs (immutable log)
          if (payload.eventType === "INSERT") {
            onMovement(payload.new);
          }
        }
      )
      .subscribe();

    return channel;
  } catch (error) {
    onError?.(error);
    return null;
  }
}

/**
 * Subscribe to stock level changes
 * Fires when availability updates (due to movements, batch changes)
 * 
 * Use case: Live inventory dashboards, availability checks for dispensing
 */
export function subscribeToStockLevels(
  hospitalId: string,
  itemId: string | undefined,
  onUpdate: (level: any) => void,
  onError?: (error: any) => void
): RealtimeChannel | null {
  try {
    const supabase = getSupabaseServerClient();
    
    const filter = itemId
      ? `hospital_id=eq.${hospitalId},item_id=eq.${itemId}`
      : `hospital_id=eq.${hospitalId}`;

    const channel = supabase
      .channel(`pharmacy:stock-levels:${hospitalId}:${itemId || "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stock_levels",
          filter,
        },
        (payload: any) => {
          // Track both new and updated values
          const data = payload.new || payload.old;
          onUpdate(data);
        }
      )
      .subscribe();

    return channel;
  } catch (error) {
    onError?.(error);
    return null;
  }
}

/**
 * Subscribe to expiration alerts
 * Fires when batches approach or pass expiry dates
 * 
 * Use case: Real-time expiry monitoring, compliance alerts
 */
export function subscribeToExpirationAlerts(
  hospitalId: string,
  onAlert: (alert: any) => void,
  onError?: (error: any) => void
): RealtimeChannel | null {
  try {
    const supabase = getSupabaseServerClient();

    const channel = supabase
      .channel(`pharmacy:expiration-alerts:${hospitalId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expiration_alerts",
          filter: `hospital_id=eq.${hospitalId}`,
        },
        (payload: any) => {
          onAlert(payload.new || payload.old);
        }
      )
      .subscribe();

    return channel;
  } catch (error) {
    onError?.(error);
    return null;
  }
}

/**
 * Subscribe to low-stock alerts
 * Fires when inventory falls below reorder level
 * 
 * Use case: Real-time low-stock notifications, replenishment triggers
 */
export function subscribeToLowStockAlerts(
  hospitalId: string,
  onAlert: (alert: any) => void,
  onError?: (error: any) => void
): RealtimeChannel | null {
  try {
    const supabase = getSupabaseServerClient();

    const channel = supabase
      .channel(`pharmacy:low-stock-alerts:${hospitalId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "low_stock_alerts",
          filter: `hospital_id=eq.${hospitalId}`,
        },
        (payload: any) => {
          onAlert(payload.new || payload.old);
        }
      )
      .subscribe();

    return channel;
  } catch (error) {
    onError?.(error);
    return null;
  }
}

/**
 * Subscribe to batch updates
 * Fires when batch quantities change (received, consumed, wasted)
 * 
 * Use case: Batch tracking, inventory adjustments, batch lifecycle
 */
export function subscribeToBatches(
  hospitalId: string,
  onUpdate: (batch: any) => void,
  onError?: (error: any) => void
): RealtimeChannel | null {
  try {
    const supabase = getSupabaseServerClient();

    const channel = supabase
      .channel(`pharmacy:batches:${hospitalId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_batches",
          filter: `hospital_id=eq.${hospitalId}`,
        },
        (payload: any) => {
          onUpdate(payload.new || payload.old);
        }
      )
      .subscribe();

    return channel;
  } catch (error) {
    onError?.(error);
    return null;
  }
}

/**
 * Subscribe to purchase orders
 * Fires when PO status changes (draft → submitted → received)
 * 
 * Use case: Procurement tracking, order fulfillment monitoring
 */
export function subscribeToPurchaseOrders(
  hospitalId: string,
  onUpdate: (order: any) => void,
  onError?: (error: any) => void
): RealtimeChannel | null {
  try {
    const supabase = getSupabaseServerClient();

    const channel = supabase
      .channel(`pharmacy:purchase-orders:${hospitalId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "purchase_orders",
          filter: `hospital_id=eq.${hospitalId}`,
        },
        (payload: any) => {
          onUpdate(payload.new || payload.old);
        }
      )
      .subscribe();

    return channel;
  } catch (error) {
    onError?.(error);
    return null;
  }
}

// ─── Multi-Channel Subscriptions ─────────────────────────────────────────────

export interface PharmacyRealtimeConfig {
  movements?: boolean;
  stockLevels?: boolean;
  expirationAlerts?: boolean;
  lowStockAlerts?: boolean;
  batches?: boolean;
  purchaseOrders?: boolean;
}

export interface PharmacyRealtimeCallbacks {
  onMovement?: (movement: any) => void;
  onStockLevelChange?: (level: any) => void;
  onExpirationAlert?: (alert: any) => void;
  onLowStockAlert?: (alert: any) => void;
  onBatchUpdate?: (batch: any) => void;
  onPurchaseOrderUpdate?: (order: any) => void;
  onError?: (error: any) => void;
}

/**
 * Subscribe to multiple pharmacy channels at once
 * Manages all subscriptions and provides cleanup
 * 
 * Usage:
 * ```
 * const channels = subscribeToPharmacyUpdates(hospitalId, {
 *   movements: true,
 *   stockLevels: true,
 *   expirationAlerts: true,
 * }, {
 *   onMovement: (mov) => console.log("Movement:", mov),
 *   onStockLevelChange: (level) => console.log("Stock:", level),
 * });
 * 
 * // Later: unsubscribe all
 * channels.unsubscribeAll();
 * ```
 */
export function subscribeToPharmacyUpdates(
  hospitalId: string,
  config: PharmacyRealtimeConfig = {
    movements: true,
    stockLevels: true,
    expirationAlerts: true,
    lowStockAlerts: true,
  },
  callbacks: PharmacyRealtimeCallbacks
) {
  const channels: RealtimeChannel[] = [];

  if (config.movements) {
    const ch = subscribeToStockMovements(
      hospitalId,
      callbacks.onMovement || (() => {}),
      callbacks.onError
    );
    if (ch) channels.push(ch);
  }

  if (config.stockLevels) {
    const ch = subscribeToStockLevels(
      hospitalId,
      undefined,
      callbacks.onStockLevelChange || (() => {}),
      callbacks.onError
    );
    if (ch) channels.push(ch);
  }

  if (config.expirationAlerts) {
    const ch = subscribeToExpirationAlerts(
      hospitalId,
      callbacks.onExpirationAlert || (() => {}),
      callbacks.onError
    );
    if (ch) channels.push(ch);
  }

  if (config.lowStockAlerts) {
    const ch = subscribeToLowStockAlerts(
      hospitalId,
      callbacks.onLowStockAlert || (() => {}),
      callbacks.onError
    );
    if (ch) channels.push(ch);
  }

  if (config.batches) {
    const ch = subscribeToBatches(
      hospitalId,
      callbacks.onBatchUpdate || (() => {}),
      callbacks.onError
    );
    if (ch) channels.push(ch);
  }

  if (config.purchaseOrders) {
    const ch = subscribeToPurchaseOrders(
      hospitalId,
      callbacks.onPurchaseOrderUpdate || (() => {}),
      callbacks.onError
    );
    if (ch) channels.push(ch);
  }

  return {
    channels,
    unsubscribeAll: async () => {
      const supabase = getSupabaseServerClient();
      for (const channel of channels) {
        await supabase.removeChannel(channel);
      }
    },
    unsubscribeChannel: async (channel: RealtimeChannel) => {
      const supabase = getSupabaseServerClient();
      await supabase.removeChannel(channel);
    },
  };
}

// ─── React Hook for Pharmacy Realtime ────────────────────────────────────────

import { useEffect, useRef, useCallback, useState } from "react";

/**
 * React hook for pharmacy realtime subscriptions
 * Automatically handles subscription lifecycle (mount/unmount)
 * 
 * Usage:
 * ```
 * const { movements, stockLevels } = usePharmacyRealtime(hospitalId, {
 *   movements: true,
 *   stockLevels: true,
 * });
 * ```
 */
export function usePharmacyRealtime(
  hospitalId: string,
  config: PharmacyRealtimeConfig = { movements: true, stockLevels: true }
) {
  const subscriptionsRef = useRef<ReturnType<typeof subscribeToPharmacyUpdates> | null>(null);

  const [movements, setMovements] = useState<any[]>([]);
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [expirationAlerts, setExpirationAlerts] = useState<any[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  useEffect(() => {
    subscriptionsRef.current = subscribeToPharmacyUpdates(
      hospitalId,
      config,
      {
        onMovement: (mov) => {
          setMovements((prev) => [mov, ...prev.slice(0, 99)]); // Keep last 100
        },
        onStockLevelChange: (level) => {
          setStockLevels((prev) => {
            const filtered = prev.filter((l) => l.stock_id !== level.stock_id);
            return [level, ...filtered];
          });
        },
        onExpirationAlert: (alert) => {
          setExpirationAlerts((prev) => {
            const filtered = prev.filter((a) => a.alert_id !== alert.alert_id);
            return [alert, ...filtered];
          });
        },
        onLowStockAlert: (alert) => {
          setLowStockAlerts((prev) => {
            const filtered = prev.filter((a) => a.alert_id !== alert.alert_id);
            return [alert, ...filtered];
          });
        },
        onBatchUpdate: (batch) => {
          setBatches((prev) => {
            const filtered = prev.filter((b) => b.batch_id !== batch.batch_id);
            return [batch, ...filtered];
          });
        },
        onPurchaseOrderUpdate: (order) => {
          setPurchaseOrders((prev) => {
            const filtered = prev.filter((o) => o.order_id !== order.order_id);
            return [order, ...filtered];
          });
        },
      }
    );

    return () => {
      subscriptionsRef.current?.unsubscribeAll();
    };
  }, [hospitalId, config]);

  return {
    movements,
    stockLevels,
    expirationAlerts,
    lowStockAlerts,
    batches,
    purchaseOrders,
  };
}
