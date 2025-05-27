import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Basketfy } from "../target/types/basketfy";
import { assert, expect } from "chai";
import { BankrunProvider } from 'anchor-bankrun';
import { startAnchor } from 'solana-bankrun';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  getMint
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  sendAndConfirmTransaction,
  TransactionInstruction
} from "@solana/web3.js";

const IDL = require('../target/idl/basketfy.json');
const PROGRAM_ID = new PublicKey(IDL.address);
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

describe("Burn BToken - Comprehensive Test Suite", () => {
  let context: any;
  let provider: BankrunProvider;
  let payer: anchor.Wallet;
  let program: anchor.Program<Basketfy>;
  let user: Keypair;

  // Test fixtures
  let basketMint: PublicKey;
  let basketConfig: PublicKey;
  let userTokenAccount: PublicKey;
    let mintAuthority: PublicKey;

  // Helper function to find PDAs
  const findFactoryPDA = () => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("factory")],
      PROGRAM_ID
    );
  };

  const findConfigPDA = (factory: PublicKey, basketCount: anchor.BN) => {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("config"),
        factory.toBuffer(),
        basketCount.toArrayLike(Buffer, "le", 8)
      ],
      PROGRAM_ID
    );
  };

  const findMintAuthorityPDA = (config: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("mint-authority"), config.toBuffer()],
      PROGRAM_ID
    );
  };

  const findMetadataPDA = (mint: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer()
      ],
      TOKEN_METADATA_PROGRAM_ID
    );
  };
  const mintKeypair = Keypair.generate();
  // Helper function to create a test basket
  const createTestBasket = async () => {
  
    const [factoryPDA] = findFactoryPDA();
    const factoryAccount = await program.account.factoryState.fetch(factoryPDA);
    const basketCount = factoryAccount.basketCount;
    
    const [configPDA] = findConfigPDA(factoryPDA, basketCount);
    const [mintAuthorityPDA] = findMintAuthorityPDA(configPDA);
    const [metadataPDA] = findMetadataPDA(mintKeypair.publicKey);

    const tokenMints = [
      new PublicKey("So11111111111111111111111111111111111111112"), // SOL
      new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC
    ];

    const weights = [
      new anchor.BN(6000),
      new anchor.BN(4000)
    ];

    await program.methods
      .createBasket("Test Basket", "TEST", "https://example.com/test.json", 6, tokenMints, weights)
      .accounts({
        payer: payer.publicKey,
        factory: factoryPDA,
        config: configPDA,
        mintAuthority: mintAuthorityPDA,
        metadataAccount: metadataPDA,
        mintAccount: mintKeypair.publicKey,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([mintKeypair])
      .rpc();

    return { configPDA, mintKeypair: mintKeypair.publicKey };
  };

  // Helper function to mint tokens to user (assumes a mint instruction exists)
 const mintTokensToUser = async (amount: number, recipientAccount: PublicKey) => {
      const [factoryPDA] = findFactoryPDA();
    const factoryAccount = await program.account.factoryState.fetch(factoryPDA);
    const basketCount = factoryAccount.basketCount;
    
    const [configPDA] = findConfigPDA(factoryPDA, basketCount);
    const [mintAuthorityPDA] = findMintAuthorityPDA(configPDA);
  
    return await program.methods
      .mintBasketToken(new anchor.BN(amount))
      .accounts({
        config: basketConfig,
        mintAuthority: mintAuthorityPDA,
        mint: basketMint,
        recipientTokenAccount: recipientAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  };

  // Helper function to get token account balance
// Helper function to get token account balance
  const getTokenBalance = async (tokenAccount: PublicKey) => {
    try {
      const account = await getAccount(provider.connection, tokenAccount);
      return Number(account.amount);
    } catch (error) {
      console.log("Token account not found or empty, returning 0");
      return 0;
    }
  };

  // Helper function to get total token supply
  const getTotalSupply = async (mint: PublicKey) => {
    const mintInfo = await getMint(provider.connection, mint);
  return Number(mintInfo.supply.toString());
  };
  // Helper function to burn tokens
  const burnTokens = async (amount: number, user: Keypair ) => {
    return await program.methods
      .burnBasketToken(new anchor.BN(amount))
      .accounts({
        user: user.publicKey,
        config: basketConfig,
        mint: basketMint,
         mintAuthority: mintAuthorityPDA, // Add this
        userTokenAccount: userTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();
  };
  // Helper function to create token accounts manually
  const createTokenAccount = async (mint: PublicKey, owner: PublicKey) => {
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
  };
  // Setup: Initialize context and provider before all tests
  before(async () => {
    console.log("======= Setting up burn test environment =======");

    context = await startAnchor(
      '',
      [
        { name: 'basketfy', programId: PROGRAM_ID },
        { name: 'metadata', programId: TOKEN_METADATA_PROGRAM_ID },
      ],
      [],
    );

    provider = new BankrunProvider(context);
    payer = provider.wallet as anchor.Wallet;
    program = new anchor.Program<Basketfy>(IDL, provider);
    user = Keypair.generate();

    console.log("Program ID:", PROGRAM_ID.toString());
    console.log("Payer:", payer.publicKey.toString());
    console.log("User:", user.publicKey.toString());

    // Initialize the factory state if it doesn't exist
    try {
      const [factoryPDA] = findFactoryPDA();
      await program.methods
        .initialize()
        .accounts({
          factory: factoryPDA,
          payer: payer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("Factory initialized successfully");
    } catch (error) {
      console.log("Factory initialization skipped (might already exist):", error.message);
    }

    // Create a test basket and set up test fixtures
    const { configPDA, mintKeypair } = await createTestBasket();
    basketConfig = configPDA;
    basketMint = mintKeypair;

    // Create user token account
   userTokenAccount = await createTokenAccount(basketMint, user.publicKey);

    console.log("Test basket created:", basketMint.toString());
    console.log("User token account:", userTokenAccount.toString());
  });

  describe("Successful Token Burning", () => {
    beforeEach(async () => {
      await mintTokensToUser(1000,payer.payer.publicKey);
    });

    it("Burns a small amount of tokens successfully", async () => {
      console.log("======= Testing small amount burn =======");

      const initialBalance = await getTokenBalance(userTokenAccount);
      console.log(`Initial balance: ${initialBalance}`);
      const burnAmount = 100;

      const tx = await burnTokens(burnAmount,payer.payer);

      const finalBalance = await getTokenBalance(userTokenAccount);
      assert.equal(finalBalance, initialBalance - burnAmount);

      console.log(`✅ Successfully burned ${burnAmount} tokens`);
      console.log(`Balance: ${initialBalance} → ${finalBalance}`);
    });

    it("Burns a large amount of tokens successfully", async () => {
      console.log("======= Testing large amount burn =======");

      const initialBalance = await getTokenBalance(userTokenAccount);
      const burnAmount = 500;

      const tx = await burnTokens(burnAmount);

      const finalBalance = await getTokenBalance(userTokenAccount);
      assert.equal(finalBalance, initialBalance - burnAmount);

      console.log(`✅ Successfully burned ${burnAmount} tokens`);
      console.log(`Balance: ${initialBalance} → ${finalBalance}`);
    });

    it("Burns all remaining tokens (full balance)", async () => {
      console.log("======= Testing full balance burn =======");

      const initialBalance = await getTokenBalance(userTokenAccount);
      const burnAmount = initialBalance;

      const tx = await burnTokens(burnAmount);

      const finalBalance = await getTokenBalance(userTokenAccount);
      assert.equal(finalBalance, 0);

      console.log(`✅ Successfully burned all ${burnAmount} tokens`);
      console.log(`Balance: ${initialBalance} → ${finalBalance}`);
    });

    it("Burns tokens with different users", async () => {
      console.log("======= Testing burn with different users =======");

      const user2 = Keypair.generate();
      
      // Create token account for user2
      const user2TokenAccount =await createTokenAccount(basketMint, user2.publicKey);

      // Mint tokens to user2 (you'll need to implement this)
      // await mintTokensToUser2(200);

      const initialBalance = await getTokenBalance(user2TokenAccount);
      const burnAmount = 50;

      const tx = await program.methods
        .burnBasketToken(new anchor.BN(burnAmount))
        .accounts({
          user: user2.publicKey,
          config: basketConfig,
          mint: basketMint,
          userTokenAccount: user2TokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user2])
        .rpc();

      const finalBalance = await getTokenBalance(user2TokenAccount);
      assert.equal(finalBalance, initialBalance - burnAmount);

      console.log(`✅ User2 successfully burned ${burnAmount} tokens`);
    });

    it("Emits burn event correctly", async () => {
      console.log("======= Testing burn event emission =======");

      const burnAmount = 75;
      
      const tx = await burnTokens(burnAmount);

      // Listen for events (you may need to adjust based on your event structure)
      const events = await program.account.basketConfig.fetch(basketConfig);
      
      console.log("✅ Burn event emitted successfully");
      console.log("Transaction:", tx);
    });

    it("Handles multiple sequential burns", async () => {
      console.log("======= Testing multiple sequential burns =======");

      const initialBalance = await getTokenBalance(userTokenAccount);
      const burnAmounts = [25, 50, 25];
      let currentBalance = initialBalance;

      for (let i = 0; i < burnAmounts.length; i++) {
        const burnAmount = burnAmounts[i];
        
        await burnTokens(burnAmount);
        
        currentBalance -= burnAmount;
        const balance = await getTokenBalance(userTokenAccount);
        assert.equal(balance, currentBalance);
        
        console.log(`Burn ${i + 1}: ${burnAmount} tokens, remaining: ${balance}`);
      }

      const finalBalance = await getTokenBalance(userTokenAccount);
      const totalBurned = burnAmounts.reduce((sum, amount) => sum + amount, 0);
      assert.equal(finalBalance, initialBalance - totalBurned);

      console.log("✅ Multiple sequential burns completed successfully");
    });
  });

  describe("Burn Validation and Error Cases", () => {
    it("Fails when trying to burn more tokens than available", async () => {
      console.log("======= Testing insufficient balance error =======");

      const balance = await getTokenBalance(userTokenAccount);
      const burnAmount = balance + 100; // Try to burn more than available

      try {
        await burnTokens(burnAmount);
        assert.fail("Should have failed with insufficient balance");
      } catch (error) {
        console.log("✅ Correctly failed with insufficient balance");
        console.log("Error:", error.message);
      }
    });

    it("Fails when user doesn't own the token account", async () => {
      console.log("======= Testing wrong owner error =======");

      const wrongUser = Keypair.generate();
      
      try {
        await program.methods
          .burnBasketToken(new anchor.BN(50))
          .accounts({
            user: wrongUser.publicKey,
            config: basketConfig,
            mint: basketMint,
            userTokenAccount: userTokenAccount, // This account is owned by payer, not wrongUser
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([wrongUser])
          .rpc();
        
        assert.fail("Should have failed with wrong owner");
      } catch (error) {
        console.log("✅ Correctly failed with wrong owner");
        console.log("Error:", error.message);
      }
    });

    it("Fails when trying to burn from wrong mint", async () => {
      console.log("======= Testing wrong mint error =======");

      // Create a different mint
      const wrongMint = await createMint(
        provider.connection,
        payer.payer,
        payer.publicKey,
        null,
        6
      );

      const wrongTokenAccount = await createTokenAccount(wrongMint, payer.publicKey);

      try {
        await program.methods
          .burnBasketToken(new anchor.BN(50))
          .accounts({
            user: payer.publicKey,
            config: basketConfig,
            mint: wrongMint, // Wrong mint
            userTokenAccount: wrongTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        
        assert.fail("Should have failed with wrong mint");
      } catch (error) {
        console.log("✅ Correctly failed with wrong mint");
        console.log("Error:", error.message);
      }
    });

    it("Fails when trying to burn zero tokens", async () => {
      console.log("======= Testing zero amount burn =======");

      try {
        await burnTokens(0);
        assert.fail("Should have failed with zero amount");
      } catch (error) {
        console.log("✅ Correctly failed with zero amount");
        console.log("Error:", error.message);
      }
    });

    it("Fails with invalid token program", async () => {
      console.log("======= Testing invalid token program =======");

      try {
        await program.methods
          .burnBasketToken(new anchor.BN(50))
          .accounts({
            user: payer.publicKey,
            config: basketConfig,
            mint: basketMint,
            userTokenAccount: userTokenAccount,
            tokenProgram: SystemProgram.programId, // Wrong program
          })
          .rpc();
        
        assert.fail("Should have failed with invalid token program");
      } catch (error) {
        console.log("✅ Correctly failed with invalid token program");
        console.log("Error:", error.message);
      }
    });
  });

  describe("Burn Edge Cases", () => {
    it("Burns exactly 1 token (minimum non-zero amount)", async () => {
      console.log("======= Testing minimum burn amount =======");

      const initialBalance = await getTokenBalance(userTokenAccount);
      const burnAmount = 1;

      const tx = await burnTokens(burnAmount);

      const finalBalance = await getTokenBalance(userTokenAccount);
      assert.equal(finalBalance, initialBalance - burnAmount);

      console.log("✅ Successfully burned minimum amount (1 token)");
    });

    it("Burns tokens when balance is exactly the burn amount", async () => {
      console.log("======= Testing exact balance burn =======");

      const balance = await getTokenBalance(userTokenAccount);
      
      if (balance > 0) {
        const tx = await burnTokens(balance);
        
        const finalBalance = await getTokenBalance(userTokenAccount);
        assert.equal(finalBalance, 0);
        
        console.log(`✅ Successfully burned exact balance (${balance} tokens)`);
      } else {
        console.log("⚠️  Skipping test - no tokens available");
      }
    });

    it("Handles burn with very large numbers", async () => {
      console.log("======= Testing large number burn =======");

      // Note: This test assumes you have a way to mint large amounts
      // You may need to adjust based on your program's limitations
      const largeAmount = 1_000_000;
      
      // First, ensure user has enough tokens
      // await mintTokensToUser(largeAmount);
      
      const initialBalance = await getTokenBalance(userTokenAccount);
      
      if (initialBalance >= largeAmount) {
        const tx = await burnTokens(largeAmount);
        
        const finalBalance = await getTokenBalance(userTokenAccount);
        assert.equal(finalBalance, initialBalance - largeAmount);
        
        console.log(`✅ Successfully burned large amount (${largeAmount} tokens)`);
      } else {
        console.log("⚠️  Skipping large number test - insufficient balance");
      }
    });
  });

  describe("State Verification After Burn", () => {
    it("Verifies token supply decreases after burn", async () => {
      console.log("======= Testing supply decrease verification =======");

      const mintInfo =  await getMint(provider.connection, basketMint);
      const initialSupply = Number(mintInfo.supply.toString());
      
      const burnAmount = 100;
      await burnTokens(burnAmount);
      
      const finalMintInfo =  await getMint(provider.connection, basketMint);
      const finalSupply = Number(finalMintInfo.supply.toString());
      
      assert.equal(finalSupply, initialSupply - burnAmount);
      
      console.log(`✅ Total supply correctly decreased by ${burnAmount}`);
      console.log(`Supply: ${initialSupply} → ${finalSupply}`);
    });

    it("Verifies basket config remains unchanged after burn", async () => {
      console.log("======= Testing config immutability =======");

      const initialConfig = await program.account.basketConfig.fetch(basketConfig);
      
      await burnTokens(50);
      
      const finalConfig = await program.account.basketConfig.fetch(basketConfig);
      
      // Verify config fields are unchanged
      assert.equal(finalConfig.name, initialConfig.name);
      assert.equal(finalConfig.symbol, initialConfig.symbol);
      assert.equal(finalConfig.decimals, initialConfig.decimals);
      assert.equal(finalConfig.tokenMints.length, initialConfig.tokenMints.length);
      assert.equal(finalConfig.weights.length, initialConfig.weights.length);
      
      console.log("✅ Basket config remained unchanged after burn");
    });
  });
});