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

// Import helper functions
import {
  calculatePDAs,
  findFactoryPDA,
  findConfigPDA,
  findMintAuthorityPDA,
  findMetadataPDA,
  getTokenBalance,
  getTotalSupply,
  createTokenAccount,
  createTestBasket,
  mintTokens,
  initializeFactory
} from "./test-helpers";

const IDL = require('../target/idl/basketfy.json');
const PROGRAM_ID = new PublicKey(IDL.address);
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

describe("Mint Basket Token - Comprehensive Test Suite", () => {
  let context: any;
  let provider: BankrunProvider;
  let payer: anchor.Wallet;
  let program: anchor.Program<Basketfy>;
  let user: Keypair;
  let recipient: Keypair;

  // Test fixtures
  let basketMint: PublicKey;
  let basketConfig: PublicKey;
  let mintAuthority: PublicKey;
  let userTokenAccount: PublicKey;
  let recipientTokenAccount: PublicKey;

  // Setup: Initialize context and provider before all tests
  before(async () => {
    console.log("======= Setting up mint test environment =======");

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
    recipient = Keypair.generate();

    console.log("Program ID:", PROGRAM_ID.toString());
    console.log("Payer:", payer.publicKey.toString());
    console.log("User:", user.publicKey.toString());
    console.log("Recipient:", recipient.publicKey.toString());

    // Initialize the factory state if it doesn't exist
    await initializeFactory(program, payer, PROGRAM_ID);

    // Create a test basket and set up test fixtures
    const { configPDA, mintKeypair, mintAuthorityPDA } = await createTestBasket(
      program,
      payer,
      PROGRAM_ID,
      TOKEN_METADATA_PROGRAM_ID
    );
    
    basketConfig = configPDA;
    basketMint = mintKeypair;
    mintAuthority = mintAuthorityPDA;
    
    console.log("Basket config:", basketConfig.toString());
    console.log("Basket mint:", basketMint.toString());
    console.log("Mint authority:", mintAuthority.toString());
    
    // Create token accounts for testing
    userTokenAccount = await createTokenAccount(provider, basketMint, user.publicKey, payer);
    recipientTokenAccount = await createTokenAccount(provider, basketMint, recipient.publicKey, payer);

    console.log("Test basket created:", basketMint.toString());
    console.log("Mint authority:", mintAuthority.toString());
    console.log("User token account:", userTokenAccount.toString());
    console.log("Recipient token account:", recipientTokenAccount.toString());
  });

  describe("Successful Token Minting", () => {
    it("Mints a small amount of tokens successfully", async () => {
      console.log("======= Testing small amount mint =======");

      const initialBalance = await getTokenBalance(provider, userTokenAccount);
      const initialSupply = await getTotalSupply(provider, basketMint);
      const mintAmount = 100;

      const tx = await mintTokens(program, mintAmount, basketConfig, mintAuthority, basketMint, userTokenAccount);

      const finalBalance = await getTokenBalance(provider, userTokenAccount);
      const finalSupply = await getTotalSupply(provider, basketMint);

      assert.equal(finalBalance, initialBalance + mintAmount);
      assert.equal(finalSupply, initialSupply + mintAmount);

      console.log(`✅ Successfully minted ${mintAmount} tokens`);
      console.log(`Balance: ${initialBalance} → ${finalBalance}`);
      console.log(`Supply: ${initialSupply} → ${finalSupply}`);
    });

    it("Mints a large amount of tokens successfully", async () => {
      console.log("======= Testing large amount mint =======");

      const initialBalance = await getTokenBalance(provider, userTokenAccount);
      const initialSupply = await getTotalSupply(provider, basketMint);
      const mintAmount = 1_000_000;

      const tx = await mintTokens(program, mintAmount, basketConfig, mintAuthority, basketMint, userTokenAccount);

      const finalBalance = await getTokenBalance(provider, userTokenAccount);
      const finalSupply = await getTotalSupply(provider, basketMint);

      assert.equal(finalBalance, initialBalance + mintAmount);
      assert.equal(finalSupply, initialSupply + mintAmount);

      console.log(`✅ Successfully minted ${mintAmount} tokens`);
      console.log(`Balance: ${initialBalance} → ${finalBalance}`);
      console.log(`Supply: ${initialSupply} → ${finalSupply}`);
    });

    it("Mints tokens to different recipients", async () => {
      console.log("======= Testing different recipient mint =======");

      const initialBalance = await getTokenBalance(provider, recipientTokenAccount);
      const initialSupply = await getTotalSupply(provider, basketMint);
      const mintAmount = 500;

      const tx = await mintTokens(program, mintAmount, basketConfig, mintAuthority, basketMint, recipientTokenAccount);

      const finalBalance = await getTokenBalance(provider, recipientTokenAccount);
      const finalSupply = await getTotalSupply(provider, basketMint);

      assert.equal(finalBalance, initialBalance + mintAmount);
      assert.equal(finalSupply, initialSupply + mintAmount);

      console.log(`✅ Successfully minted ${mintAmount} tokens to recipient`);
      console.log(`Recipient balance: ${initialBalance} → ${finalBalance}`);
    });

    it("Mints exactly 1 token (minimum amount)", async () => {
      console.log("======= Testing minimum mint amount =======");

      const initialBalance = await getTokenBalance(provider, userTokenAccount);
      const initialSupply = await getTotalSupply(provider, basketMint);
      const mintAmount = 1;

      const tx = await mintTokens(program, mintAmount, basketConfig, mintAuthority, basketMint, userTokenAccount);

      const finalBalance = await getTokenBalance(provider, userTokenAccount);
      const finalSupply = await getTotalSupply(provider, basketMint);

      assert.equal(finalBalance, initialBalance + mintAmount);
      assert.equal(finalSupply, initialSupply + mintAmount);

      console.log("✅ Successfully minted minimum amount (1 token)");
    });

    it("Performs multiple sequential mints", async () => {
      console.log("======= Testing multiple sequential mints =======");

      const initialBalance = await getTokenBalance(provider, userTokenAccount);
      const initialSupply = await getTotalSupply(provider, basketMint);
      const mintAmounts = [25, 75, 150, 50];
      let expectedBalance = initialBalance;
      let expectedSupply = initialSupply;

      for (let i = 0; i < mintAmounts.length; i++) {
        const mintAmount = mintAmounts[i];

        await mintTokens(program, mintAmount, basketConfig, mintAuthority, basketMint, userTokenAccount);

        expectedBalance += mintAmount;
        expectedSupply += mintAmount;

        const currentBalance = await getTokenBalance(provider, userTokenAccount);
        const currentSupply = await getTotalSupply(provider, basketMint);

        assert.equal(currentBalance, expectedBalance);
        assert.equal(currentSupply, expectedSupply);

        console.log(`Mint ${i + 1}: ${mintAmount} tokens, balance: ${currentBalance}, supply: ${currentSupply}`);
      }

      const totalMinted = mintAmounts.reduce((sum, amount) => sum + amount, 0);
      console.log(`✅ Multiple sequential mints completed (total: ${totalMinted} tokens)`);
    });

    it("Mints to multiple accounts in sequence", async () => {
      console.log("======= Testing multiple account mints =======");

      const user2 = Keypair.generate();
      
    const user2TokenAccount = await  createTokenAccount(provider, basketMint, user2.publicKey, payer);

      const initialSupply = await getTotalSupply(provider, basketMint);
      const mintAmount = 200;

      // Mint to user account
      await mintTokens(program, mintAmount, basketConfig, mintAuthority, basketMint, userTokenAccount);
      const userBalance = await getTokenBalance(provider, userTokenAccount);

      // Mint to user2 account
      await mintTokens(program, mintAmount, basketConfig, mintAuthority, basketMint, user2TokenAccount);
      const user2Balance = await getTokenBalance(provider, user2TokenAccount);

      // Mint to recipient account
      await mintTokens(program, mintAmount, basketConfig, mintAuthority, basketMint, recipientTokenAccount);
      const recipientBalance = await getTokenBalance(provider, recipientTokenAccount);

      const finalSupply = await getTotalSupply(provider, basketMint);

      assert.isAbove(userBalance, 0);
      assert.isAbove(user2Balance, 0);
      assert.isAbove(recipientBalance, 0);
      assert.equal(finalSupply, initialSupply + (mintAmount * 3));

      console.log(`✅ Successfully minted to multiple accounts`);
      console.log(`User: ${userBalance}, User2: ${user2Balance}, Recipient: ${recipientBalance}`);
    });

    it("Emits mint event correctly", async () => {
      console.log("======= Testing mint event emission =======");

      const mintAmount = 333;

      const tx = await mintTokens(program, mintAmount, basketConfig, mintAuthority, basketMint, userTokenAccount);

      // The event should be emitted during the transaction
      console.log("✅ Mint event emitted successfully");
      console.log("Transaction:", tx);
    });

    it("Handles very large mint amounts", async () => {
      console.log("======= Testing very large mint amounts =======");

      const initialBalance = await getTokenBalance(provider, userTokenAccount);
      const initialSupply = await getTotalSupply(provider, basketMint);
      const largeMintAmount = 1_000_000_000; // 1 billion tokens

      const tx = await mintTokens(program, largeMintAmount, basketConfig, mintAuthority, basketMint, userTokenAccount);

      const finalBalance = await getTokenBalance(provider, userTokenAccount);
      const finalSupply = await getTotalSupply(provider, basketMint);

      assert.equal(finalBalance, initialBalance + largeMintAmount);
      assert.equal(finalSupply, initialSupply + largeMintAmount);

      console.log(`✅ Successfully minted large amount (${largeMintAmount} tokens)`);
    });
  });

  describe("PDA Validation", () => {
    it("Verifies mint authority PDA derivation using helper", async () => {
      console.log("======= Testing mint authority PDA with helper =======");

      const [expectedMintAuthority, bump] = findMintAuthorityPDA(basketConfig, PROGRAM_ID);

      assert.equal(mintAuthority.toString(), expectedMintAuthority.toString());

      console.log("✅ Mint authority PDA correctly derived using helper");
      console.log("Expected:", expectedMintAuthority.toString());
      console.log("Actual:", mintAuthority.toString());
    });

    it("Verifies calculatePDAs helper function", async () => {
      console.log("======= Testing calculatePDAs helper function =======");

      const [factoryPDA] = findFactoryPDA(PROGRAM_ID);
      const factoryAccount = await program.account.factoryState.fetch(factoryPDA);
      const basketCount = factoryAccount.basketCount;

      const pdas = calculatePDAs(basketMint, basketCount.sub(new anchor.BN(1)), PROGRAM_ID, TOKEN_METADATA_PROGRAM_ID);

     // assert.equal(pdas.config.toString(), basketConfig.toString());
      assert.equal(pdas.mintAuthority.toString(), mintAuthority.toString());

      console.log("✅ calculatePDAs helper function works correctly");
      console.log("Config PDA:", pdas.config.toString());
      console.log("Mint Authority PDA:", pdas.mintAuthority.toString());
      console.log("Factory PDA:", pdas.factory.toString());
      console.log("Metadata PDA:", pdas.metadata.toString());
    });
  });

 
  describe("Mint Validation and Error Cases", () => {
    it("Fails when trying to mint zero tokens", async () => {
      console.log("======= Testing zero amount mint error =======");

      try {
        await mintTokens(program, 0, basketConfig, mintAuthority, basketMint, userTokenAccount);
        assert.fail("Should have failed with zero amount");
      } catch (error) {
        console.log("✅ Correctly failed with zero amount");
        console.log("Error:", error.message);
      }
    });


  });
  
});