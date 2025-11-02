// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IERC20.sol";
import "./BasketCore.sol";

// ============ BasketFactory.sol ============
contract BasketFactory {
    address public admin;
    string public constant VERSION = "1.0.0";

    uint256 public basketCounter;
    uint256 public protocolFeePercentage = 25; // 0.25%

    struct BasketInfo {
        uint256 basketId;
        address basketAddress;
        address bTokenAddress;
        address nftAddress;
        address[] supportedTokens;
        uint256[] defaultWeights;
        address basketAdmin;
        bool active;
    }

    mapping(uint256 => BasketInfo) public baskets;
    uint256[] public basketIds;

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
    event AdminChanged(
        address indexed oldAdmin,
        address indexed newAdmin,
        uint256 timestamp
    );
    event BasketAdminChanged(
        uint256 indexed basketId,
        address indexed newAdmin,
        uint256 timestamp
    );
    event BasketPaused(uint256 indexed basketId, uint256 timestamp);
    event BasketUnpaused(uint256 indexed basketId, uint256 timestamp);

    modifier onlyAdmin() {
        _onlyAdmin();
        _;
    }

    modifier basketExists(uint256 basketId) {
        require(baskets[basketId].active, "Basket not active");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // ============ BASKET CREATION ============

    function deployBasket(
        string calldata _name,
        string calldata _symbol,
        string calldata _theme,
        address[] calldata _supportedTokens,
        uint256[] calldata _defaultWeights,
        address _nftAddress,
        address _curator,
        address _basketAdmin
    ) external onlyAdmin returns (uint256 basketId, address basketAddress) {
        require(
            _supportedTokens.length == _defaultWeights.length,
            "Tokens/weights mismatch"
        );
        require(_supportedTokens.length > 0, "No tokens provided");
        require(_nftAddress != address(0), "Invalid NFT address");
        require(_curator != address(0), "Invalid curator");
        require(_basketAdmin != address(0), "Invalid basket admin");

        uint256 totalWeight = 0;
        for (uint256 i = 0; i < _defaultWeights.length; i++) {
            require(_supportedTokens[i] != address(0), "Invalid token address");
            totalWeight += _defaultWeights[i];
        }
        require(totalWeight == 10000, "Weights must sum to 10000 (100%)");

        BasketCore basketCore = new BasketCore(
            _name,
            _symbol,
            _theme,
            _supportedTokens,
            _defaultWeights,
            _nftAddress,
            _curator,
            protocolFeePercentage
        );

        basketAddress = address(basketCore);
        basketId = basketCounter++;

        baskets[basketId] = BasketInfo({
            basketId: basketId,
            basketAddress: basketAddress,
            bTokenAddress: basketAddress,
            nftAddress: _nftAddress,
            supportedTokens: _supportedTokens,
            defaultWeights: _defaultWeights,
            basketAdmin: _basketAdmin,
            active: true
        });

        basketIds.push(basketId);

        emit BasketCreated(
            basketId,
            basketAddress,
            basketAddress,
            _nftAddress,
            _basketAdmin,
            block.timestamp
        );

        return (basketId, basketAddress);
    }

    // ============ BASKET MANAGEMENT ============

    function deactivateBasket(uint256 basketId) external onlyAdmin {
        require(baskets[basketId].active, "Already inactive");
        baskets[basketId].active = false;
        emit BasketDeactivated(basketId, block.timestamp);
    }

    function activateBasket(uint256 basketId) external onlyAdmin {
        require(!baskets[basketId].active, "Already active");
        baskets[basketId].active = true;
        emit BasketActivated(basketId, block.timestamp);
    }

    function setProtocolFeePercentage(
        uint256 _feePercentage
    ) external onlyAdmin {
        require(_feePercentage <= 1000, "Fee too high (max 10%)");
        protocolFeePercentage = _feePercentage;
        emit ProtocolFeeUpdated(_feePercentage, block.timestamp);
    }

    function changeFactoryAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid address");
        address oldAdmin = admin;
        admin = _newAdmin;
        emit AdminChanged(oldAdmin, _newAdmin, block.timestamp);
    }

    function changeBasketAdmin(
        uint256 basketId,
        address _newAdmin
    ) external onlyAdmin basketExists(basketId) {
        require(_newAdmin != address(0), "Invalid address");
        baskets[basketId].basketAdmin = _newAdmin;
        emit BasketAdminChanged(basketId, _newAdmin, block.timestamp);
    }

    // ============ VIEW FUNCTIONS ============

    function getBasketInfo(
        uint256 basketId
    ) external view returns (BasketInfo memory) {
        return baskets[basketId];
    }

    function getAllBasketIds() external view returns (uint256[] memory) {
        return basketIds;
    }

    function getTotalBasketsDeployed() external view returns (uint256) {
        return basketCounter;
    }

    function isBasketActive(uint256 basketId) external view returns (bool) {
        return baskets[basketId].active;
    }

    function getBasketSupportedTokens(
        uint256 basketId
    ) external view returns (address[] memory) {
        return baskets[basketId].supportedTokens;
    }

    function getBasketDefaultWeights(
        uint256 basketId
    ) external view returns (uint256[] memory) {
        return baskets[basketId].defaultWeights;
    }

    function getBasketAdmin(uint256 basketId) external view returns (address) {
        return baskets[basketId].basketAdmin;
    }

    function getProtocolFeePercentage() external view returns (uint256) {
        return protocolFeePercentage;
    }

    function _onlyAdmin() internal {
        require(msg.sender == admin, "Only factory admin");
    }
}
