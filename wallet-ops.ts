/**
 * ArcEye — Wallet Operations (Developer-Controlled Wallets SDK)
 * Balance, list wallets, and wallet info
 */

import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

const WALLET_ID = '2188818f-5d80-53e9-b610-3295805eb46e';

async function getBalance() {
  const response = await client.getWalletTokenBalance({ id: WALLET_ID });
  const balances = response.data?.tokenBalances || [];
  console.log('\n========================================');
  console.log('WALLET BALANCES');
  console.log('========================================');
  if (balances.length === 0) {
    console.log('No token balances found (may take a moment to update)');
  } else {
    balances.forEach((b: any) => {
      console.log(`${b.token?.symbol || 'Unknown'}: ${b.amount} (${b.token?.name || ''})`);
    });
  }
  console.log('========================================');
}

async function listWallets() {
  const response = await client.listWallets({});
  const wallets = response.data?.wallets || [];
  console.log('\n========================================');
  console.log('YOUR WALLETS');
  console.log('========================================');
  wallets.forEach((w: any) => {
    console.log(`${w.blockchain} | ${w.address} | ${w.state}`);
  });
  console.log('========================================');
}

async function getWallet() {
  const response = await client.getWallet({ id: WALLET_ID });
  console.log('\n========================================');
  console.log('WALLET DETAILS');
  console.log('========================================');
  console.log(JSON.stringify(response.data, null, 2));
  console.log('========================================');
}

const command = process.argv[2] || 'balance';

const actions: Record<string, () => Promise<void>> = {
  balance: getBalance,
  wallets: listWallets,
  wallet: getWallet,
};

if (actions[command]) {
  actions[command]().catch(err => {
    console.error('Error:', err.message || err);
    process.exit(1);
  });
} else {
  console.log('Usage: tsx --env-file=.env wallet-ops.ts <command>');
  console.log('Commands: balance, wallets, wallet');
}
