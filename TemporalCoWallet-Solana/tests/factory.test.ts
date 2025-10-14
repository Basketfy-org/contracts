import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Basketfy } from "../target/types/basketfy";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("Factory Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Basketfy as Program<Basketfy>;
  let authority: Keypair;
  let factoryPda: PublicKey;
  let factoryBump: number;

  before(async () => {
    // Generate a new keypair for authority
    authority = Keypair.generate();
    
    // Airdrop SOL to authority for testing
    const signature = await provider.connection.requestAirdrop(
      authority.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    // Derive factory PDA
    [factoryPda, factoryBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("factory")],
      program.programId
    );
  });

  describe("Initialize Factory", () => {
    it("Successfully initializes factory with correct authority", async () => {
      const tx = await program.methods
        .initializeFactory()
        .accounts({
          authority: authority.publicKey,
          factory: factoryPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      console.log("Initialize factory transaction signature:", tx);

      // Fetch the factory account
      const factoryAccount = await program.account.basketFactory.fetch(factoryPda);

      // Verify factory state
      expect(factoryAccount.authority.toString()).to.equal(authority.publicKey.toString());
      expect(factoryAccount.totalBaskets.toNumber()).to.equal(0);
      expect(factoryAccount.bump).to.equal(factoryBump);
    });

    it("Fails to initialize factory twice", async () => {
      try {
        await program.methods
          .initializeFactory()
          .accounts({
            authority: authority.publicKey,
            factory: factoryPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("already in use");
      }
    });

    it("Fails to initialize factory with different authority after creation", async () => {
      const newAuthority = Keypair.generate();
      
      // Airdrop SOL to new authority
      const signature = await provider.connection.requestAirdrop(
        newAuthority.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(signature);

      // Try to initialize with different authority should fail because factory already exists
      try {
        await program.methods
          .initializeFactory()
          .accounts({
            authority: newAuthority.publicKey,
            factory: factoryPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([newAuthority])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("already in use");
      }
    });
  });

  describe("Factory State Verification", () => {
    it("Factory PDA is derived correctly", async () => {
      const [expectedPda, expectedBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("factory")],
        program.programId
      );

      expect(factoryPda.toString()).to.equal(expectedPda.toString());
      expect(factoryBump).to.equal(expectedBump);
    });

    it("Factory account has correct discriminator", async () => {
      const accountInfo = await provider.connection.getAccountInfo(factoryPda);
      expect(accountInfo).to.not.be.null;
      expect(accountInfo!.owner.toString()).to.equal(program.programId.toString());
    });

    it("Factory account data matches expected structure", async () => {
      const factoryAccount = await program.account.basketFactory.fetch(factoryPda);
      
      // Check all fields are properly initialized
      expect(factoryAccount.authority).to.be.instanceOf(PublicKey);
      expect(typeof factoryAccount.totalBaskets.toNumber()).to.equal("number");
      expect(typeof factoryAccount.bump).to.equal("number");
      
      // Verify values
      expect(factoryAccount.authority.toString()).to.equal(authority.publicKey.toString());
      expect(factoryAccount.totalBaskets.toNumber()).to.be.at.least(0);
      expect(factoryAccount.bump).to.be.within(0, 255);
    });
  });

  describe("Factory Authority Validation", () => {
    it("Only correct authority can be verified", async () => {
      const factoryAccount = await program.account.basketFactory.fetch(factoryPda);
      expect(factoryAccount.authority.toString()).to.equal(authority.publicKey.toString());
    });

    it("Random keypair is not the authority", async () => {
      const randomKeypair = Keypair.generate();
      const factoryAccount = await program.account.basketFactory.fetch(factoryPda);
      expect(factoryAccount.authority.toString()).to.not.equal(randomKeypair.publicKey.toString());
    });
  });

  describe("Factory Account Size and Rent", () => {
    it("Factory account has correct size", async () => {
      const accountInfo = await provider.connection.getAccountInfo(factoryPda);
      
      // Expected size: 8 (discriminator) + 32 (authority) + 8 (total_baskets) + 1 (bump)
      const expectedSize = 8 + 32 + 8 + 1;
      expect(accountInfo!.data.length).to.equal(expectedSize);
    });

    it("Factory account is rent exempt", async () => {
      const accountInfo = await provider.connection.getAccountInfo(factoryPda);
      const rentExemptMinimum = await provider.connection.getMinimumBalanceForRentExemption(
        accountInfo!.data.length
      );
      
      expect(accountInfo!.lamports).to.be.at.least(rentExemptMinimum);
    });
  });

  describe("Error Cases", () => {
    it("Cannot initialize factory without proper signer", async () => {
      const newAuthority = Keypair.generate();
      const [newFactoryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("factory2")], // Different seed to avoid conflict
        program.programId
      );

      try {
        // Try to initialize without signing with authority
        await program.methods
          .initializeFactory()
          .accounts({
            authority: newAuthority.publicKey,
            factory: newFactoryPda,
            systemProgram: SystemProgram.programId,
          })
          // Note: not including newAuthority in signers
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Signature verification failed");
      }
    });

    it("Cannot use invalid system program", async () => {
      const newAuthority = Keypair.generate();
      const [newFactoryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("factory3")],
        program.programId
      );

      // Airdrop SOL to new authority
      const signature = await provider.connection.requestAirdrop(
        newAuthority.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(signature);

      try {
        await program.methods
          .initializeFactory()
          .accounts({
            authority: newAuthority.publicKey,
            factory: newFactoryPda,
            systemProgram: newAuthority.publicKey, // Invalid system program
          })
          .signers([newAuthority])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Invalid program id");
      }
    });
  });

  describe("Multiple Factory Scenarios", () => {
    it("Cannot create factory with same seeds", async () => {
      const newAuthority = Keypair.generate();
      
      // Airdrop SOL to new authority
      const signature = await provider.connection.requestAirdrop(
        newAuthority.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(signature);

      try {
        // Try to create factory with same PDA (same seeds)
        await program.methods
          .initializeFactory()
          .accounts({
            authority: newAuthority.publicKey,
            factory: factoryPda, // Same PDA as existing factory
            systemProgram: SystemProgram.programId,
          })
          .signers([newAuthority])
          .rpc();
        
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("already in use");
      }
    });
  });

  after(() => {
    console.log("Factory tests completed");
    console.log(`Factory PDA: ${factoryPda.toString()}`);
    console.log(`Authority: ${authority.publicKey.toString()}`);
  });
});