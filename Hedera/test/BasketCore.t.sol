// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/BasketFactory.sol";
import "../src/BasketCore.sol";

contract BasketCoreTest is Test {
    BasketFactory public factory;
    BasketCore public basketCore;
    
    address public admin;
    address public curator;
    address public basketAdmin;
    address public nftAddress;
    address public user1;
    address public user2;
    
    address[] public supportedTokens;
    uint256[] public defaultWeights;
    
    uint256 public basketId;
    address public basketAddress;
    
    event BasketBought(
        address indexed user,
        uint256 bTokenAmount,
        uint256[] initialWeights,
        uint256 timestamp
    );
    
    event BasketRedeemed(
        address indexed user,
        uint256 bTokenBurned,
        uint256 timestamp
    );
    
    event BasketRebalanced(
        address indexed user,
        uint256[] oldWeights,
        uint256[] newWeights,
        uint256 timestamp
    );
    
    event OwnerAdded(address indexed user, uint256 timestamp);
    event OwnerRemoved(address indexed user, uint256 timestamp);
    
    function setUp() public {
        admin = address(this);
        curator = makeAddr("curator");
        basketAdmin = makeAddr("basketAdmin");
        nftAddress = makeAddr("nftAddress");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        
        // Deploy factory
        factory = new BasketFactory();
        
        // Setup test tokens
        supportedTokens = new address[](3);
        supportedTokens[0] = makeAddr("token1");
        supportedTokens[1] = makeAddr("token2");
        supportedTokens[2] = makeAddr("token3");
        
        // Setup default weights (must sum to 10000 = 100%)
        defaultWeights = new uint256[](3);
        defaultWeights[0] = 4000; // 40%
        defaultWeights[1] = 3500; // 35%
        defaultWeights[2] = 2500; // 25%
    }
    
    // ============ DEPLOY BASKET (VIA FACTORY) TEST ============
    
    function test_DeployBasketViaFactory() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        // Verify basket properties
        assertEq(basketCore.name(), "Tech Basket");
        assertEq(basketCore.symbol(), "TECH");
        assertEq(basketCore.theme(), "Technology");
        assertEq(basketCore.curator(), curator);
        assertEq(basketCore.nftAddress(), nftAddress);
        assertTrue(basketCore.active());
        assertEq(basketCore.totalSupply(), 0);
        
        // Verify supported tokens
        address[] memory tokens = basketCore.getSupportedTokens();
        assertEq(tokens.length, 3);
        assertEq(tokens[0], supportedTokens[0]);
        assertEq(tokens[1], supportedTokens[1]);
        assertEq(tokens[2], supportedTokens[2]);
        
        // Verify default weights
        uint256[] memory weights = basketCore.getDefaultWeights();
        assertEq(weights.length, 3);
        assertEq(weights[0], 4000);
        assertEq(weights[1], 3500);
        assertEq(weights[2], 2500);
    }
    
    // ============ BUY BASKET WITH DEFAULT WEIGHT TESTS ============
    
    function test_BuyBasketWithDefaultWeight() public {
        // Deploy basket first
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        uint256 bTokenAmount = 1000 * 10**18;
        uint256[] memory emptyWeights = new uint256[](0);
        
        vm.expectEmit(true, false, false, false);
        emit OwnerAdded(user1, block.timestamp);
        
        vm.expectEmit(true, false, false, false);
        emit BasketBought(user1, bTokenAmount, defaultWeights, block.timestamp);
        
        bool success = basketCore.buyBasket(user1, bTokenAmount, emptyWeights);
        assertTrue(success);
        
        // Verify user position
        (uint256 balance, uint256[] memory weights, bool isOwner) = basketCore.getUserPosition(user1);
        assertEq(balance, bTokenAmount);
        assertTrue(isOwner);
        assertEq(weights.length, 3);
        assertEq(weights[0], 4000);
        assertEq(weights[1], 3500);
        assertEq(weights[2], 2500);
        
        // Verify total supply increased
        assertEq(basketCore.totalSupply(), bTokenAmount);
        assertEq(basketCore.balanceOf(user1), bTokenAmount);
    }
    
    function test_BuyBasketMultipleTimes() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        uint256[] memory emptyWeights = new uint256[](0);
        
        // First buy
        basketCore.buyBasket(user1, 1000 * 10**18, emptyWeights);
        assertEq(basketCore.getUserBTokenBalance(user1), 1000 * 10**18);
        
        // Second buy (should add to existing balance)
        basketCore.buyBasket(user1, 500 * 10**18, emptyWeights);
        assertEq(basketCore.getUserBTokenBalance(user1), 1500 * 10**18);
        
        assertEq(basketCore.totalSupply(), 1500 * 10**18);
    }
    
    function test_BuyBasketMultipleUsers() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        uint256[] memory emptyWeights = new uint256[](0);
        
        basketCore.buyBasket(user1, 1000 * 10**18, emptyWeights);
        basketCore.buyBasket(user2, 2000 * 10**18, emptyWeights);
        
        assertEq(basketCore.getUserBTokenBalance(user1), 1000 * 10**18);
        assertEq(basketCore.getUserBTokenBalance(user2), 2000 * 10**18);
        assertEq(basketCore.totalSupply(), 3000 * 10**18);
        assertEq(basketCore.getNumberOfOwners(), 2);
    }
    
    function testRevert_BuyBasketZeroAmount() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        uint256[] memory emptyWeights = new uint256[](0);
        
        vm.expectRevert("bToken amount must be > 0");
        basketCore.buyBasket(user1, 0, emptyWeights);
    }
    
    function testRevert_BuyBasketPaused() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        // Pause basket
        vm.prank(curator);
        basketCore.pauseBasket();
        
        uint256[] memory emptyWeights = new uint256[](0);
        vm.expectRevert("Basket is paused");
        basketCore.buyBasket(user1, 1000 * 10**18, emptyWeights);
    }
    
    // ============ BUY BASKET WITH CUSTOM WEIGHT TESTS ============
    
    function test_BuyBasketWithCustomWeight() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        // Create custom weights
        uint256[] memory customWeights = new uint256[](3);
        customWeights[0] = 5000; // 50%
        customWeights[1] = 3000; // 30%
        customWeights[2] = 2000; // 20%
        
        uint256 bTokenAmount = 1000 * 10**18;
        
        bool success = basketCore.buyBasket(user1, bTokenAmount, customWeights);
        assertTrue(success);
        
        // Verify user has custom weights, not default weights
        uint256[] memory userWeights = basketCore.getUserCurrentWeights(user1);
        assertEq(userWeights.length, 3);
        assertEq(userWeights[0], 5000);
        assertEq(userWeights[1], 3000);
        assertEq(userWeights[2], 2000);
    }
    
    function test_BuyBasketDifferentUsersCustomWeights() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        // User1 with custom weights
        uint256[] memory customWeights1 = new uint256[](3);
        customWeights1[0] = 5000;
        customWeights1[1] = 3000;
        customWeights1[2] = 2000;
        
        basketCore.buyBasket(user1, 1000 * 10**18, customWeights1);
        
        // User2 with different custom weights
        uint256[] memory customWeights2 = new uint256[](3);
        customWeights2[0] = 6000;
        customWeights2[1] = 2500;
        customWeights2[2] = 1500;
        
        basketCore.buyBasket(user2, 2000 * 10**18, customWeights2);
        
        // Verify each user has their own weights
        uint256[] memory user1Weights = basketCore.getUserCurrentWeights(user1);
        assertEq(user1Weights[0], 5000);
        
        uint256[] memory user2Weights = basketCore.getUserCurrentWeights(user2);
        assertEq(user2Weights[0], 6000);
    }
    
    function testRevert_BuyBasketInvalidCustomWeightsSum() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        uint256[] memory invalidWeights = new uint256[](3);
        invalidWeights[0] = 5000;
        invalidWeights[1] = 3000;
        invalidWeights[2] = 1000; // Sum = 9000, not 10000
        
        vm.expectRevert("Custom weights must sum to 10000 (100%)");
        basketCore.buyBasket(user1, 1000 * 10**18, invalidWeights);
    }
    
    function testRevert_BuyBasketInvalidCustomWeightsLength() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        uint256[] memory wrongLengthWeights = new uint256[](2);
        wrongLengthWeights[0] = 5000;
        wrongLengthWeights[1] = 5000;
        
        vm.expectRevert("Custom weights array length mismatch");
        basketCore.buyBasket(user1, 1000 * 10**18, wrongLengthWeights);
    }
    
    // ============ REDEEM BASKET TESTS ============
    
    function test_RedeemBasket() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        // Buy basket first
        uint256[] memory emptyWeights = new uint256[](0);
        basketCore.buyBasket(user1, 1000 * 10**18, emptyWeights);
        
        // Redeem partial amount
        uint256 redeemAmount = 400 * 10**18;
        
        vm.expectEmit(true, false, false, false);
        emit BasketRedeemed(user1, redeemAmount, block.timestamp);
        
        bool success = basketCore.redeemBasket(user1, redeemAmount);
        assertTrue(success);
        
        // Verify balance decreased
        assertEq(basketCore.getUserBTokenBalance(user1), 600 * 10**18);
        assertEq(basketCore.totalSupply(), 600 * 10**18);
        assertTrue(basketCore.isUserOwner(user1));
    }
    
    function test_RedeemBasketFullAmount() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        uint256[] memory emptyWeights = new uint256[](0);
        basketCore.buyBasket(user1, 1000 * 10**18, emptyWeights);
        
        // Redeem full amount
        vm.expectEmit(true, false, false, false);
        emit OwnerRemoved(user1, block.timestamp);
        
        basketCore.redeemBasket(user1, 1000 * 10**18);
        
        // Verify user is no longer owner
        assertEq(basketCore.getUserBTokenBalance(user1), 0);
        assertFalse(basketCore.isUserOwner(user1));
        assertEq(basketCore.totalSupply(), 0);
        assertEq(basketCore.getNumberOfOwners(), 0);
    }
    
    function testRevert_RedeemBasketNotOwner() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        vm.expectRevert("User is not basket owner");
        basketCore.redeemBasket(user1, 1000 * 10**18);
    }
    
    function testRevert_RedeemBasketInsufficientBalance() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        uint256[] memory emptyWeights = new uint256[](0);
        basketCore.buyBasket(user1, 1000 * 10**18, emptyWeights);
        
        vm.expectRevert("Insufficient bToken balance");
        basketCore.redeemBasket(user1, 2000 * 10**18);
    }
    
    // ============ REBALANCE USER WEIGHT TESTS ============
    
    function test_RebalanceUserWeight() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        // Buy basket first
        uint256[] memory emptyWeights = new uint256[](0);
        basketCore.buyBasket(user1, 1000 * 10**18, emptyWeights);
        
        // Verify initial weights
        uint256[] memory initialWeights = basketCore.getUserCurrentWeights(user1);
        assertEq(initialWeights[0], 4000);
        
        // Rebalance to new weights
        uint256[] memory newWeights = new uint256[](3);
        newWeights[0] = 5000; // 50%
        newWeights[1] = 3000; // 30%
        newWeights[2] = 2000; // 20%
        
        vm.expectEmit(true, false, false, false);
        emit BasketRebalanced(user1, initialWeights, newWeights, block.timestamp);
        
        bool success = basketCore.rebalanceWeights(user1, newWeights);
        assertTrue(success);
        
        // Verify weights changed
        uint256[] memory updatedWeights = basketCore.getUserCurrentWeights(user1);
        assertEq(updatedWeights[0], 5000);
        assertEq(updatedWeights[1], 3000);
        assertEq(updatedWeights[2], 2000);
    }
    
    function test_RebalanceMultipleTimes() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        uint256[] memory emptyWeights = new uint256[](0);
        basketCore.buyBasket(user1, 1000 * 10**18, emptyWeights);
        
        // First rebalance
        uint256[] memory weights1 = new uint256[](3);
        weights1[0] = 5000;
        weights1[1] = 3000;
        weights1[2] = 2000;
        basketCore.rebalanceWeights(user1, weights1);
        
        // Second rebalance
        uint256[] memory weights2 = new uint256[](3);
        weights2[0] = 3333;
        weights2[1] = 3333;
        weights2[2] = 3334;
        basketCore.rebalanceWeights(user1, weights2);
        
        uint256[] memory finalWeights = basketCore.getUserCurrentWeights(user1);
        assertEq(finalWeights[0], 3333);
        assertEq(finalWeights[1], 3333);
        assertEq(finalWeights[2], 3334);
    }
    
    function testRevert_RebalanceNotOwner() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        uint256[] memory newWeights = new uint256[](3);
        newWeights[0] = 5000;
        newWeights[1] = 3000;
        newWeights[2] = 2000;
        
        vm.expectRevert("User is not basket owner");
        basketCore.rebalanceWeights(user1, newWeights);
    }
    
    function testRevert_RebalanceInvalidWeightsSum() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        uint256[] memory emptyWeights = new uint256[](0);
        basketCore.buyBasket(user1, 1000 * 10**18, emptyWeights);
        
        uint256[] memory invalidWeights = new uint256[](3);
        invalidWeights[0] = 5000;
        invalidWeights[1] = 3000;
        invalidWeights[2] = 1000; // Sum = 9000
        
        vm.expectRevert("New weights must sum to 10000 (100%)");
        basketCore.rebalanceWeights(user1, invalidWeights);
    }
    
    // ============ GET USER POSITION TESTS ============
    
    function test_GetUserPosition() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        uint256[] memory emptyWeights = new uint256[](0);
        basketCore.buyBasket(user1, 1000 * 10**18, emptyWeights);
        
        (uint256 balance, uint256[] memory weights, bool isOwner) = basketCore.getUserPosition(user1);
        
        assertEq(balance, 1000 * 10**18);
        assertTrue(isOwner);
        assertEq(weights.length, 3);
        assertEq(weights[0], 4000);
        assertEq(weights[1], 3500);
        assertEq(weights[2], 2500);
    }
    
    function test_GetUserPositionNonOwner() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        (uint256 balance, uint256[] memory weights, bool isOwner) = basketCore.getUserPosition(user1);
        
        assertEq(balance, 0);
        assertFalse(isOwner);
        assertEq(weights.length, 0);
    }
    
    // ============ GET USER BALANCE TESTS ============
    
    function test_GetUserBTokenBalance() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        assertEq(basketCore.getUserBTokenBalance(user1), 0);
        
        uint256[] memory emptyWeights = new uint256[](0);
        basketCore.buyBasket(user1, 1000 * 10**18, emptyWeights);
        
        assertEq(basketCore.getUserBTokenBalance(user1), 1000 * 10**18);
        assertEq(basketCore.balanceOf(user1), 1000 * 10**18);
    }
    
    function test_GetUserBTokenBalanceAfterRedeem() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        uint256[] memory emptyWeights = new uint256[](0);
        basketCore.buyBasket(user1, 1000 * 10**18, emptyWeights);
        basketCore.redeemBasket(user1, 400 * 10**18);
        
        assertEq(basketCore.getUserBTokenBalance(user1), 600 * 10**18);
    }
    
    // ============ GET USER CURRENT WEIGHT TESTS ============
    
    function test_GetUserCurrentWeights() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        uint256[] memory emptyWeights = new uint256[](0);
        basketCore.buyBasket(user1, 1000 * 10**18, emptyWeights);
        
        uint256[] memory weights = basketCore.getUserCurrentWeights(user1);
        assertEq(weights.length, 3);
        assertEq(weights[0], 4000);
        assertEq(weights[1], 3500);
        assertEq(weights[2], 2500);
    }
    
    function test_GetUserCurrentWeightsAfterRebalance() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        uint256[] memory emptyWeights = new uint256[](0);
        basketCore.buyBasket(user1, 1000 * 10**18, emptyWeights);
        
        uint256[] memory newWeights = new uint256[](3);
        newWeights[0] = 5000;
        newWeights[1] = 3000;
        newWeights[2] = 2000;
        basketCore.rebalanceWeights(user1, newWeights);
        
        uint256[] memory weights = basketCore.getUserCurrentWeights(user1);
        assertEq(weights[0], 5000);
        assertEq(weights[1], 3000);
        assertEq(weights[2], 2000);
    }
    
    function test_GetUserCurrentWeightsWithCustomInitial() public {
        (basketId, basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        basketCore = BasketCore(basketAddress);
        
        uint256[] memory customWeights = new uint256[](3);
        customWeights[0] = 6000;
        customWeights[1] = 2500;
        customWeights[2] = 1500;
        
        basketCore.buyBasket(user1, 1000 * 10**18, customWeights);
        
        uint256[] memory weights = basketCore.getUserCurrentWeights(user1);
        assertEq(weights[0], 6000);
        assertEq(weights[1], 2500);
        assertEq(weights[2], 1500);
    }
}