import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const client = initiateDeveloperControlledWalletsClient({
  apiKey: 'TEST_API_KEY:5a839d9c6a0e8053f99d12f9aab70733:41ce360ef8633fe30b8f755de997847a',
  entitySecret: 'ba9b6280c7278421fae6d5b3c07de5212447581a4bcb6c774bdbf41e6c40e17b'
});

async function main() {
  // Create a new wallet set for Arc Testnet
  console.log('Creating Arc Testnet wallet set...');
  const walletSetRes = await client.createWalletSet({
    name: 'ArcEye Wallet Set - Arc Testnet',
  });

  const walletSet = walletSetRes.data?.walletSet;
  if (!walletSet?.id) {
    throw new Error('Wallet set creation failed: no ID returned');
  }
  console.log('Wallet Set ID:', walletSet.id);

  // Create wallet on ARC-TESTNET (not ETH-SEPOLIA)
  console.log('Creating wallet on ARC-TESTNET...');
  const walletRes = await client.createWallets({
    walletSetId: walletSet.id,
    blockchains: ['ARC-TESTNET'],
    count: 1,
    accountType: 'EOA',
  });

  const wallet = walletRes.data?.wallets?.[0];
  console.log('\n========================================');
  console.log('ARC TESTNET WALLET CREATED!');
  console.log('========================================');
  console.log('Wallet Set ID:', walletSet.id);
  console.log('Wallet ID:', wallet?.id);
  console.log('Address:', wallet?.address);
  console.log('Blockchain:', wallet?.blockchain);
  console.log('Account Type:', wallet?.accountType);
  console.log('State:', wallet?.state);
  console.log('========================================');
  console.log('\nNext: Fund this wallet at https://faucet.circle.com/');
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
