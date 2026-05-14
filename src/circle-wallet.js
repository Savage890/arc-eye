/**
 * ArcEye — Circle Developer-Controlled Wallets Integration
 * Docs: https://developers.circle.com/wallets/dev-controlled/register-entity-secret
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

const API_KEY = import.meta.env.VITE_CIRCLE_API_KEY || '';

let circleClient = null;

/**
 * Initialize the Circle developer-controlled wallets client
 */
export async function initCircleClient(entitySecret) {
  if (!API_KEY) {
    console.error('[ArcEye] Missing VITE_CIRCLE_API_KEY in .env');
    return null;
  }

  try {
    circleClient = initiateDeveloperControlledWalletsClient({
      apiKey: API_KEY,
      entitySecret: entitySecret,
    });
    console.log('[ArcEye] Circle client initialized');
    return circleClient;
  } catch (err) {
    console.error('[ArcEye] Failed to init Circle client:', err);
    return null;
  }
}

/**
 * Get the active Circle client instance
 */
export function getCircleClient() {
  return circleClient;
}

/**
 * Create a new wallet set
 */
export async function createWalletSet(name = 'ArcEye Wallet Set') {
  if (!circleClient) throw new Error('Circle client not initialized');

  const response = await circleClient.createWalletSet({
    name,
  });
  console.log('[ArcEye] Wallet set created:', response.data?.walletSet?.id);
  return response.data?.walletSet;
}

/**
 * Create wallets within a wallet set
 */
export async function createWallets(walletSetId, blockchains = ['ETH-SEPOLIA'], count = 1) {
  if (!circleClient) throw new Error('Circle client not initialized');

  const response = await circleClient.createWallets({
    walletSetId,
    blockchains,
    count,
  });
  console.log('[ArcEye] Wallets created:', response.data?.wallets?.length);
  return response.data?.wallets;
}

/**
 * List all wallets
 */
export async function listWallets() {
  if (!circleClient) throw new Error('Circle client not initialized');

  const response = await circleClient.listWallets({});
  return response.data?.wallets || [];
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(walletId) {
  if (!circleClient) throw new Error('Circle client not initialized');

  const response = await circleClient.getWalletTokenBalance({
    id: walletId,
  });
  return response.data?.tokenBalances || [];
}
