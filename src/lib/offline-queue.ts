/**
 * Offline Transaction Queue
 *
 * Manages transactions created while the frontend is offline.
 * Persists pending transactions to localStorage and provides replay mechanisms.
 */

import { fabricSubmitTx } from "./fabric-api";

export interface OfflineTransaction {
  id: string;
  chaincode: string;
  fcn: string;
  args: string[];
  creator?: string;
  timestamp: string;
}

const QUEUE_STORAGE_KEY = "hl:offline_queue";

/**
 * Retrieves all pending offline transactions from storage.
 */
export function getOfflineQueue(): OfflineTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("[Offline Queue] Failed to load offline queue:", err);
    return [];
  }
}

/**
 * Saves the offline queue to storage.
 */
function saveOfflineQueue(queue: OfflineTransaction[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("[Offline Queue] Failed to save offline queue:", err);
  }
}

/**
 * Enqueues a new transaction for offline sync.
 */
export function enqueueOfflineTransaction(
  chaincode: string,
  fcn: string,
  args: string[],
  creator?: string
): OfflineTransaction {
  const queue = getOfflineQueue();
  const tx: OfflineTransaction = {
    id: `tx_offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    chaincode,
    fcn,
    args,
    creator,
    timestamp: new Date().toISOString(),
  };
  queue.push(tx);
  saveOfflineQueue(queue);
  console.log(`[Offline Queue] Enqueued offline transaction: ${fcn} (${tx.id})`);
  return tx;
}

/**
 * Clears the offline queue.
 */
export function clearOfflineQueue(): void {
  saveOfflineQueue([]);
}

/**
 * Replays all pending transactions from the offline queue to the server.
 * Returns the count of successfully synchronized transactions.
 */
export async function syncOfflineQueue(): Promise<number> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  console.log(`[Offline Queue] Replaying ${queue.length} transactions…`);
  let successCount = 0;
  const remaining: OfflineTransaction[] = [];

  for (const tx of queue) {
    try {
      await fabricSubmitTx(tx.chaincode, tx.fcn, tx.args, tx.creator);
      successCount++;
      console.log(`[Offline Queue] Successfully replayed transaction ${tx.id}`);
    } catch (err) {
      console.error(`[Offline Queue] Failed to replay transaction ${tx.id}:`, err);
      // Retain failed transactions in the queue
      remaining.push(tx);
    }
  }

  saveOfflineQueue(remaining);
  return successCount;
}
