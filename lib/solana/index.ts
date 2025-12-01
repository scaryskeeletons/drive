// Solana token service - handles SPL and Token-2022 operations
// With fee sponsorship for user transactions

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  clusterApiUrl,
  ComputeBudgetProgram,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getMint,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";

// ============================================
// CONFIGURATION
// ============================================

const RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl("devnet");
const GAME_MASTER_WALLET = process.env.GAME_MASTER_WALLET || "";
const GAME_MASTER_PRIVATE_KEY = process.env.GAME_MASTER_PRIVATE_KEY || "";
const ACCEPTED_TOKEN_MINT = process.env.ACCEPTED_TOKEN_MINT || "";

// Priority fee: 0.0001 SOL = 100,000 microlamports
const PRIORITY_FEE_LAMPORTS = 100_000;
// Compute units for token transfers (usually ~200k is enough)
const COMPUTE_UNITS = 200_000;

// Create connection with confirmed commitment
export const connection = new Connection(RPC_URL, {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 60000,
});

// ============================================
// TOKEN STANDARD DETECTION
// ============================================

export interface TokenInfo {
  mint: PublicKey;
  programId: PublicKey;
  decimals: number;
  isToken2022: boolean;
}

// Detect if a mint is Token-2022 or standard SPL
export async function getTokenInfo(mintAddress: string): Promise<TokenInfo> {
  const mint = new PublicKey(mintAddress);
  
  // First try Token-2022
  try {
    const accountInfo = await connection.getAccountInfo(mint);
    if (!accountInfo) {
      throw new Error("Mint account not found");
    }

    const isToken2022 = accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID);
    const programId = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
    
    // Get mint info to get decimals
    const mintInfo = await getMint(connection, mint, "confirmed", programId);
    
    return {
      mint,
      programId,
      decimals: mintInfo.decimals,
      isToken2022,
    };
  } catch (error) {
    // Default to standard SPL if detection fails
    console.error("Error detecting token type:", error);
    return {
      mint,
      programId: TOKEN_PROGRAM_ID,
      decimals: 9,
      isToken2022: false,
    };
  }
}

// Cache token info to avoid repeated RPC calls
let cachedTokenInfo: TokenInfo | null = null;

export async function getAcceptedTokenInfo(): Promise<TokenInfo> {
  if (cachedTokenInfo) return cachedTokenInfo;
  
  if (!ACCEPTED_TOKEN_MINT) {
    throw new Error("ACCEPTED_TOKEN_MINT not configured");
  }
  
  cachedTokenInfo = await getTokenInfo(ACCEPTED_TOKEN_MINT);
  return cachedTokenInfo;
}

// ============================================
// GAME MASTER WALLET
// ============================================

let gameMasterKeypair: Keypair | null = null;

export function getGameMasterKeypair(): Keypair {
  if (gameMasterKeypair) return gameMasterKeypair;
  
  if (!GAME_MASTER_PRIVATE_KEY) {
    throw new Error("GAME_MASTER_PRIVATE_KEY not configured");
  }
  
  try {
    // Support both base58 and JSON array formats
    let secretKey: Uint8Array;
    
    if (GAME_MASTER_PRIVATE_KEY.startsWith("[")) {
      // JSON array format
      secretKey = new Uint8Array(JSON.parse(GAME_MASTER_PRIVATE_KEY));
    } else {
      // Base58 format
      secretKey = bs58.decode(GAME_MASTER_PRIVATE_KEY);
    }
    
    gameMasterKeypair = Keypair.fromSecretKey(secretKey);
    
    // Verify it matches the expected public key
    if (GAME_MASTER_WALLET && !gameMasterKeypair.publicKey.equals(new PublicKey(GAME_MASTER_WALLET))) {
      throw new Error("Game master private key does not match configured public key");
    }
    
    return gameMasterKeypair;
  } catch (error) {
    throw new Error(`Failed to load game master keypair: ${error}`);
  }
}

export function getGameMasterPublicKey(): PublicKey {
  if (GAME_MASTER_WALLET) {
    return new PublicKey(GAME_MASTER_WALLET);
  }
  return getGameMasterKeypair().publicKey;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Convert UI amount to token amount (with decimals)
export function toTokenAmount(uiAmount: number, decimals: number): bigint {
  return BigInt(Math.floor(uiAmount * Math.pow(10, decimals)));
}

// Convert token amount to UI amount
export function toUIAmount(tokenAmount: bigint, decimals: number): number {
  return Number(tokenAmount) / Math.pow(10, decimals);
}

// Create priority fee instructions
function createPriorityFeeInstructions(): TransactionInstruction[] {
  return [
    // Set compute unit limit
    ComputeBudgetProgram.setComputeUnitLimit({
      units: COMPUTE_UNITS,
    }),
    // Set priority fee (in microlamports per compute unit)
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: Math.floor(PRIORITY_FEE_LAMPORTS / COMPUTE_UNITS * 1_000_000),
    }),
  ];
}

// Get or create associated token account
async function getOrCreateATA(
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  programId: PublicKey
): Promise<{ ata: PublicKey; instruction: TransactionInstruction | null }> {
  const ata = getAssociatedTokenAddressSync(mint, owner, false, programId);
  
  try {
    await getAccount(connection, ata, "confirmed", programId);
    return { ata, instruction: null };
  } catch {
    // ATA doesn't exist, create it
    const instruction = createAssociatedTokenAccountInstruction(
      payer,
      ata,
      owner,
      mint,
      programId
    );
    return { ata, instruction };
  }
}

// ============================================
// BALANCE OPERATIONS
// ============================================

export const SolanaService = {
  // Get SOL balance for fee checking
  async getSOLBalance(walletAddress: string): Promise<number> {
    try {
      const pubkey = new PublicKey(walletAddress);
      const balance = await connection.getBalance(pubkey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error("Error getting SOL balance:", error);
      return 0;
    }
  },

  // Get token balance for a wallet
  async getTokenBalance(walletAddress: string): Promise<number> {
    try {
      const tokenInfo = await getAcceptedTokenInfo();
      const wallet = new PublicKey(walletAddress);
      
      const ata = getAssociatedTokenAddressSync(
        tokenInfo.mint,
        wallet,
        false,
        tokenInfo.programId
      );
      
      try {
        const account = await getAccount(connection, ata, "confirmed", tokenInfo.programId);
        return toUIAmount(account.amount, tokenInfo.decimals);
      } catch {
        // ATA doesn't exist yet, balance is 0
        return 0;
      }
    } catch (error) {
      console.error("Error getting token balance:", error);
      return 0;
    }
  },

  // Validate a deposit transaction on-chain
  async validateDeposit(
    txSignature: string,
    expectedWallet: string
  ): Promise<{
    valid: boolean;
    amount: number;
    from: string;
    tokenMint: string;
  } | null> {
    try {
      const tokenInfo = await getAcceptedTokenInfo();
      
      const tx = await connection.getTransaction(txSignature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      if (!tx || !tx.meta) {
        return null;
      }

      // Check if transaction was successful
      if (tx.meta.err) {
        return null;
      }

      // Parse token transfers from the transaction
      const preBalances = tx.meta.preTokenBalances || [];
      const postBalances = tx.meta.postTokenBalances || [];

      // Find transfer to our wallet
      for (const post of postBalances) {
        if (
          post.owner === expectedWallet &&
          post.mint === tokenInfo.mint.toBase58()
        ) {
          const pre = preBalances.find(
            (p) => p.accountIndex === post.accountIndex
          );
          const preAmount = pre ? BigInt(pre.uiTokenAmount.amount) : BigInt(0);
          const postAmount = BigInt(post.uiTokenAmount.amount);
          const diff = postAmount - preAmount;

          if (diff > 0) {
            // Find sender
            const sender = preBalances.find(
              (p) =>
                p.mint === tokenInfo.mint.toBase58() &&
                p.owner !== expectedWallet
            );

            return {
              valid: true,
              amount: toUIAmount(diff, tokenInfo.decimals),
              from: sender?.owner || "unknown",
              tokenMint: post.mint,
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error("Error validating deposit:", error);
      return null;
    }
  },

  // ============================================
  // SPONSORED TRANSFERS (Game Master pays fees)
  // ============================================

  // Transfer tokens from user's custodial wallet to game master
  // Fee sponsored by game master
  async transferToGameMaster(
    userKeypair: Keypair,
    amount: number
  ): Promise<string> {
    const tokenInfo = await getAcceptedTokenInfo();
    const gameMaster = getGameMasterKeypair();
    
    // Get ATAs
    const userAta = getAssociatedTokenAddressSync(
      tokenInfo.mint,
      userKeypair.publicKey,
      false,
      tokenInfo.programId
    );
    
    const { ata: gameMasterAta, instruction: createAtaIx } = await getOrCreateATA(
      gameMaster.publicKey, // Game master pays for ATA creation
      gameMaster.publicKey,
      tokenInfo.mint,
      tokenInfo.programId
    );

    // Build transaction
    const instructions: TransactionInstruction[] = [
      // Priority fees (paid by game master as fee payer)
      ...createPriorityFeeInstructions(),
    ];

    // Add ATA creation if needed
    if (createAtaIx) {
      instructions.push(createAtaIx);
    }

    // Add transfer instruction using transferChecked for Token-2022 compatibility
    instructions.push(
      createTransferCheckedInstruction(
        userAta,
        tokenInfo.mint,
        gameMasterAta,
        userKeypair.publicKey,
        toTokenAmount(amount, tokenInfo.decimals),
        tokenInfo.decimals,
        [],
        tokenInfo.programId
      )
    );

    // Create transaction with game master as fee payer
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    const transaction = new Transaction({
      feePayer: gameMaster.publicKey,
      blockhash,
      lastValidBlockHeight,
    }).add(...instructions);

    // Sign with both game master (fee payer) and user (token owner)
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [gameMaster, userKeypair],
      { commitment: "confirmed" }
    );

    return signature;
  },

  // Transfer tokens from game master to user (for payouts/withdrawals)
  // Fee sponsored by game master
  async transferFromGameMaster(
    destinationWallet: string,
    amount: number
  ): Promise<string> {
    const tokenInfo = await getAcceptedTokenInfo();
    const gameMaster = getGameMasterKeypair();
    const destination = new PublicKey(destinationWallet);

    // Get ATAs
    const gameMasterAta = getAssociatedTokenAddressSync(
      tokenInfo.mint,
      gameMaster.publicKey,
      false,
      tokenInfo.programId
    );

    const { ata: destinationAta, instruction: createAtaIx } = await getOrCreateATA(
      gameMaster.publicKey, // Game master pays for ATA creation
      destination,
      tokenInfo.mint,
      tokenInfo.programId
    );

    // Build transaction
    const instructions: TransactionInstruction[] = [
      // Priority fees
      ...createPriorityFeeInstructions(),
    ];

    // Add ATA creation if needed
    if (createAtaIx) {
      instructions.push(createAtaIx);
    }

    // Add transfer instruction using transferChecked for Token-2022 compatibility
    instructions.push(
      createTransferCheckedInstruction(
        gameMasterAta,
        tokenInfo.mint,
        destinationAta,
        gameMaster.publicKey,
        toTokenAmount(amount, tokenInfo.decimals),
        tokenInfo.decimals,
        [],
        tokenInfo.programId
      )
    );

    // Create and send transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    const transaction = new Transaction({
      feePayer: gameMaster.publicKey,
      blockhash,
      lastValidBlockHeight,
    }).add(...instructions);

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [gameMaster],
      { commitment: "confirmed" }
    );

    return signature;
  },

  // ============================================
  // BATCH OPERATIONS (for efficiency)
  // ============================================

  // Process multiple payouts in a single transaction
  async batchPayout(
    payouts: Array<{ destinationWallet: string; amount: number }>
  ): Promise<string> {
    if (payouts.length === 0) {
      throw new Error("No payouts to process");
    }

    if (payouts.length > 10) {
      throw new Error("Too many payouts in single batch (max 10)");
    }

    const tokenInfo = await getAcceptedTokenInfo();
    const gameMaster = getGameMasterKeypair();

    const gameMasterAta = getAssociatedTokenAddressSync(
      tokenInfo.mint,
      gameMaster.publicKey,
      false,
      tokenInfo.programId
    );

    // Build transaction
    const instructions: TransactionInstruction[] = [
      // Priority fees (higher for batch)
      ComputeBudgetProgram.setComputeUnitLimit({
        units: COMPUTE_UNITS * payouts.length,
      }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: Math.floor(PRIORITY_FEE_LAMPORTS / COMPUTE_UNITS * 1_000_000),
      }),
    ];

    // Add transfers for each payout
    for (const payout of payouts) {
      const destination = new PublicKey(payout.destinationWallet);
      
      const { ata: destinationAta, instruction: createAtaIx } = await getOrCreateATA(
        gameMaster.publicKey,
        destination,
        tokenInfo.mint,
        tokenInfo.programId
      );

      if (createAtaIx) {
        instructions.push(createAtaIx);
      }

      instructions.push(
        createTransferCheckedInstruction(
          gameMasterAta,
          tokenInfo.mint,
          destinationAta,
          gameMaster.publicKey,
          toTokenAmount(payout.amount, tokenInfo.decimals),
          tokenInfo.decimals,
          [],
          tokenInfo.programId
        )
      );
    }

    // Create and send transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    const transaction = new Transaction({
      feePayer: gameMaster.publicKey,
      blockhash,
      lastValidBlockHeight,
    }).add(...instructions);

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [gameMaster],
      { commitment: "confirmed" }
    );

    return signature;
  },

  // ============================================
  // UTILITY METHODS
  // ============================================

  // Get accepted token mint address
  getAcceptedTokenMint(): string {
    return ACCEPTED_TOKEN_MINT;
  },

  // Get token decimals
  async getTokenDecimals(): Promise<number> {
    const tokenInfo = await getAcceptedTokenInfo();
    return tokenInfo.decimals;
  },

  // Check if token is Token-2022
  async isToken2022(): Promise<boolean> {
    const tokenInfo = await getAcceptedTokenInfo();
    return tokenInfo.isToken2022;
  },

  // Get game master's token balance (for monitoring)
  async getGameMasterBalance(): Promise<number> {
    const gameMaster = getGameMasterPublicKey();
    return this.getTokenBalance(gameMaster.toBase58());
  },

  // Get game master's SOL balance (for fee monitoring)
  async getGameMasterSOLBalance(): Promise<number> {
    const gameMaster = getGameMasterPublicKey();
    return this.getSOLBalance(gameMaster.toBase58());
  },

  // Subscribe to token account changes (for deposit detection)
  subscribeToDeposits(
    walletAddress: string,
    callback: (balance: number) => void
  ): number {
    const wallet = new PublicKey(walletAddress);

    const subscriptionId = connection.onAccountChange(
      wallet,
      async () => {
        const balance = await this.getTokenBalance(walletAddress);
        callback(balance);
      },
      "confirmed"
    );

    return subscriptionId;
  },

  // Unsubscribe from account changes
  unsubscribeFromDeposits(subscriptionId: number): void {
    connection.removeAccountChangeListener(subscriptionId);
  },
};
