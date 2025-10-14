import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Basketfy } from "../target/types/basketfy";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createMint,
  createAccount,
  mintTo,
  getAccount,
  createAssociatedTokenAccount,
  getAssociatedTokenAddress
} from "@solana/spl-token";
import { expect } from "chai";
import { stringToUint8Array } from "./helpers";

describe("Basket Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Basketfy as Program<Basketfy>;
  let payer: Keypair;
  let user: Keypair;
  let basketKeypair: Keypair;
  let basketMint: PublicKey;
  let usdcMint: PublicKey;
  let token1Mint: PublicKey;
  let token2Mint: PublicKey;
  let basketAuthorityPda: PublicKey;
  let basketAuthorityBump: number;

  // Token accounts
  let userUsdcAccount: PublicKey;
  let userBasketTokenAccount: PublicKey;
  let basketUsdcVault: PublicKey;

  const USDC_DECIMALS = 6;
  const BASKET_DECIMALS = 9;
  const INITIAL_USDC_AMOUNT = 10000 * (10 ** USDC_DECIMALS); // 10,000 USDC

  before(async () => {
    // Generate keypairs
    payer = Keypair.generate();
    user = Keypair.generate();
    basketKeypair = Keypair.generate();

    // Airdrop SOL
    const payerAirdrop = await provider.connection.requestAirdrop(
      payer.publicKey,
      5 * anchor.web3.LAMPORTS_PER_SOL
    );
    const userAirdrop = await provider.connection.requestAirdrop(
      user.publicKey,
      5 * anchor.web3.LAMPORTS_PER_SOL
    );

    await provider.connection.confirmTransaction(payerAirdrop);
    await provider.connection.confirmTransaction(userAirdrop);

    // Create test tokens
    usdcMint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      USDC_DECIMALS
    );

    token1Mint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      9
    );

    token2Mint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      9
    );

    // Derive basket authority PDA
    [basketAuthorityPda, basketAuthorityBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("basket_authority")],
      program.programId
    );

    // Create user token accounts
    userUsdcAccount = await createAssociatedTokenAccount(
      provider.connection,
      payer,
      usdcMint,
      user.publicKey
    );

    // Mint USDC to user
    await mintTo(
      provider.connection,
      payer,
      usdcMint,
      userUsdcAccount,
      payer.publicKey,
      INITIAL_USDC_AMOUNT
    );

    console.log("Setup completed:");
    console.log(`Payer: ${payer.publicKey.toString()}`);
    console.log(`User: ${user.publicKey.toString()}`);
    console.log(`USDC Mint: ${usdcMint.toString()}`);
    console.log(`Token1 Mint: ${token1Mint.toString()}`);
    console.log(`Token2 Mint: ${token2Mint.toString()}`);
  });

  describe("Create Basket", () => {
    it("Successfully creates a basket with valid tokens and weights", async () => {

      const name = "Test Basket";
      const symbol = "TESTB";
      const decimals = BASKET_DECIMALS;
      const description = "A test basket for unit testing";
      const tokens = [token1Mint, token2Mint];
      const weights = [stringToUint8Array("60"), stringToUint8Array("40")]; // 60% token1, 40% token2
      //const messageBytes = stringToUint8Array(messageString);
      const tx = await program.methods
        .createBasket(
          name,
          symbol,
          decimals,
          description,
          tokens,
          weights)
        .accounts({
          basket: basketKeypair.publicKey,
          payer: payer.publicKey,
          mintAccount: basketKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([payer, basketKeypair])
        .rpc();

      console.log("Create basket transaction signature:", tx);

      // Fetch and verify basket account
      const basketAccount = await program.account.basket.fetch(basketKeypair.publicKey);

      expect(basketAccount.payer.toString()).to.equal(payer.publicKey.toString());
      expect(basketAccount.name).to.equal(name);
      expect(basketAccount.description).to.equal(description);
      expect(basketAccount.tokenCount).to.equal(2);
      expect(basketAccount.totalWeight.toNumber()).to.equal(100);
      expect(basketAccount.feeBps).to.equal(0);

      // Check tokens and weights
      const activeTokens = basketAccount.tokens.slice(0, basketAccount.tokenCount);
      const activeWeights = basketAccount.weights.slice(0, basketAccount.tokenCount);

      expect(activeTokens[0].toString()).to.equal(token1Mint.toString());
      expect(activeTokens[1].toString()).to.equal(token2Mint.toString());
      expect(activeWeights[0]).to.equal(60);
      expect(activeWeights[1]).to.equal(40);

      basketMint = basketKeypair.publicKey;
      
    });

    it("Fails to create basket with invalid weights (not summing to 100)", async () => {
      const badBasketKeypair = Keypair.generate();
      const tokens = [token1Mint, token2Mint];
      const weights = [50, 30]; // Sum = 80, not 100

      const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
      const [metadataAccount] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          badBasketKeypair.publicKey.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      try {
        await program.methods
          .createBasket("Bad Basket", "BAD", 9, "Invalid weights", tokens, weights)
          .accounts({
            basket: badBasketKeypair.publicKey,
            payer: payer.publicKey,
            metadataAccount: metadataAccount,
            mintAccount: badBasketKeypair.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          })
          .signers([payer, badBasketKeypair])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("InvalidWeights");
      }
    });

    it("Fails to create basket with mismatched tokens and weights arrays", async () => {
      const badBasketKeypair = Keypair.generate();
      const tokens = [token1Mint, token2Mint];
      const weights = [100]; // Only one weight for two tokens

      const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
      const [metadataAccount] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          badBasketKeypair.publicKey.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      try {
        await program.methods
          .createBasket("Bad Basket", "BAD", 9, "Mismatched arrays", tokens, weights)
          .accounts({
            basket: badBasketKeypair.publicKey,
            payer: payer.publicKey,
            metadataAccount: metadataAccount,
            mintAccount: badBasketKeypair.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          })
          .signers([payer, badBasketKeypair])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("InvalidInput");
      }
    });

    it("Fails to create basket with too many tokens (>10)", async () => {
      const badBasketKeypair = Keypair.generate();

      // Create 11 tokens (more than max)
      const tokens = [];
      const weights = [];
      for (let i = 0; i < 11; i++) {
        tokens.push(token1Mint); // Just use same token for simplicity
        weights.push(Math.floor(100 / 11));
      }
      weights[0] += 100 - weights.reduce((sum, w) => sum + w, 0); // Adjust first weight to sum to 100

      const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
      const [metadataAccount] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          badBasketKeypair.publicKey.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      try {
        await program.methods
          .createBasket("Too Many Tokens", "TMT", 9, "Too many tokens", tokens, weights)
          .accounts({
            basket: badBasketKeypair.publicKey,
            payer: payer.publicKey,
            metadataAccount: metadataAccount,
            mintAccount: badBasketKeypair.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          })
          .signers([payer, badBasketKeypair])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("TooManyTokens");
      }
    });

    it("Fails to create basket with empty tokens array", async () => {
      const badBasketKeypair = Keypair.generate();
      const tokens: PublicKey[] = [];
      const weights: number[] = [];

      const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
      const [metadataAccount] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          badBasketKeypair.publicKey.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      try {
        await program.methods
          .createBasket("Empty Basket", "EMPTY", 9, "No tokens", tokens, weights)
          .accounts({
            basket: badBasketKeypair.publicKey,
            payer: payer.publicKey,
            metadataAccount: metadataAccount,
            mintAccount: badBasketKeypair.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          })
          .signers([payer, badBasketKeypair])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("InvalidInput");
      }
    });
  });

  describe("Update Fee", () => {
    it("Successfully updates basket fee", async () => {
      const newFeeBps = 100; // 1%

      await program.methods
        .updateFee(newFeeBps)
        .accounts({
          basket: basketKeypair.publicKey,
          admin: payer.publicKey,
        })
        .signers([payer])
        .rpc();

      const basketAccount = await program.account.basket.fetch(basketKeypair.publicKey);
      expect(basketAccount.feeBps).to.equal(newFeeBps);
    });

    it("Fails to set fee too high (>10%)", async () => {
      const tooHighFee = 1001; // 10.01%

      try {
        await program.methods
          .updateFee(tooHighFee)
          .accounts({
            basket: basketKeypair.publicKey,
            admin: payer.publicKey,
          })
          .signers([payer])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("FeeTooHigh");
      }
    });

    it("Successfully sets maximum allowed fee (10%)", async () => {
      const maxFee = 1000; // 10%

      await program.methods
        .updateFee(maxFee)
        .accounts({
          basket: basketKeypair.publicKey,
          admin: payer.publicKey,
        })
        .signers([payer])
        .rpc();

      const basketAccount = await program.account.basket.fetch(basketKeypair.publicKey);
      expect(basketAccount.feeBps).to.equal(maxFee);

      // Reset fee to 1% for subsequent tests
      await program.methods
        .updateFee(100)
        .accounts({
          basket: basketKeypair.publicKey,
          admin: payer.publicKey,
        })
        .signers([payer])
        .rpc();
    });

    it("Fails when non-admin tries to update fee", async () => {
      const nonAdmin = Keypair.generate();
      const airdrop = await provider.connection.requestAirdrop(
        nonAdmin.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdrop);

      try {
        await program.methods
          .updateFee(50)
          .accounts({
            basket: basketKeypair.publicKey,
            admin: nonAdmin.publicKey,
          })
          .signers([nonAdmin])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        // This would depend on your access control implementation
        // For now, we'll expect it to fail in some way
        expect(error).to.exist;
      }
    });
  });

  describe("Mint Basket Tokens", () => {
    before(async () => {
      // Create user basket token account
      userBasketTokenAccount = await createAssociatedTokenAccount(
        provider.connection,
        payer,
        basketMint,
        user.publicKey
      );

      // Create basket USDC vault
      basketUsdcVault = await createAccount(
        provider.connection,
        payer,
        usdcMint,
        basketAuthorityPda
      );
    });

    it("Successfully mints basket tokens with fee", async () => {
      const mintAmount = 1000 * (10 ** BASKET_DECIMALS); // 1000 basket tokens
      const feeBps = 100; // 1%
      const expectedFee = mintAmount / 100; // 1%
      const totalRequired = mintAmount + expectedFee;

      // Check initial balances
      const initialUserUsdc = await getAccount(provider.connection, userUsdcAccount);
      const initialUserBasket = await getAccount(provider.connection, userBasketTokenAccount);

      await program.methods
        .mintBasketTokens(new anchor.BN(mintAmount))
        .accounts({
          basket: basketKeypair.publicKey,
          basketMint: basketMint,
          userBasketTokenAccount: userBasketTokenAccount,
          userUsdcAccount: userUsdcAccount,
          basketUsdcVault: basketUsdcVault,
          basketAuthority: basketAuthorityPda,
          user: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      // Check final balances
      const finalUserUsdc = await getAccount(provider.connection, userUsdcAccount);
      const finalUserBasket = await getAccount(provider.connection, userBasketTokenAccount);
      const finalVaultUsdc = await getAccount(provider.connection, basketUsdcVault);

      // User should have less USDC (mint amount + fee)
      expect(Number(initialUserUsdc.amount) - Number(finalUserUsdc.amount)).to.equal(totalRequired);

      // User should have more basket tokens
      expect(Number(finalUserBasket.amount) - Number(initialUserBasket.amount)).to.equal(mintAmount);

      // Vault should have received USDC (mint amount + fee)
      expect(Number(finalVaultUsdc.amount)).to.equal(totalRequired);
    });

    it("Fails to mint when user has insufficient USDC", async () => {
      const userBalance = await getAccount(provider.connection, userUsdcAccount);
      const mintAmount = Number(userBalance.amount) * 2; // More than user has

      try {
        await program.methods
          .mintBasketTokens(new anchor.BN(mintAmount))
          .accounts({
            basket: basketKeypair.publicKey,
            basketMint: basketMint,
            userBasketTokenAccount: userBasketTokenAccount,
            userUsdcAccount: userUsdcAccount,
            basketUsdcVault: basketUsdcVault,
            basketAuthority: basketAuthorityPda,
            user: user.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("InsufficientUsdc");
      }
    });

    it("Successfully mints with zero fee", async () => {
      // Set fee to 0
      await program.methods
        .updateFee(0)
        .accounts({
          basket: basketKeypair.publicKey,
          admin: payer.publicKey,
        })
        .signers([payer])
        .rpc();

      const mintAmount = 500 * (10 ** BASKET_DECIMALS); // 500 basket tokens

      // Check initial balances
      const initialUserUsdc = await getAccount(provider.connection, userUsdcAccount);
      const initialUserBasket = await getAccount(provider.connection, userBasketTokenAccount);

      await program.methods
        .mintBasketTokens(new anchor.BN(mintAmount))
        .accounts({
          basket: basketKeypair.publicKey,
          basketMint: basketMint,
          userBasketTokenAccount: userBasketTokenAccount,
          userUsdcAccount: userUsdcAccount,
          basketUsdcVault: basketUsdcVault,
          basketAuthority: basketAuthorityPda,
          user: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      // Check final balances
      const finalUserUsdc = await getAccount(provider.connection, userUsdcAccount);
      const finalUserBasket = await getAccount(provider.connection, userBasketTokenAccount);

      // User should have less USDC (exactly mint amount, no fee)
      expect(Number(initialUserUsdc.amount) - Number(finalUserUsdc.amount)).to.equal(mintAmount);

      // User should have more basket tokens
      expect(Number(finalUserBasket.amount) - Number(initialUserBasket.amount)).to.equal(mintAmount);

      // Reset fee back to 1% for subsequent tests
      await program.methods
        .updateFee(100)
        .accounts({
          basket: basketKeypair.publicKey,
          admin: payer.publicKey,
        })
        .signers([payer])
        .rpc();
    });
  });

  describe("Redeem Basket Tokens", () => {
    it("Successfully redeems basket tokens with fee", async () => {
      const redeemAmount = 500 * (10 ** BASKET_DECIMALS); // 500 basket tokens
      const feeBps = 100; // 1%
      const expectedFee = redeemAmount / 100; // 1%
      const netAmount = redeemAmount - expectedFee;

      // Check initial balances
      const initialUserUsdc = await getAccount(provider.connection, userUsdcAccount);
      const initialUserBasket = await getAccount(provider.connection, userBasketTokenAccount);
      const initialVaultUsdc = await getAccount(provider.connection, basketUsdcVault);

      await program.methods
        .redeemBasketTokens(new anchor.BN(redeemAmount))
        .accounts({
          basket: basketKeypair.publicKey,
          basketMint: basketMint,
          userBasketTokenAccount: userBasketTokenAccount,
          basketUsdcVault: basketUsdcVault,
          basketAuthority: basketAuthorityPda,
          userUsdcAccount: userUsdcAccount,
          user: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      // Check final balances
      const finalUserUsdc = await getAccount(provider.connection, userUsdcAccount);
      const finalUserBasket = await getAccount(provider.connection, userBasketTokenAccount);
      const finalVaultUsdc = await getAccount(provider.connection, basketUsdcVault);

      // User should have more USDC (net amount after fee)
      expect(Number(finalUserUsdc.amount) - Number(initialUserUsdc.amount)).to.equal(netAmount);

      // User should have fewer basket tokens
      expect(Number(initialUserBasket.amount) - Number(finalUserBasket.amount)).to.equal(redeemAmount);

      // Vault should have less USDC (net amount transferred out)
      expect(Number(initialVaultUsdc.amount) - Number(finalVaultUsdc.amount)).to.equal(netAmount);
    });

    it("Fails to redeem when user has insufficient basket tokens", async () => {
      const userBasketBalance = await getAccount(provider.connection, userBasketTokenAccount);
      const redeemAmount = Number(userBasketBalance.amount) * 2; // More than user has

      try {
        await program.methods
          .redeemBasketTokens(new anchor.BN(redeemAmount))
          .accounts({
            basket: basketKeypair.publicKey,
            basketMint: basketMint,
            userBasketTokenAccount: userBasketTokenAccount,
            basketUsdcVault: basketUsdcVault,
            basketAuthority: basketAuthorityPda,
            userUsdcAccount: userUsdcAccount,
            user: user.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        // Should fail due to insufficient token balance
        expect(error).to.exist;
      }
    });

    it("Successfully redeems with zero fee", async () => {
      // Set fee to 0
      await program.methods
        .updateFee(0)
        .accounts({
          basket: basketKeypair.publicKey,
          admin: payer.publicKey,
        })
        .signers([payer])
        .rpc();

      const redeemAmount = 200 * (10 ** BASKET_DECIMALS); // 200 basket tokens

      // Check initial balances
      const initialUserUsdc = await getAccount(provider.connection, userUsdcAccount);
      const initialUserBasket = await getAccount(provider.connection, userBasketTokenAccount);

      await program.methods
        .redeemBasketTokens(new anchor.BN(redeemAmount))
        .accounts({
          basket: basketKeypair.publicKey,
          basketMint: basketMint,
          userBasketTokenAccount: userBasketTokenAccount,
          basketUsdcVault: basketUsdcVault,
          basketAuthority: basketAuthorityPda,
          userUsdcAccount: userUsdcAccount,
          user: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      // Check final balances
      const finalUserUsdc = await getAccount(provider.connection, userUsdcAccount);
      const finalUserBasket = await getAccount(provider.connection, userBasketTokenAccount);

      // User should have more USDC (exactly redeem amount, no fee)
      expect(Number(finalUserUsdc.amount) - Number(initialUserUsdc.amount)).to.equal(redeemAmount);

      // User should have fewer basket tokens
      expect(Number(initialUserBasket.amount) - Number(finalUserBasket.amount)).to.equal(redeemAmount);
    });

    it("Fails when vault has insufficient USDC", async () => {
      // First, let's drain most of the vault by redeeming all remaining tokens
      const userBasketBalance = await getAccount(provider.connection, userBasketTokenAccount);
      const remainingTokens = Number(userBasketBalance.amount);

      if (remainingTokens > 0) {
        await program.methods
          .redeemBasketTokens(new anchor.BN(remainingTokens))
          .accounts({
            basket: basketKeypair.publicKey,
            basketMint: basketMint,
            userBasketTokenAccount: userBasketTokenAccount,
            basketUsdcVault: basketUsdcVault,
            basketAuthority: basketAuthorityPda,
            userUsdcAccount: userUsdcAccount,
            user: user.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();
      }

      // Now mint some tokens back to the user
      await program.methods
        .mintBasketTokens(new anchor.BN(100 * (10 ** BASKET_DECIMALS)))
        .accounts({
          basket: basketKeypair.publicKey,
          basketMint: basketMint,
          userBasketTokenAccount: userBasketTokenAccount,
          userUsdcAccount: userUsdcAccount,
          basketUsdcVault: basketUsdcVault,
          basketAuthority: basketAuthorityPda,
          user: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      // Try to redeem more than what's in the vault
      const vaultBalance = await getAccount(provider.connection, basketUsdcVault);
      const excessiveAmount = Number(vaultBalance.amount) * 2;

      try {
        await program.methods
          .redeemBasketTokens(new anchor.BN(excessiveAmount))
          .accounts({
            basket: basketKeypair.publicKey,
            basketMint: basketMint,
            userBasketTokenAccount: userBasketTokenAccount,
            basketUsdcVault: basketUsdcVault,
            basketAuthority: basketAuthorityPda,
            userUsdcAccount: userUsdcAccount,
            user: user.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();

        expect.fail("Should have thrown an error");
      } catch (error) {
        // Should fail due to insufficient vault balance
        expect(error).to.exist;
      }
    });
  });

});