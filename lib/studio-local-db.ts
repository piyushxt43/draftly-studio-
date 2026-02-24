/**
 * studio-local-db.ts — IndexedDB persistence for Studio workflows.
 *
 * All workflow data (nodes, edges, images, videos) is stored entirely
 * on the user's device via IndexedDB. No Firebase Storage needed.
 * IndexedDB can hold hundreds of MBs — far beyond localStorage's 5 MB cap.
 */

const DB_NAME = 'draftly-studio';
const DB_VERSION = 1;
const STORE_WORKFLOWS = 'workflows';

export interface LocalWorkflow {
  id: string;
  userId: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
  createdAt: string;
  updatedAt: string;
}

// ── Open (or create) the database ─────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_WORKFLOWS)) {
        const store = db.createObjectStore(STORE_WORKFLOWS, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── Save / update a workflow ──────────────────────────────────────────

export async function saveWorkflowLocal(
  workflow: LocalWorkflow,
): Promise<string> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WORKFLOWS, 'readwrite');
    const store = tx.objectStore(STORE_WORKFLOWS);
    store.put(workflow);
    tx.oncomplete = () => resolve(workflow.id);
    tx.onerror = () => reject(tx.error);
  });
}

// ── Load a single workflow ────────────────────────────────────────────

export async function loadWorkflowLocal(
  workflowId: string,
): Promise<LocalWorkflow | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WORKFLOWS, 'readonly');
    const store = tx.objectStore(STORE_WORKFLOWS);
    const req = store.get(workflowId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

// ── List all workflows for a user (sorted by updatedAt desc) ──────────

export async function listWorkflowsLocal(
  userId: string,
): Promise<LocalWorkflow[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WORKFLOWS, 'readonly');
    const store = tx.objectStore(STORE_WORKFLOWS);
    const index = store.index('userId');
    const req = index.getAll(userId);

    req.onsuccess = () => {
      const results = (req.result as LocalWorkflow[]) || [];
      // Sort by updatedAt descending
      results.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Delete a workflow ─────────────────────────────────────────────────

export async function deleteWorkflowLocal(
  workflowId: string,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WORKFLOWS, 'readwrite');
    const store = tx.objectStore(STORE_WORKFLOWS);
    store.delete(workflowId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Generate a unique ID ──────────────────────────────────────────────

export function generateLocalId(): string {
  return `wf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
