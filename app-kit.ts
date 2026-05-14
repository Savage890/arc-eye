/**
 * ArcEye — Arc App Kit Integration
 * Bridge, Swap, Send, and Unified Balance via Circle Developer-Controlled Wallets
 */

import { createAppKit } from "@circle-fin/app-kit";
import { createViemAdapter } from "@circle-fin/adapter-viem-v2";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

// ──────────────────── Config ────────────────────
const API_KEY = process.env.CIRCLE_API_KEY;
const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET;
const WALLET_ID = '2188818f-5d80-53e9-b610-3295805eb46e';
const WALLET_ADDRESS = '0x231c181751808a09216a6fbe910c9fbd4358d288';

// ──────────────────── Initialize Circle Client ────────────────────
const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey: API_KEY,
  entitySecret: ENTITY_SECRET,
});

// ──────────────────── Initialize App Kit ────────────────────
const viemAdapter = createViemAdapter();
const kit = createAppKit();

// ══════════════════════════════════════════════════
//  BRIDGE: Transfer USDC from Ethereum Sepolia → Arc Testnet
// ══════════════════════════════════════════════════
export async function bridgeToArc(amount = "1.00") {
  console.log(`[ArcEye] Bridging ${amount} USDC → Arc Testnet...`);

  const result = await kit.bridge({
    from: { adapter: viemAdapter, chain: "Ethereum_Sepolia" },
    to: { adapter: viemAdapter, chain: "Arc_Testnet" },
    amount,
  });

  console.log("[ArcEye] Bridge result:", result);
  return result;
}

// ══════════════════════════════════════════════════
//  SWAP: Exchange tokens on Arc Testnet
// ══════════════════════════════════════════════════
export async function swapTokens(tokenIn = "USDC", tokenOut = "EURC", amountIn = "1.00") {
  console.log(`[ArcEye] Swapping ${amountIn} ${tokenIn} → ${tokenOut} on Arc Testnet...`);

  const result = await kit.swap({
    from: { adapter: viemAdapter, chain: "Arc_Testnet" },
    tokenIn,
    tokenOut,
    amountIn,
    config: {
      kitKey: process.env.KIT_KEY,
    },
  });

  console.log("[ArcEye] Swap result:", result);
  return result;
}

// ══════════════════════════════════════════════════
//  SEND: Transfer USDC between wallets on Arc Testnet
// ══════════════════════════════════════════════════
export async function sendTokens(recipientAddress, amount = "1.00", token = "USDC") {
  console.log(`[ArcEye] Sending ${amount} ${token} to ${recipientAddress}...`);

  const result = await kit.send({
    from: { adapter: viemAdapter, chain: "Arc_Testnet" },
    to: recipientAddress,
    amount,
    token,
  });

  console.log("[ArcEye] Send result:", result);
  return result;
}

// ══════════════════════════════════════════════════
//  UNIFIED BALANCE: Deposit & Spend across chains
// ══════════════════════════════════════════════════
export async function depositToUnifiedBalance(chain = "Base_Sepolia", amount = "1.00", token = "USDC") {
  console.log(`[ArcEye] Depositing ${amount} ${token} from ${chain} to Unified Balance...`);

  const result = await kit.unifiedBalance.deposit({
    from: { adapter: viemAdapter, chain },
    amount,
    token,
  });

  console.log("[ArcEye] Deposit result:", result);
  return result;
}

export async function spendFromUnifiedBalance(recipientAddress, amount = "1.00") {
  console.log(`[ArcEye] Spending ${amount} USDC from Unified Balance → ${recipientAddress}...`);

  const result = await kit.unifiedBalance.spend({
    from: { adapter: viemAdapter },
    amountIn: amount,
    to: {
      adapter: viemAdapter,
      chain: "Arc_Testnet",
      recipientAddress,
    },
  });

  console.log("[ArcEye] Spend result:", result);
  return result;
}

// ══════════════════════════════════════════════════
//  WALLET: Query balance
// ══════════════════════════════════════════════════
export async function getWalletBalance() {
  const response = await circleClient.getWalletTokenBalance({
    id: WALLET_ID,
  });
  return response.data?.tokenBalances || [];
}

export async function listWallets() {
  const response = await circleClient.listWallets({});
  return response.data?.wallets || [];
}

// ──────────────────── CLI Runner ────────────────────
const command = process.argv[2];

if (command) {
  const actions = {
    bridge: () => bridgeToArc(process.argv[3] || "1.00"),
    swap: () => swapTokens(process.argv[3] || "USDC", process.argv[4] || "EURC", process.argv[5] || "1.00"),
    send: () => sendTokens(process.argv[3], process.argv[4] || "1.00"),
    deposit: () => depositToUnifiedBalance(process.argv[3] || "Base_Sepolia", process.argv[4] || "1.00"),
    spend: () => spendFromUnifiedBalance(process.argv[3], process.argv[4] || "1.00"),
    balance: () => getWalletBalance().then(b => console.log("Balances:", JSON.stringify(b, null, 2))),
    wallets: () => listWallets().then(w => console.log("Wallets:", JSON.stringify(w, null, 2))),
  };

  if (actions[command]) {
    actions[command]().catch(err => {
      console.error("Error:", err.message || err);
      process.exit(1);
    });
  } else {
    console.log("Usage: tsx --env-file=.env app-kit.ts <command> [args]");
    console.log("Commands: bridge, swap, send, deposit, spend, balance, wallets");
  }
}
