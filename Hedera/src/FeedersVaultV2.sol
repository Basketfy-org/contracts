 // SPDX-License-Identifier: MIT
 pragma solidity ^0.8.20;

// // ============ FeederVault.sol ============
// // Manages liquidity provider deposits and yield

// import "./interfaces/IERC20.sol";

// contract FeedersVaultV2 {

    
//     struct Feeder {
//         string did; // Decentralized Identity
//         uint256 stablecoinBalance;
//         uint256 depositTimestamp;
//         uint256 yieldEarned;
//         bool verified;
//     }
//      string public constant VERSION = "1.0.0";
//     mapping(address => Feeder) public feeders;
//     mapping(string => address) public didToAddress; // DID to wallet mapping
    
//     uint256 public totalFeederLiquidity;
//     uint256 public yieldRate; // basis points (e.g., 100 = 1% APY)
    
//     event FeederRegistered(address indexed feederAddress, string did);
//     event LiquidityDeposited(address indexed feeder, uint256 amount);
//     event LiquidityWithdrawn(address indexed feeder, uint256 amount);
//     event YieldClaimed(address indexed feeder, uint256 yieldAmount);
    
//     constructor() {
      
//         yieldRate = 500; // 5% default APY
//     }
    
//     // Register feeder with DID verification
//     function registerFeeder(
//         string memory did,
//         address feederAddress
//     ) external {
//         require(bytes(did).length > 0, "Invalid DID");
//         require(feederAddress != address(0), "Invalid address");
        
//         feeders[feederAddress].did = did;
//         feeders[feederAddress].verified = true;
//         feeders[feederAddress].depositTimestamp = block.timestamp;
        
//         didToAddress[did] = feederAddress;
        
//         emit FeederRegistered(feederAddress, did);
//     }
    
//     // Feeder deposits stablecoin liquidity
//     function depositLiquidity(
//         address feeder,
//         address stablecoin,
//         uint256 amount
//     ) external {
//         require(feeders[feeder].verified, "Feeder not verified");
//         require(amount > 0, "Amount > 0");
        
//         IERC20(stablecoin).transferFrom(msg.sender, address(this), amount);
        
//         feeders[feeder].stablecoinBalance += amount;
//         totalFeederLiquidity += amount;
        
//         emit LiquidityDeposited(feeder, amount);
//     }
    
//     // Feeder withdraws liquidity
//     function withdrawLiquidity(
//         address feeder,
//         address stablecoin,
//         uint256 amount
//     ) external {
//         require(feeders[feeder].verified, "Feeder not verified");
//         require(feeders[feeder].stablecoinBalance >= amount, "Insufficient balance");
        
//         feeders[feeder].stablecoinBalance -= amount;
//         totalFeederLiquidity -= amount;
        
//         IERC20(stablecoin).transfer(msg.sender, amount);
        
//         emit LiquidityWithdrawn(feeder, amount);
//     }
    
//     // Claim accrued yield
//     function claimYield(address feeder) external {
//         require(feeders[feeder].verified, "Feeder not verified");
        
//         uint256 yield = calculateYield(feeder);
//         require(yield > 0, "No yield to claim");
        
//         feeders[feeder].yieldEarned += yield;
        
//         emit YieldClaimed(feeder, yield);
//     }
    
//     // Calculate yield for feeder
//     function calculateYield(address feeder) public view returns (uint256) {
//         Feeder memory f = feeders[feeder];
        
//         uint256 timeElapsed = block.timestamp - f.depositTimestamp;
//         uint256 secondsPerYear = 365 days;
//         uint256 yield = (f.stablecoinBalance * yieldRate * timeElapsed) / (10000 * secondsPerYear);
        
//         return yield;
//     }
    
//     // View feeder info
//     function getFeederInfo(address feeder) external view returns (Feeder memory) {
//         return feeders[feeder];
//     }
    
//     // View total feeder liquidity
//     function getTotalFeederLiquidity() external view returns (uint256) {
//         return totalFeederLiquidity;
//     }
// }