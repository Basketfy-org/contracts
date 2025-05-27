import { Ed25519Program, PublicKey, SystemProgram, Keypair, Transaction, TransactionInstruction, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount, getMint, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Basketfy } from "../target/types/basketfy";
import { BankrunProvider } from 'anchor-bankrun';

export interface TokenPDAs {
  config: PublicKey;
  mintAuthority: PublicKey;
  metadata: PublicKey;
  factory: PublicKey;
}

export function calculatePDAs(mint: PublicKey, basketCount: anchor.BN, programId: PublicKey, metadataId: PublicKey): TokenPDAs {
  const [factory] = PublicKey.findProgramAddressSync(
    [Buffer.from("factory"), mint.toBuffer()],
    programId
  );

  const [config] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("config"),
      factory.toBuffer(),
      basketCount.toArrayLike(Buffer, "le", 8)
    ],
    programId
  );

  const [mintAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint-authority"), config.toBuffer()],
    programId
  );

  const [metadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      metadataId.toBuffer(),
      mint.toBuffer()
    ],
    metadataId
  );

  return {
    config,
    mintAuthority,
    metadata,
    factory
  };
}

// Helper function to find Factory PDA
export function findFactoryPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("factory")],
    programId
  );
}

// Helper function to find Config PDA
export function findConfigPDA(factory: PublicKey, basketCount: anchor.BN, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("config"),
      factory.toBuffer(),
      basketCount.toArrayLike(Buffer, "le", 8)
    ],
    programId
  );
}

// Helper function to find Mint Authority PDA
export function findMintAuthorityPDA(config: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mint-authority"), config.toBuffer()],
    programId
  );
}

// Helper function to find Metadata PDA
export function findMetadataPDA(mint: PublicKey, metadataProgramId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      metadataProgramId.toBuffer(),
      mint.toBuffer()
    ],
    metadataProgramId
  );
}

// Helper function to get token account balance
export async function getTokenBalance(provider: BankrunProvider, tokenAccount: PublicKey): Promise<number> {
  try {
    const account = await getAccount(provider.connection, tokenAccount);
    return Number(account.amount);
  } catch (error) {
    console.log("Token account not found or empty, returning 0");
    return 0;
  }
}

// Helper function to get total token supply
export async function getTotalSupply(provider: BankrunProvider, mint: PublicKey): Promise<number> {
  const mintInfo = await getMint(provider.connection, mint);
  return Number(mintInfo.supply.toString());
}

// Helper function to create token accounts manually
export async function createTokenAccount(
  provider: BankrunProvider,
  mint: PublicKey,
  owner: PublicKey,
  payer: anchor.Wallet
): Promise<PublicKey> {
  const tokenAccount = Keypair.generate();
  const rentExemption = await provider.connection.getMinimumBalanceForRentExemption(165);

  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: tokenAccount.publicKey,
    lamports: rentExemption,
    space: 165,
    programId: TOKEN_PROGRAM_ID,
  });

  const initAccountIx = new TransactionInstruction({
    keys: [
      { pubkey: tokenAccount.publicKey, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data: Buffer.from([1]), // InitializeAccount instruction
  });

  const tx = new Transaction().add(createAccountIx, initAccountIx);
  await provider.sendAndConfirm(tx, [tokenAccount]);

  return tokenAccount.publicKey;
}

// Helper function to create a test basket
export async function createTestBasket(
  program: Program<Basketfy>,
  payer: anchor.Wallet,
  programId: PublicKey,
  metadataProgramId: PublicKey
): Promise<{ configPDA: PublicKey; mintKeypair: PublicKey; mintAuthorityPDA: PublicKey }> {
  const mintKeypair = Keypair.generate();
  const [factoryPDA] = findFactoryPDA(programId);
  const factoryAccount = await program.account.factoryState.fetch(factoryPDA);
  const basketCount = factoryAccount.basketCount;

  const [configPDA] = findConfigPDA(factoryPDA, basketCount, programId);
  const [mintAuthorityPDA] = findMintAuthorityPDA(configPDA, programId);
  const [metadataPDA] = findMetadataPDA(mintKeypair.publicKey, metadataProgramId);

  const tokenMints = [
    new PublicKey("So11111111111111111111111111111111111111112"), // SOL
    new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC
  ];

  const weights = [
    new anchor.BN(6000),
    new anchor.BN(4000)
  ];

  await program.methods
    .createBasket("Test Basket", "TBASKET", "https://example.com/test.json", 6, tokenMints, weights)
    .accounts({
      payer: payer.publicKey,
      factory: factoryPDA,
      config: configPDA,
      mintAuthority: mintAuthorityPDA,
      metadataAccount: metadataPDA,
      mintAccount: mintKeypair.publicKey,
      tokenMetadataProgram: metadataProgramId,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([mintKeypair])
    .rpc();

  return { configPDA, mintKeypair: mintKeypair.publicKey, mintAuthorityPDA };
}

// Helper function to mint tokens
export async function mintTokens(
  program: Program<Basketfy>,
  amount: number,
  config: PublicKey,
  mintAuthority: PublicKey,
  mint: PublicKey,
  recipientAccount: PublicKey
): Promise<string> {
  return await program.methods
    .mintBasketToken(new anchor.BN(amount))
    .accounts({
      config: config,
      mintAuthority: mintAuthority,
      mint: mint,
      recipientTokenAccount: recipientAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

// Helper function to initialize factory if it doesn't exist
export async function initializeFactory(
  program: Program<Basketfy>,
  payer: anchor.Wallet,
  programId: PublicKey
): Promise<void> {
  try {
    const [factoryPDA] = findFactoryPDA(programId);
    await program.methods
      .initialize()
      .accounts({
        factory: factoryPDA,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("Factory initialized successfully");
  } catch (error: any) {
    console.log("Factory initialization skipped (might already exist):", error.message);
  }
}

export async function debugPDACalculation(
  program: Program<Basketfy>,
  basketMint: PublicKey,
  basketConfig: PublicKey,
  mintAuthority: PublicKey,
  programId: PublicKey,
  metadataId: PublicKey
): Promise<void> {
  console.log("=== PDA Debug Information ===");
  
  // Get factory info
  const [factoryPDA] = findFactoryPDA(programId);
  const factoryAccount = await program.account.factoryState.fetch(factoryPDA);
  
  console.log("Factory PDA:", factoryPDA.toString());
  console.log("Factory basket count:", factoryAccount.basketCount.toString());
  
  // Get config info
  const configAccount = await program.account.basketConfig.fetch(basketConfig);
  console.log("Config account mint:", configAccount.mint.toString());
  console.log("Config account basket ID:", configAccount.basketId?.toString() || "N/A");
  
  // Try different basket indices
  for (let i = 0; i < factoryAccount.basketCount.toNumber(); i++) {
    const testIndex = new anchor.BN(i);
    const [testConfig] = findConfigPDAWithFactory(factoryPDA, testIndex, programId);
    
    console.log(`Index ${i}: ${testConfig.toString()} ${testConfig.equals(basketConfig) ? '✅ MATCH' : ''}`);
    
    if (testConfig.equals(basketConfig)) {
      console.log(`Found matching config at index ${i}`);
      const [testMintAuth] = findMintAuthorityPDA(testConfig, programId);
      console.log(`Mint authority matches: ${testMintAuth.equals(mintAuthority) ? '✅ YES' : '❌ NO'}`);
      break;
    }
  }
}

// Alternative version that takes factory PDA directly
export function findConfigPDAWithFactory(factoryPDA: PublicKey, basketCount: anchor.BN, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("config"),
      factoryPDA.toBuffer(),
      basketCount.toArrayLike(Buffer, "le", 8)
    ],
    programId
  );
}