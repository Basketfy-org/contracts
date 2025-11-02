 // SPDX-License-Identifier: MIT
 pragma solidity ^0.8.20;

// import "forge-std/Test.sol";
// import "forge-std/console.sol";
// import "../src/FeedersVaultV2.sol";
// import "../src/interfaces/IERC20.sol";

// import {USDC} from "../src/mock/USDC.sol";

// contract FeederVaultTest is Test {
//     FeedersVaultV2 public vault;
//     USDC public stablecoin;
    
//     address public feeder1 = address(0x1);
//     address public feeder2 = address(0x2);
//     address public owner = address(0x3);
//     string public did1 = "did:example:feeder1";
//     string public did2 = "did:example:feeder2";
    
//     uint256 public constant INITIAL_BALANCE = 1_000_000 * 10**6;
    
//     event FeederRegistered(address indexed feederAddress, string did);
//     event LiquidityDeposited(address indexed feeder, uint256 amount);
//     event LiquidityWithdrawn(address indexed feeder, uint256 amount);
//     event YieldClaimed(address indexed feeder, uint256 yieldAmount);
    
//     function setUp() public {
//         vault = new FeedersVaultV2();
//         stablecoin = new USDC();
        
//         // Distribute stablecoin to feeders and owner
//         stablecoin.transfer(feeder1, INITIAL_BALANCE);
//         stablecoin.transfer(feeder2, INITIAL_BALANCE);
//         stablecoin.transfer(owner, INITIAL_BALANCE);
//     }
    
//     // ============ Registration Tests ============
    
//     function test_RegisterFeeder() public {
//         vm.prank(owner);
//         vm.expectEmit(true, false, false, true);
//         emit FeederRegistered(feeder1, did1);
        
//         vault.registerFeeder(did1, feeder1);
        
//         FeedersVaultV2.Feeder memory f = vault.getFeederInfo(feeder1);
//         assertEq(f.did, did1);
//         assertTrue(f.verified);
//         assertEq(f.depositTimestamp, block.timestamp);
//         assertEq(f.stablecoinBalance, 0);
//         assertEq(f.yieldEarned, 0);
//     }
    
//     function test_RegisterFeederInvalidDID() public {
//         vm.prank(owner);
//         vm.expectRevert("Invalid DID");
//         vault.registerFeeder("", feeder1);
//     }
    
//     function test_RegisterFeederInvalidAddress() public {
//         vm.prank(owner);
//         vm.expectRevert("Invalid address");
//         vault.registerFeeder(did1, address(0));
//     }
    
//     function test_RegisterMultipleFeeders() public {
//         vm.prank(owner);
//         vault.registerFeeder(did1, feeder1);
        
//         vm.prank(owner);
//         vault.registerFeeder(did2, feeder2);
        
//         FeedersVaultV2.Feeder memory f1 = vault.getFeederInfo(feeder1);
//         FeedersVaultV2.Feeder memory f2 = vault.getFeederInfo(feeder2);
        
//         assertEq(f1.did, did1);
//         assertEq(f2.did, did2);
//     }
    
//     // ============ Deposit Tests ============
    
//     function test_DepositLiquidity() public {
//         // Register feeder first
//         vm.prank(owner);
//         vault.registerFeeder(did1, feeder1);
        
//         // Approve and deposit
//         vm.prank(feeder1);
//         stablecoin.approve(address(vault), 100_000 * 10**6);
        
//         vm.prank(feeder1);
//         vm.expectEmit(true, false, false, true);
//         emit LiquidityDeposited(feeder1, 100_000 * 10**6);
        
//         vault.depositLiquidity(feeder1, address(stablecoin), 100_000 * 10**6);
        
//         FeedersVault.Feeder memory f = vault.getFeederInfo(feeder1);
//         assertEq(f.stablecoinBalance, 100_000 * 10**6);
//         assertEq(vault.getTotalFeederLiquidity(), 100_000 * 10**6);
//     }
    
//     function test_DepositLiquidityUnverifiedFeeder() public {
//         vm.prank(feeder1);
//         stablecoin.approve(address(vault), 100_000 * 10**6);
        
//         vm.prank(feeder1);
//         vm.expectRevert("Feeder not verified");
//         vault.depositLiquidity(feeder1, address(stablecoin), 100_000 * 10**6);
//     }
    
//     function test_DepositLiquidityZeroAmount() public {
//         vm.prank(owner);
//         vault.registerFeeder(did1, feeder1);
        
//         vm.prank(feeder1);
//         vm.expectRevert("Amount > 0");
//         vault.depositLiquidity(feeder1, address(stablecoin), 0);
//     }
    
//     function test_MultipleDeposits() public {
//         vm.prank(owner);
//         vault.registerFeeder(did1, feeder1);
        
//         vm.prank(feeder1);
//         stablecoin.approve(address(vault), 300_000 * 10**6);
        
//         vm.prank(feeder1);
//         vault.depositLiquidity(feeder1, address(stablecoin), 100_000 * 10**6);
        
//         vm.prank(feeder1);
//         vault.depositLiquidity(feeder1, address(stablecoin), 200_000 * 10**6);
        
//         FeedersVault.Feeder memory f = vault.getFeederInfo(feeder1);
//         assertEq(f.stablecoinBalance, 300_000 * 10**6);
//         assertEq(vault.getTotalFeederLiquidity(), 300_000 * 10**6);
//     }
    
//     // ============ Withdrawal Tests ============
    
//     function test_WithdrawLiquidity() public {
//         // Setup
//         vm.prank(owner);
//         vault.registerFeeder(did1, feeder1);
        
//         vm.prank(feeder1);
//         stablecoin.approve(address(vault), 100_000 * 10**6);
        
//         vm.prank(feeder1);
//         vault.depositLiquidity(feeder1, address(stablecoin), 100_000 * 10**6);
        
//         // Withdraw
//         vm.prank(feeder1);
//         vm.expectEmit(true, false, false, true);
//         emit LiquidityWithdrawn(feeder1, 50_000 * 10**6);
        
//         vault.withdrawLiquidity(feeder1, address(stablecoin), 50_000 * 10**6);
        
//         FeedersVault.Feeder memory f = vault.getFeederInfo(feeder1);
//         assertEq(f.stablecoinBalance, 50_000 * 10**6);
//         assertEq(vault.getTotalFeederLiquidity(), 50_000 * 10**6);
//     }
    
//     function test_WithdrawLiquidityUnverifiedFeeder() public {
//         vm.prank(feeder1);
//         vm.expectRevert("Feeder not verified");
//         vault.withdrawLiquidity(feeder1, address(stablecoin), 50_000 * 10**6);
//     }
    
//     function test_WithdrawLiquidityInsufficientBalance() public {
//         vm.prank(owner);
//         vault.registerFeeder(did1, feeder1);
        
//         vm.prank(feeder1);
//         stablecoin.approve(address(vault), 100_000 * 10**6);
        
//         vm.prank(feeder1);
//         vault.depositLiquidity(feeder1, address(stablecoin), 100_000 * 10**6);
        
//         vm.prank(feeder1);
//         vm.expectRevert("Insufficient balance");
//         vault.withdrawLiquidity(feeder1, address(stablecoin), 150_000 * 10**6);
//     }
    
//     function test_WithdrawAll() public {
//         vm.prank(owner);
//         vault.registerFeeder(did1, feeder1);
        
//         vm.prank(feeder1);
//         stablecoin.approve(address(vault), 100_000 * 10**6);
        
//         vm.prank(feeder1);
//         vault.depositLiquidity(feeder1, address(stablecoin), 100_000 * 10**6);
        
//         vm.prank(feeder1);
//         vault.withdrawLiquidity(feeder1, address(stablecoin), 100_000 * 10**6);
        
//         FeedersVault.Feeder memory f = vault.getFeederInfo(feeder1);
//         assertEq(f.stablecoinBalance, 0);
//         assertEq(vault.getTotalFeederLiquidity(), 0);
//     }
    
//     // ============ Yield Calculation Tests ============
    
//     function test_CalculateYield() public {
//         vm.prank(owner);
//         vault.registerFeeder(did1, feeder1);
        
//         vm.prank(feeder1);
//         stablecoin.approve(address(vault), 100_000 * 10**6);
        
//         vm.prank(feeder1);
//         vault.depositLiquidity(feeder1, address(stablecoin), 100_000 * 10**6);
        
//         // Skip 1 year
//         vm.warp(block.timestamp + 365 days);
        
//         uint256 yield = vault.calculateYield(feeder1);
        
//         // Expected yield: (100_000 * 500 * 365 days) / (10000 * 365 days) = 5_000
//         // 5% APY on 100_000 = 5_000
//         assertEq(yield, 5_000 * 10**6);
//     }
    
//     function test_CalculateYieldAfter6Months() public {
//         vm.prank(owner);
//         vault.registerFeeder(did1, feeder1);
        
//         vm.prank(feeder1);
//         stablecoin.approve(address(vault), 100_000 * 10**6);
        
//         vm.prank(feeder1);
//         vault.depositLiquidity(feeder1, address(stablecoin), 100_000 * 10**6);
        
//         // Skip 6 months
//         vm.warp(block.timestamp + 182.5 days);
        
//         uint256 yield = vault.calculateYield(feeder1);
        
//         // Approximately 2.5% yield (half of 5%)
//         //assertGreater(yield, 2_400 * 10**6);
//         assertLe(yield, 2_600 * 10**6);
//     }
    
//     function test_CalculateYieldNoTimeElapsed() public {
//         vm.prank(owner);
//         vault.registerFeeder(did1, feeder1);
        
//         vm.prank(feeder1);
//         stablecoin.approve(address(vault), 100_000 * 10**6);
        
//         vm.prank(feeder1);
//         vault.depositLiquidity(feeder1, address(stablecoin), 100_000 * 10**6);
        
//         uint256 yield = vault.calculateYield(feeder1);
//         assertEq(yield, 0);
//     }
    
//     function test_CalculateYieldZeroBalance() public {
//         vm.prank(owner);
//         vault.registerFeeder(did1, feeder1);
        
//         // Skip 1 year without depositing
//         vm.warp(block.timestamp + 365 days);
        
//         uint256 yield = vault.calculateYield(feeder1);
//         assertEq(yield, 0);
//     }
    
//     // ============ Claim Yield Tests ============
    
//     function test_ClaimYield() public {
//         vm.prank(owner);
//         vault.registerFeeder(did1, feeder1);
        
//         vm.prank(feeder1);
//         stablecoin.approve(address(vault), 100_000 * 10**6);
        
//         vm.prank(feeder1);
//         vault.depositLiquidity(feeder1, address(stablecoin), 100_000 * 10**6);
        
//         vm.warp(block.timestamp + 365 days);
        
//         vm.prank(feeder1);
//         vm.expectEmit(true, false, false, true);
//         emit YieldClaimed(feeder1, 5_000 * 10**6);
        
//         vault.claimYield(feeder1);
        
//         FeedersVault.Feeder memory f = vault.getFeederInfo(feeder1);
//         assertEq(f.yieldEarned, 5_000 * 10**6);
//     }
    
//     function test_ClaimYieldUnverifiedFeeder() public {
//         vm.prank(feeder1);
//         vm.expectRevert("Feeder not verified");
//         vault.claimYield(feeder1);
//     }
    
//     function test_ClaimYieldNoYield() public {
//         vm.prank(owner);
//         vault.registerFeeder(did1, feeder1);
        
//         vm.prank(feeder1);
//         vm.expectRevert("No yield to claim");
//         vault.claimYield(feeder1);
//     }
    
//     function test_MultipleYieldClaims() public {
//         vm.prank(owner);
//         vault.registerFeeder(did1, feeder1);
        
//         vm.prank(feeder1);
//         stablecoin.approve(address(vault), 100_000 * 10**6);
        
//         vm.prank(feeder1);
//         vault.depositLiquidity(feeder1, address(stablecoin), 100_000 * 10**6);
        
//         // Claim after 1 year
//         vm.warp(block.timestamp + 365 days);
//         vm.prank(feeder1);
//         vault.claimYield(feeder1);
        
//         FeedersVault.Feeder memory f1 = vault.getFeederInfo(feeder1);
//         assertEq(f1.yieldEarned, 5_000 * 10**6);
        
//         // Claim after another year
//         vm.warp(block.timestamp + 365 days);
//         vm.prank(feeder1);
//         vault.claimYield(feeder1);
        
//         FeedersVault.Feeder memory f2 = vault.getFeederInfo(feeder1);
//         assertEq(f2.yieldEarned, 10_000 * 10**6);
//     }
    
//     // ============ Integration Tests ============
    
//     function test_CompleteFlowMultipleFeeders() public {
//         // Register both feeders
//         vm.prank(owner);
//         vault.registerFeeder(did1, feeder1);
        
//         vm.prank(owner);
//         vault.registerFeeder(did2, feeder2);
        
//         // Feeder1 deposits 100k
//         vm.prank(feeder1);
//         stablecoin.approve(address(vault), 100_000 * 10**6);
        
//         vm.prank(feeder1);
//         vault.depositLiquidity(feeder1, address(stablecoin), 100_000 * 10**6);
        
//         // Feeder2 deposits 200k
//         vm.prank(feeder2);
//         stablecoin.approve(address(vault), 200_000 * 10**6);
        
//         vm.prank(feeder2);
//         vault.depositLiquidity(feeder2, address(stablecoin), 200_000 * 10**6);
        
//         assertEq(vault.getTotalFeederLiquidity(), 300_000 * 10**6);
        
//         // Advance time and check yields
//         vm.warp(block.timestamp + 365 days);
        
//         uint256 yield1 = vault.calculateYield(feeder1);
//         uint256 yield2 = vault.calculateYield(feeder2);
        
//         assertEq(yield1, 5_000 * 10**6);
//         assertEq(yield2, 10_000 * 10**6);
        
//         // Claim yields
//         vm.prank(feeder1);
//         vault.claimYield(feeder1);
        
//         vm.prank(feeder2);
//         vault.claimYield(feeder2);
        
//         // Partial withdrawal
//         vm.prank(feeder1);
//         vault.withdrawLiquidity(feeder1, address(stablecoin), 50_000 * 10**6);
        
//         assertEq(vault.getTotalFeederLiquidity(), 250_000 * 10**6);
//     }
    
//     function test_DepositWithdrawDepositFlow() public {
//         vm.prank(owner);
//         vault.registerFeeder(did1, feeder1);
        
//         // First deposit
//         vm.prank(feeder1);
//         stablecoin.approve(address(vault), 300_000 * 10**6);
        
//         vm.prank(feeder1);
//         vault.depositLiquidity(feeder1, address(stablecoin), 100_000 * 10**6);
        
//         assertEq(vault.getTotalFeederLiquidity(), 100_000 * 10**6);
        
//         // Withdraw
//         vm.prank(feeder1);
//         vault.withdrawLiquidity(feeder1, address(stablecoin), 50_000 * 10**6);
        
//         assertEq(vault.getTotalFeederLiquidity(), 50_000 * 10**6);
        
//         // Deposit again
//         vm.prank(feeder1);
//         vault.depositLiquidity(feeder1, address(stablecoin), 150_000 * 10**6);
        
//         assertEq(vault.getTotalFeederLiquidity(), 200_000 * 10**6);
//     }
// }