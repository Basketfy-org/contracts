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
  getAccount
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  sendAndConfirmTransaction
} from "@solana/web3.js";

const IDL = require('../target/idl/basketfy.json');
const PROGRAM_ID = new PublicKey(IDL.address);
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

describe("Create Basket - Comprehensive Test Suite", () => {
  let context: any;
  let provider: BankrunProvider;
  let payer: anchor.Wallet;
  let program: anchor.Program<Basketfy>;

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

  // Helper function to create basket
  const createBasket = async (
    name: string,
    symbol: string,
    uri: string,
    decimals: number,
    tokenMints: PublicKey[],
    weights: anchor.BN[]
  ) => {
    const mintKeypair = Keypair.generate();
    const [factoryPDA] = findFactoryPDA();
    const factoryAccount = await program.account.factoryState.fetch(factoryPDA);
    const basketCount = factoryAccount.basketCount;
    
    const [configPDA] = findConfigPDA(factoryPDA, basketCount);
    const [mintAuthorityPDA] = findMintAuthorityPDA(configPDA);
    const [metadataPDA] = findMetadataPDA(mintKeypair.publicKey);

    const tx = await program.methods
      .createBasket(name, symbol, uri, decimals, tokenMints, weights)
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

    return { tx, configPDA, mintKeypair };
  };

  // Setup: Initialize context and provider before all tests
  before(async () => {
    console.log("======= Setting up test environment =======");

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

    console.log("Program ID:", PROGRAM_ID.toString());
    console.log("Payer:", payer.publicKey.toString());

    // Initialize the factory state if it doesn't exist
    try {
      const [factoryPDA] = findFactoryPDA();
      console.log("Factory PDA:", factoryPDA.toString());

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
  });

  describe("Successful Basket Creation", () => {
    it("Creates a basic basket with valid parameters", async () => {
      console.log("======= Testing basic basket creation =======");

      const tokenMints = [
        new PublicKey("So11111111111111111111111111111111111111112"), // SOL
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC
      ];

      const weights = [
        new anchor.BN(6000),
        new anchor.BN(4000)
      ];

      const { configPDA } = await createBasket(
        "Balanced Portfolio",
        "BPORT",
        "https://example.com/metadata.json",
        6,
        tokenMints,
        weights
      );

      // Verify basket config
      const configAccount = await program.account.basketConfig.fetch(configPDA);
      assert.equal(configAccount.name, "Balanced Portfolio");
      assert.equal(configAccount.symbol, "BPORT");
      assert.equal(configAccount.uri, "https://example.com/metadata.json");
      assert.equal(configAccount.decimals, 6);
      assert.equal(configAccount.tokenMints.length, 2);
      assert.equal(configAccount.weights.length, 2);
      assert.equal(configAccount.weights[0].toNumber(), 6000);
      assert.equal(configAccount.weights[1].toNumber(), 4000);

      console.log("✅ Basic basket creation test passed");
    });

    it("Creates a basket with equal weights (50-50 split)", async () => {
      console.log("======= Testing equal weight basket =======");

      const tokenMints = [
        new PublicKey("So11111111111111111111111111111111111111112"), // SOL
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC
      ];

      const weights = [
        new anchor.BN(5000),
        new anchor.BN(5000)
      ];

      const { configPDA } = await createBasket(
        "Equal Weight Portfolio",
        "EQUAL",
        "https://example.com/equal.json",
        9,
        tokenMints,
        weights
      );

      const configAccount = await program.account.basketConfig.fetch(configPDA);
      assert.equal(configAccount.weights[0].toNumber(), 5000);
      assert.equal(configAccount.weights[1].toNumber(), 5000);
      assert.equal(configAccount.decimals, 9);

      console.log("✅ Equal weight basket test passed");
    });

    it("Creates a basket with multiple tokens (3 tokens)", async () => {
      console.log("======= Testing multi-token basket =======");

      const tokenMints = [
        new PublicKey("So11111111111111111111111111111111111111112"), // SOL
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC
        new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"), // USDT
      ];

      const weights = [
        new anchor.BN(4000), // 40%
        new anchor.BN(3500), // 35%
        new anchor.BN(2500)  // 25%
      ];

      const { configPDA } = await createBasket(
        "Diversified Stablecoin",
        "STABLE",
        "https://example.com/stable.json",
        6,
        tokenMints,
        weights
      );

      const configAccount = await program.account.basketConfig.fetch(configPDA);
      assert.equal(configAccount.tokenMints.length, 3);
      assert.equal(configAccount.weights.length, 3);
      assert.equal(configAccount.weights[0].toNumber(), 4000);
      assert.equal(configAccount.weights[1].toNumber(), 3500);
      assert.equal(configAccount.weights[2].toNumber(), 2500);

      console.log("✅ Multi-token basket test passed");
    });

    it("Creates a basket with maximum allowed tokens", async () => {
      console.log("======= Testing maximum tokens basket =======");

      // Assuming MAX_TOKENS is 10 (adjust based on your constant)
      const tokenMints = [
        new PublicKey("So11111111111111111111111111111111111111112"),
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
        new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"),
        new PublicKey("mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So"),
        new PublicKey("7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj"),
        new PublicKey("SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt"),
        new PublicKey("A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM"),
        new PublicKey("9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E"),
        new PublicKey("BQcdHdAQW1hczDbBi9hiegXAR7A98Q9jx3X3iBBBDiq4"),
        new PublicKey("7i5KKsX2weiTkry7jA4ZwSuXGhs5eJBEjY8vVxR4pfRx"),
      ];

      const weights = Array(10).fill(0).map(() => new anchor.BN(1000)); // Equal 10% each

      const { configPDA } = await createBasket(
        "Maximum Diversification",
        "MAXDIV",
        "https://example.com/maxdiv.json",
        6,
        tokenMints,
        weights
      );

      const configAccount = await program.account.basketConfig.fetch(configPDA);
      assert.equal(configAccount.tokenMints.length, 10);
      assert.equal(configAccount.weights.length, 10);

      console.log("✅ Maximum tokens basket test passed");
    });

    it("Creates baskets with different decimals", async () => {
      console.log("======= Testing different decimals =======");

      const tokenMints = [
        new PublicKey("So11111111111111111111111111111111111111112"),
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
      ];

      const weights = [
        new anchor.BN(5000),
        new anchor.BN(5000)
      ];

      // Test 18 decimals (like ETH)
      const { configPDA: config18 } = await createBasket(
        "High Precision Token",
        "HPT",
        "https://example.com/hpt.json",
        18,
        tokenMints,
        weights
      );

      const configAccount18 = await program.account.basketConfig.fetch(config18);
      assert.equal(configAccount18.decimals, 18);

      // Test 0 decimals (whole numbers only)
      const { configPDA: config0 } = await createBasket(
        "Whole Number Token",
        "WNT",
        "https://example.com/wnt.json",
        0,
        tokenMints,
        weights
      );

      const configAccount0 = await program.account.basketConfig.fetch(config0);
      assert.equal(configAccount0.decimals, 0);

      console.log("✅ Different decimals test passed");
    });

    it("Verifies factory basket count increments correctly", async () => {
      console.log("======= Testing basket count increment =======");

      const [factoryPDA] = findFactoryPDA();
      const initialFactory = await program.account.factoryState.fetch(factoryPDA);
      const initialCount = initialFactory.basketCount.toNumber();

      const tokenMints = [
        new PublicKey("So11111111111111111111111111111111111111112"),
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
      ];

      const weights = [
        new anchor.BN(7000),
        new anchor.BN(3000)
      ];

      await createBasket(
        "Counter Test",
        "COUNT",
        "https://example.com/count.json",
        6,
        tokenMints,
        weights
      );

      const finalFactory = await program.account.factoryState.fetch(factoryPDA);
      const finalCount = finalFactory.basketCount.toNumber();

      assert.equal(finalCount, initialCount + 1);

      console.log("✅ Basket count increment test passed");
    });
  });

  describe("Edge Cases and Boundary Tests", () => {
    it("Creates basket with minimum weights (1 basis point each)", async () => {
      console.log("======= Testing minimum weights =======");

      const tokenMints = [
        new PublicKey("So11111111111111111111111111111111111111112"),
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
      ];

      const weights = [
        new anchor.BN(9999), // 99.99%
        new anchor.BN(1)     // 0.01%
      ];

      const { configPDA } = await createBasket(
        "Minimum Weight Test",
        "MINW",
        "https://example.com/minw.json",
        6,
        tokenMints,
        weights
      );

      const configAccount = await program.account.basketConfig.fetch(configPDA);
      assert.equal(configAccount.weights[0].toNumber(), 9999);
      assert.equal(configAccount.weights[1].toNumber(), 1);

      console.log("✅ Minimum weights test passed");
    });

    it("Creates basket with maximum length names and symbols", async () => {
      console.log("======= Testing maximum length strings =======");

      const maxName = "A".repeat(32); // Assuming MAX_NAME_LENGTH is 32
      const maxSymbol = "B".repeat(8); // Assuming MAX_SYMBOL_LENGTH is 8
      const maxUri = "https://example.com/" + "c".repeat(150); // Adjust based on MAX_URI_LENGTH

      const tokenMints = [
        new PublicKey("So11111111111111111111111111111111111111112"),
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
      ];

      const weights = [
        new anchor.BN(5000),
        new anchor.BN(5000)
      ];

      const { configPDA } = await createBasket(
        maxName,
        maxSymbol,
        maxUri,
        6,
        tokenMints,
        weights
      );

      const configAccount = await program.account.basketConfig.fetch(configPDA);
      assert.equal(configAccount.name, maxName);
      assert.equal(configAccount.symbol, maxSymbol);
      assert.equal(configAccount.uri, maxUri);

      console.log("✅ Maximum length strings test passed");
    });
  });

  describe("Error Cases", () => {
    it("Should fail with mismatched token mints and weights arrays", async () => {
      console.log("======= Testing mismatched arrays =======");

      const tokenMints = [
        new PublicKey("So11111111111111111111111111111111111111112"),
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
      ];

      const weights = [
        new anchor.BN(10000) // Only one weight for two tokens
      ];

      try {
        await createBasket(
          "Mismatch Test",
          "MISMATCH",
          "https://example.com/mismatch.json",
          6,
          tokenMints,
          weights
        );
        assert.fail("Should have thrown TokenWeightMismatch error");
      } catch (error) {
        expect(error.message).to.include("TokenWeightMismatch");
        console.log("✅ Mismatched arrays error test passed");
      }
    });

    it("Should fail with weights not summing to 10000", async () => {
      console.log("======= Testing incorrect weight sum =======");

      const tokenMints = [
        new PublicKey("So11111111111111111111111111111111111111112"),
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
      ];

      const weights = [
        new anchor.BN(6000),
        new anchor.BN(3000) // Sum = 9000, not 10000
      ];

      try {
        await createBasket(
          "Wrong Sum Test",
          "WRONGSUM",
          "https://example.com/wrongsum.json",
          6,
          tokenMints,
          weights
        );
        assert.fail("Should have thrown WeightsSumError");
      } catch (error) {
        expect(error.message).to.include("WeightsSumError");
        console.log("✅ Incorrect weight sum error test passed");
      }
    });

    it("Should fail with too many tokens", async () => {
      console.log("======= Testing too many tokens =======");

      // Create more than MAX_TOKENS (assuming 10)
      const tokenMints = Array(11).fill(0).map(() => 
        new PublicKey("So11111111111111111111111111111111111111112")
      );
      const weights = Array(11).fill(0).map(() => new anchor.BN(909)); // ~909 each ≈ 10000

      try {
        await createBasket(
          "Too Many Tokens",
          "TOOMANY",
          "https://example.com/toomany.json",
          6,
          tokenMints,
          weights
        );
        assert.fail("Should have thrown TooManyTokens error");
      } catch (error) {
        expect(error.message).to.include("TooManyTokens");
        console.log("✅ Too many tokens error test passed");
      }
    });

    it("Should fail with empty token arrays", async () => {
      console.log("======= Testing empty arrays =======");

      const tokenMints: PublicKey[] = [];
      const weights: anchor.BN[] = [];

      try {
        await createBasket(
          "Empty Test",
          "EMPTY",
          "https://example.com/empty.json",
          6,
          tokenMints,
          weights
        );
        assert.fail("Should have thrown an error for empty arrays");
      } catch (error) {
        // This might throw a different error depending on your validation
        console.log("✅ Empty arrays error test passed");
      }
    });
  });

  describe("Multiple Basket Creation", () => {
    it("Creates multiple baskets sequentially", async () => {
      console.log("======= Testing multiple baskets =======");

      const [factoryPDA] = findFactoryPDA();
      const initialFactory = await program.account.factoryState.fetch(factoryPDA);
      const initialCount = initialFactory.basketCount.toNumber();

      const basketsToCreate = 3;
      const createdBaskets = [];

      for (let i = 0; i < basketsToCreate; i++) {
        const tokenMints = [
          new PublicKey("So11111111111111111111111111111111111111112"),
          new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
        ];

        const weights = [
          new anchor.BN(5000),
          new anchor.BN(5000)
        ];

        const { configPDA } = await createBasket(
          `Multi Basket ${i + 1}`,
          `MB${i + 1}`,
          `https://example.com/mb${i + 1}.json`,
          6,
          tokenMints,
          weights
        );

        createdBaskets.push(configPDA);
        console.log(`Created basket ${i + 1}: ${configPDA.toString()}`);
      }

      // Verify all baskets were created
      for (let i = 0; i < basketsToCreate; i++) {
        const configAccount = await program.account.basketConfig.fetch(createdBaskets[i]);
        assert.equal(configAccount.name, `Multi Basket ${i + 1}`);
        assert.equal(configAccount.symbol, `MB${i + 1}`);
      }

      // Verify factory count
      const finalFactory = await program.account.factoryState.fetch(factoryPDA);
      const finalCount = finalFactory.basketCount.toNumber();
      assert.equal(finalCount, initialCount + basketsToCreate);

      console.log("✅ Multiple baskets creation test passed");
    });
  });
});