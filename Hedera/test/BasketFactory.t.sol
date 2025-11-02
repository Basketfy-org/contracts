// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/BasketFactory.sol";
import "../src/BasketCore.sol";

contract BasketFactoryTest is Test {
    BasketFactory public factory;
    address public admin;
    address public curator;
    address public basketAdmin;
    address public nftAddress;
    
    address[] public supportedTokens;
    uint256[] public defaultWeights;
    
    event BasketCreated(
        uint256 indexed basketId,
        address indexed basketAddress,
        address bTokenAddress,
        address nftAddress,
        address basketAdmin,
        uint256 timestamp
    );
    
    event BasketDeactivated(uint256 indexed basketId, uint256 timestamp);
    event BasketActivated(uint256 indexed basketId, uint256 timestamp);
    event ProtocolFeeUpdated(uint256 newFeePercentage, uint256 timestamp);
    
    function setUp() public {
        admin = address(this);
        curator = makeAddr("curator");
        basketAdmin = makeAddr("basketAdmin");
        nftAddress = makeAddr("nftAddress");
        
        // Deploy factory
        factory = new BasketFactory();
        
        // Setup test tokens (using mock addresses)
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
    
    // ============ DEPLOY FACTORY TESTS ============
    
    function test_DeployFactory() public {
        assertEq(factory.admin(), admin);
        assertEq(factory.protocolFeePercentage(), 25);
        assertEq(factory.basketCounter(), 0);
        assertEq(factory.VERSION(), "1.0.0");
    }
    
    // ============ GET BASKET TESTS ============
    
    function test_GetBasketInfo() public {
        (uint256 basketId, address basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        BasketFactory.BasketInfo memory info = factory.getBasketInfo(basketId);
        
        assertEq(info.basketId, basketId);
        assertEq(info.basketAddress, basketAddress);
        assertEq(info.bTokenAddress, basketAddress);
        assertEq(info.nftAddress, nftAddress);
        assertEq(info.basketAdmin, basketAdmin);
        assertTrue(info.active);
        assertEq(info.supportedTokens.length, 3);
        assertEq(info.defaultWeights.length, 3);
    }
    
    function test_GetBasketSupportedTokens() public {
        (uint256 basketId,) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        address[] memory tokens = factory.getBasketSupportedTokens(basketId);
        assertEq(tokens.length, 3);
        assertEq(tokens[0], supportedTokens[0]);
        assertEq(tokens[1], supportedTokens[1]);
        assertEq(tokens[2], supportedTokens[2]);
    }
    
    function test_GetBasketDefaultWeights() public {
        (uint256 basketId,) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        uint256[] memory weights = factory.getBasketDefaultWeights(basketId);
        assertEq(weights.length, 3);
        assertEq(weights[0], 4000);
        assertEq(weights[1], 3500);
        assertEq(weights[2], 2500);
    }
    
    function test_GetBasketAdmin() public {
        (uint256 basketId,) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        assertEq(factory.getBasketAdmin(basketId), basketAdmin);
    }
    
    function test_IsBasketActive() public {
        (uint256 basketId,) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        assertTrue(factory.isBasketActive(basketId));
    }
    
    // ============ GET ALL BASKETS TESTS ============
    
    function test_GetAllBasketIds() public {
        // Deploy multiple baskets
        factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        factory.deployBasket(
            "DeFi Basket",
            "DEFI",
            "Decentralized Finance",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        factory.deployBasket(
            "Gaming Basket",
            "GAME",
            "Gaming",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        uint256[] memory basketIds = factory.getAllBasketIds();
        assertEq(basketIds.length, 3);
        assertEq(basketIds[0], 0);
        assertEq(basketIds[1], 1);
        assertEq(basketIds[2], 2);
    }
    
    function test_GetTotalBasketsDeployed() public {
        assertEq(factory.getTotalBasketsDeployed(), 0);
        
        factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        assertEq(factory.getTotalBasketsDeployed(), 1);
        
        factory.deployBasket(
            "DeFi Basket",
            "DEFI",
            "Decentralized Finance",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        assertEq(factory.getTotalBasketsDeployed(), 2);
    }
    
    // ============ DEPLOY BASKET TESTS ============
    
    function test_DeployBasket() public {
        vm.expectEmit(true, false, false, false);
        emit BasketCreated(0, address(0), address(0), nftAddress, basketAdmin, block.timestamp);
        
        (uint256 basketId, address basketAddress) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        assertEq(basketId, 0);
        assertTrue(basketAddress != address(0));
        assertEq(factory.basketCounter(), 1);
        
        BasketFactory.BasketInfo memory info = factory.getBasketInfo(basketId);
        assertEq(info.basketId, basketId);
        assertEq(info.basketAddress, basketAddress);
        assertEq(info.nftAddress, nftAddress);
        assertEq(info.basketAdmin, basketAdmin);
        assertTrue(info.active);
    }
    
    function test_DeployMultipleBaskets() public {
        // Deploy first basket
        (uint256 basketId1, address basketAddress1) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        // Deploy second basket
        (uint256 basketId2, address basketAddress2) = factory.deployBasket(
            "DeFi Basket",
            "DEFI",
            "Decentralized Finance",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        assertEq(basketId1, 0);
        assertEq(basketId2, 1);
        assertTrue(basketAddress1 != basketAddress2);
        assertEq(factory.basketCounter(), 2);
    }
    
    function testRevert_DeployBasketNonAdmin() public {
        vm.prank(makeAddr("nonAdmin"));
        vm.expectRevert("Only factory admin");
        factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
    }
    
    function testRevert_DeployBasketTokensWeightsMismatch() public {
        uint256[] memory wrongWeights = new uint256[](2);
        wrongWeights[0] = 5000;
        wrongWeights[1] = 5000;
        
        vm.expectRevert("Tokens/weights mismatch");
        factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            wrongWeights,
            nftAddress,
            curator,
            basketAdmin
        );
    }
    
    function testRevert_DeployBasketInvalidWeights() public {
        uint256[] memory invalidWeights = new uint256[](3);
        invalidWeights[0] = 4000;
        invalidWeights[1] = 3000;
        invalidWeights[2] = 2000; // Sum = 9000, not 10000
        
        vm.expectRevert("Weights must sum to 10000 (100%)");
        factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            invalidWeights,
            nftAddress,
            curator,
            basketAdmin
        );
    }
    
    function testRevert_DeployBasketInvalidAddresses() public {
        vm.expectRevert("Invalid NFT address");
        factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            address(0),
            curator,
            basketAdmin
        );
        
        vm.expectRevert("Invalid curator");
        factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            address(0),
            basketAdmin
        );
        
        vm.expectRevert("Invalid basket admin");
        factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            address(0)
        );
    }
    
    // ============ BASKET MANAGEMENT TESTS ============
    
    function test_DeactivateBasket() public {
        (uint256 basketId,) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        assertTrue(factory.isBasketActive(basketId));
        
        vm.expectEmit(true, false, false, true);
        emit BasketDeactivated(basketId, block.timestamp);
        factory.deactivateBasket(basketId);
        
        assertFalse(factory.isBasketActive(basketId));
    }
    
    function test_ActivateBasket() public {
        (uint256 basketId,) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        factory.deactivateBasket(basketId);
        assertFalse(factory.isBasketActive(basketId));
        
        vm.expectEmit(true, false, false, true);
        emit BasketActivated(basketId, block.timestamp);
        factory.activateBasket(basketId);
        
        assertTrue(factory.isBasketActive(basketId));
    }
    
    function test_SetProtocolFeePercentage() public {
        assertEq(factory.getProtocolFeePercentage(), 25);
        
        vm.expectEmit(false, false, false, true);
        emit ProtocolFeeUpdated(50, block.timestamp);
        factory.setProtocolFeePercentage(50);
        
        assertEq(factory.getProtocolFeePercentage(), 50);
    }
    
    function testRevert_SetProtocolFeePercentageTooHigh() public {
        vm.expectRevert("Fee too high (max 10%)");
        factory.setProtocolFeePercentage(1001);
    }
    
    function test_ChangeFactoryAdmin() public {
        address newAdmin = makeAddr("newAdmin");
        
        factory.changeFactoryAdmin(newAdmin);
        assertEq(factory.admin(), newAdmin);
    }
    
    function test_ChangeBasketAdmin() public {
        (uint256 basketId,) = factory.deployBasket(
            "Tech Basket",
            "TECH",
            "Technology",
            supportedTokens,
            defaultWeights,
            nftAddress,
            curator,
            basketAdmin
        );
        
        address newBasketAdmin = makeAddr("newBasketAdmin");
        factory.changeBasketAdmin(basketId, newBasketAdmin);
        
        assertEq(factory.getBasketAdmin(basketId), newBasketAdmin);
    }
}