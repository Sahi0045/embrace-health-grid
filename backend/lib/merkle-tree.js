import crypto from 'crypto';

/**
 * Merkle Tree Implementation for Room Check-In Events
 * - Each room event (check-in/check-out) is a leaf
 * - Leaves are hashed and combined to create parent nodes
 * - Root hash represents all daily events
 */

/**
 * Hash a leaf object using SHA-256
 */
export function hashLeaf(leaf) {
  const leafData = JSON.stringify({
    doctorDid: leaf.doctorDid,
    roomId: leaf.roomId,
    roomName: leaf.roomName,
    action: leaf.action,
    timestamp: leaf.timestamp,
  });
  return crypto.createHash('sha256').update(leafData).digest('hex');
}

/**
 * Combine two hashes to create a parent hash
 */
export function combineHashes(leftHash, rightHash) {
  const combined = leftHash + rightHash;
  return crypto.createHash('sha256').update(combined).digest('hex');
}

/**
 * Build a Merkle Tree from an array of leaves
 */
export function buildMerkleTree(leaves) {
  if (!leaves || leaves.length === 0) {
    return null;
  }

  // Create leaf nodes with their hashes
  let nodes = leaves.map((leaf) => ({
    hash: hashLeaf(leaf),
    leaf,
    left: null,
    right: null,
  }));

  // Build tree bottom-up
  while (nodes.length > 1) {
    const nextLevel = [];

    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = nodes[i + 1] || left; // Duplicate last node if odd count

      const parentHash = combineHashes(left.hash, right.hash);
      nextLevel.push({
        hash: parentHash,
        left,
        right,
        leaf: null,
      });
    }

    nodes = nextLevel;
  }

  return nodes[0] || null;
}

/**
 * Get the Merkle Root hash from a tree
 */
export function getMerkleRoot(tree) {
  return tree ? tree.hash : null;
}

/**
 * Verify that a leaf is part of the Merkle Tree
 */
export function verifyLeaf(leaf, root, tree) {
  if (!tree) {
    return false;
  }

  const leafHash = hashLeaf(leaf);
  return findLeafInTree(leafHash, tree);
}

/**
 * Recursively search for a leaf hash in the tree
 */
function findLeafInTree(targetHash, node) {
  if (!node) return false;
  
  if (node.hash === targetHash) {
    return true;
  }

  if (node.left && findLeafInTree(targetHash, node.left)) {
    return true;
  }

  if (node.right && findLeafInTree(targetHash, node.right)) {
    return true;
  }

  return false;
}

/**
 * Get all leaves from a Merkle Tree (in-order traversal)
 */
export function getLeaves(tree) {
  const leaves = [];

  function traverse(node) {
    if (!node) return;

    if (node.leaf) {
      leaves.push(node.leaf);
    }

    if (node.left) traverse(node.left);
    if (node.right) traverse(node.right);
  }

  traverse(tree);
  return leaves;
}

/**
 * Generate proof for a leaf (path from leaf to root)
 */
export function generateProof(leaf, tree) {
  if (!tree) {
    return null;
  }

  const proof = [];
  const leafHash = hashLeaf(leaf);

  function findPath(node) {
    if (!node) return false;
    
    if (node.hash === leafHash) {
      return true;
    }

    if (node.left) {
      if (findPath(node.left)) {
        if (node.right) {
          proof.push({ hash: node.right.hash, position: 'right' });
        }
        return true;
      }
    }

    if (node.right) {
      if (findPath(node.right)) {
        if (node.left) {
          proof.push({ hash: node.left.hash, position: 'left' });
        }
        return true;
      }
    }

    return false;
  }

  if (findPath(tree)) {
    return { leaf, proof };
  }

  return null;
}

/**
 * Verify a proof (recalculate hash from proof path)
 */
export function verifyProof(proof, root) {
  let hash = hashLeaf(proof.leaf);

  for (const step of proof.proof) {
    if (step.position === 'left') {
      hash = combineHashes(step.hash, hash);
    } else {
      hash = combineHashes(hash, step.hash);
    }
  }

  return hash === root;
}
