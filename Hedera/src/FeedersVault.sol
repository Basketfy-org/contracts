// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============ FeederVault.sol ============
// Manages liquidity provider deposits and yield

import "./interfaces/IERC20.sol";

contract FeedersVault {

    
    struct Feeder {
        string did; // Decentralized Identity
        uint256 stablecoinBalance;
        uint256 depositTimestamp;
        uint256 yieldEarned;
    }
    string public constant VERSION = "1.0.0";
    mapping(address => Feeder) public feeders;
    mapping(string => address) public didToAddress; // DID to wallet mapping
    
    uint256 public totalFeederLiquidity;
    uint256 public yieldRate; // basis points (e.g., 100 = 1% APY)
    
    event FeederRegistered(address indexed feederAddress, string did);
    event LiquidityDeposited(address indexed feeder, uint256 amount);
    event LiquidityWithdrawn(address indexed feeder, uint256 amount);
    event YieldClaimed(address indexed feeder, uint256 yieldAmount);
    
    constructor() {
      
        yieldRate = 500; // 5% default APY
    }
    
    // Register feeder with DID (optional, no verification required)
    function registerFeeder(
        string memory did
    ) external {
        require(bytes(did).length > 0, "Invalid DID");
        
        feeders[msg.sender].did = did;
        feeders[msg.sender].depositTimestamp = block.timestamp;
        
        didToAddress[did] = msg.sender;
        
        emit FeederRegistered(msg.sender, did);
    }
    
    // Feeder deposits stablecoin liquidity
    function depositLiquidity(
        address stablecoin,
        uint256 amount
    ) external {
        require(amount > 0, "Amount > 0");
        
        IERC20(stablecoin).transferFrom(msg.sender, address(this), amount);
        
        // Initialize feeder if not already created
        if (feeders[msg.sender].depositTimestamp == 0) {
            feeders[msg.sender].depositTimestamp = block.timestamp;
        }
        
        feeders[msg.sender].stablecoinBalance += amount;
        totalFeederLiquidity += amount;
        
        emit LiquidityDeposited(msg.sender, amount);
    }
    
    // Feeder withdraws liquidity
    function withdrawLiquidity(
        address stablecoin,
        uint256 amount
    ) external {
        require(feeders[msg.sender].stablecoinBalance >= amount, "Insufficient balance");
        
        feeders[msg.sender].stablecoinBalance -= amount;
        totalFeederLiquidity -= amount;
        
        
       bool success=IERC20(stablecoin).transfer(msg.sender, amount);
        require(success, "Transfer failed");
        
        emit LiquidityWithdrawn(msg.sender, amount);
    }
    
    // Claim accrued yield
    function claimYield() external {
        uint256 yield = calculateYield(msg.sender);
        require(yield > 0, "No yield to claim");
        
        feeders[msg.sender].yieldEarned += yield;
        
        emit YieldClaimed(msg.sender, yield);
    }
    
    // Calculate yield for feeder
    function calculateYield(address feeder) public view returns (uint256) {
        Feeder memory f = feeders[feeder];
        
        if (f.depositTimestamp == 0) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - f.depositTimestamp;
        uint256 secondsPerYear = 365 days;
        uint256 yield = (f.stablecoinBalance * yieldRate * timeElapsed) / (10000 * secondsPerYear);
        
        return yield;
    }
    
    // View feeder info
    function getFeederInfo(address feeder) external view returns (Feeder memory) {
        return feeders[feeder];
    }
    
    // View total feeder liquidity
    function getTotalFeederLiquidity() external view returns (uint256) {
        return totalFeederLiquidity;
    }
}