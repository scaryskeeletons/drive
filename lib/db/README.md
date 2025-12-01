# DriveBy Backend - Database & Solana Integration

## Environment Variables

```env
# Database (Vercel Postgres)
POSTGRES_PRISMA_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."

# Solana Configuration
SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"  # or devnet for testing
GAME_MASTER_WALLET="<public-key>"
GAME_MASTER_PRIVATE_KEY="<base58-or-json-array>"
ACCEPTED_TOKEN_MINT="<spl-token-mint-address>"
TOKEN_DECIMALS="9"  # Usually 9 for most tokens

# Security
WALLET_ENCRYPTION_KEY="<strong-random-key>"
ADMIN_API_KEY="<api-key-for-admin-endpoints>"
```

---

## Token Support

### SPL Tokens (Token Program)

- Original Solana token standard
- Uses `TOKEN_PROGRAM_ID`
- Most common tokens (USDC, etc.)

### Token-2022 (Token Extensions)

- Newer standard with extensions
- Uses `TOKEN_2022_PROGRAM_ID`
- Supports: transfer fees, confidential transfers, metadata
- **Auto-detected** - no configuration needed

The system automatically detects which program a token uses.

---

## Fee Sponsorship

All user transactions have fees paid by the game master wallet:

- **Priority Fee**: 0.0001 SOL per transaction
- **Compute Units**: 200,000 per transfer
- Users never need SOL for gas

```typescript
// Game master signs and pays for all transfers
await SolanaService.transferFromGameMaster(destinationWallet, amount);
```

---

## Balance Types

| Balance               | Description                    |
| --------------------- | ------------------------------ |
| `balance`             | Total token balance            |
| `pendingBalance`      | Locked in active games         |
| `lockedBalance`       | Locked for pending withdrawals |
| `withdrawableBalance` | `balance - pending - locked`   |

**Double-spend protection**: Users can only bet/withdraw from `withdrawableBalance`.

---

## Service Layer

### WalletService

```typescript
import { WalletService } from "@/lib/db";

// Create custodial wallet
const wallet = await WalletService.createWallet(userId);

// Get balances
const balances = await WalletService.getByUserId(userId);
```

### DepositService

```typescript
import { DepositService } from "@/lib/db";

// Process blockchain deposit
const result = await DepositService.processDeposit(userId, txSignature);

// Request withdrawal (locks funds)
const withdrawal = await DepositService.requestWithdrawal(
  userId,
  amount,
  destinationAddress
);

// Process pending withdrawal (called by cron)
await DepositService.processWithdrawal(withdrawalId);
```

### BalanceService

```typescript
import { BalanceService } from "@/lib/db";

// Check if user can bet
const canBet = await BalanceService.canPlaceBet(userId, amount);

// Lock funds for game
await BalanceService.lockForGame(userId, amount, gameId);

// Credit winnings after win
await BalanceService.creditWinnings(userId, wager, payout, gameId);

// Deduct after loss
await BalanceService.deductLoss(userId, amount, gameId);
```

### SolanaService

```typescript
import { SolanaService } from "@/lib/solana";

// Get token balance
const balance = await SolanaService.getTokenBalance(walletAddress);

// Validate deposit on-chain
const deposit = await SolanaService.validateDeposit(txSignature, wallet);

// Transfer to game master (fee sponsored)
await SolanaService.transferToGameMaster(userKeypair, amount);

// Transfer from game master (fee sponsored)
await SolanaService.transferFromGameMaster(destinationWallet, amount);

// Batch payouts (up to 10)
await SolanaService.batchPayout([
  { destinationWallet: "...", amount: 1.5 },
  { destinationWallet: "...", amount: 2.0 },
]);
```

---

## API Routes

### Wallet Operations

```
GET  /api/wallet?userId=         - Get wallet info
POST /api/wallet/deposit         - Process deposit
POST /api/wallet/withdraw        - Request withdrawal
GET  /api/wallet/withdraw        - Get pending withdrawals
DELETE /api/wallet/withdraw      - Cancel withdrawal
```

### Admin (Protected)

```
GET  /api/admin/process-withdrawals  - Get pending count
POST /api/admin/process-withdrawals  - Process all pending
GET  /api/health                     - System health check
```

---

## Cron Job Setup (Vercel)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/admin/process-withdrawals",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

This processes pending withdrawals every 5 minutes.

---

## Security Considerations

1. **Private Keys**: Store in environment variables, never in code
2. **Encryption**: Implement proper key encryption for custodial wallets
3. **Admin Routes**: Protect with API keys or authentication
4. **Double-Spend**: Balance locking prevents race conditions
5. **Transaction Validation**: All deposits verified on-chain

---

## Monitoring

Health check at `/api/health` returns:

- Database connection status
- Solana RPC connection
- Game master balances (SOL + tokens)
- Pending withdrawal counts

```json
{
  "status": "healthy",
  "checks": {
    "database": { "status": "ok" },
    "solana": { "status": "ok", "value": { "gameMasterSOL": 1.5 } },
    "gameMasterTokens": { "status": "ok", "value": { "balance": 10000 } },
    "withdrawals": {
      "status": "ok",
      "value": { "pending": 2, "processing": 0 }
    }
  }
}
```
