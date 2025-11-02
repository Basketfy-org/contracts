// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IERC20.sol";

// ============ BasketCore.sol ============

contract BasketCore is IERC20 {
    string public name;
    string public symbol;
    string public theme;
    uint8 public decimals = 18;
    uint256 public totalSupply;

    address[] public supportedTokens;
    uint256[] public defaultWeights;
    address public nftAddress;
    address public curator;
    uint256 public protocolFeePercentage;
    bool public active;

    struct UserPosition {
        uint256 bTokenBalance;
        uint256[] currentWeights;
        bool isOwner;
    }

    mapping(address => UserPosition) public userPositions;
    mapping(address => mapping(address => uint256)) public allowance;
    address[] public owners;

    modifier onlyCurator() {
        require(msg.sender == curator, "Only curator");
        _;
    }

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
    event CuratorChanged(address indexed oldCurator, address indexed newCurator, uint256 timestamp);
    event BasketPausedCore(uint256 timestamp);
    event BasketUnpausedCore(uint256 timestamp);
    event DefaultWeightsUpdated(uint256[] newWeights, uint256 timestamp);

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _theme,
        address[] memory _supportedTokens,
        uint256[] memory _defaultWeights,
        address _nftAddress,
        address _curator,
        uint256 _protocolFeePercentage
    ) {
        require(_supportedTokens.length == _defaultWeights.length, "Tokens/weights mismatch");
        require(_supportedTokens.length > 0, "No tokens provided");
        require(_nftAddress != address(0), "Invalid NFT address");
        require(_curator != address(0), "Invalid curator");

        name = _name;
        symbol = _symbol;
        theme = _theme;
        supportedTokens = _supportedTokens;
        defaultWeights = _defaultWeights;
        nftAddress = _nftAddress;
        curator = _curator;
        protocolFeePercentage = _protocolFeePercentage;
        active = true;
    }

    // ============ BASKET OPERATIONS ============

    function buyBasket(
        address user,
        uint256 bTokenAmount,
        uint256[] calldata customWeights
    ) external returns (bool) {
        require(active, "Basket is paused");
        require(user != address(0), "Invalid user address");
        require(bTokenAmount > 0, "bToken amount must be > 0");

        // Validate custom weights if provided
        if (customWeights.length > 0) {
            require(customWeights.length == supportedTokens.length, "Custom weights array length mismatch");
            uint256 totalWeight = 0;
            for (uint256 i = 0; i < customWeights.length; i++) {
                totalWeight += customWeights[i];
            }
            require(totalWeight == 10000, "Custom weights must sum to 10000 (100%)");
        }

        // Add user to owners list if not already owner
        if (!userPositions[user].isOwner) {
            userPositions[user].isOwner = true;
            // Use custom weights if provided, otherwise use default weights
            if (customWeights.length > 0) {
                userPositions[user].currentWeights = customWeights;
            } else {
                userPositions[user].currentWeights = defaultWeights;
            }
            owners.push(user);
            emit OwnerAdded(user, block.timestamp);
        }

        // Update user balance
        userPositions[user].bTokenBalance += bTokenAmount;
        
        // Mint tokens: increase totalSupply and emit Transfer from null address
        totalSupply += bTokenAmount;
        emit Transfer(address(0), user, bTokenAmount);
        
        // Emit basket bought event
        emit BasketBought(user, bTokenAmount, userPositions[user].currentWeights, block.timestamp);
        return true;
    }

    function redeemBasket(
        address user,
        uint256 bTokenAmount
    ) external returns (bool) {
        require(user != address(0), "Invalid user address");
        require(bTokenAmount > 0, "bToken amount must be > 0");
        require(userPositions[user].isOwner, "User is not basket owner");
        require(userPositions[user].bTokenBalance >= bTokenAmount, "Insufficient bToken balance");

        // Update user balance
        userPositions[user].bTokenBalance -= bTokenAmount;
        
        // Burn tokens: decrease totalSupply and emit Transfer to null address
        totalSupply -= bTokenAmount;
        emit Transfer(user, address(0), bTokenAmount);

        // Remove from owners if no balance left
        if (userPositions[user].bTokenBalance == 0) {
            userPositions[user].isOwner = false;
            _removeOwner(user);
            emit OwnerRemoved(user, block.timestamp);
        }

        // Emit basket redeemed event
        emit BasketRedeemed(user, bTokenAmount, block.timestamp);
        return true;
    }



    function rebalanceWeights(
        address user,
        uint256[] calldata newWeights
    ) external returns (bool) {
        require(user != address(0), "Invalid user address");
        require(userPositions[user].isOwner, "User is not basket owner");
        require(newWeights.length == supportedTokens.length, "Weight array length mismatch");

        uint256 totalWeight = 0;
        for (uint256 i = 0; i < newWeights.length; i++) {
            totalWeight += newWeights[i];
        }
        require(totalWeight == 10000, "New weights must sum to 10000 (100%)");

        uint256[] memory oldWeights = userPositions[user].currentWeights;
        userPositions[user].currentWeights = newWeights;

        emit BasketRebalanced(user, oldWeights, newWeights, block.timestamp);
        return true;
    }

    // ============ ADMIN FUNCTIONS ============

    function pauseBasket() external onlyCurator {
        require(active, "Basket already paused");
        active = false;
        emit BasketPausedCore(block.timestamp);
    }

    function unpauseBasket() external onlyCurator {
        require(!active, "Basket already active");
        active = true;
        emit BasketUnpausedCore(block.timestamp);
    }

    function changeCurator(address _newCurator) external onlyCurator {
        require(_newCurator != address(0), "Invalid curator address");
        address oldCurator = curator;
        curator = _newCurator;
        emit CuratorChanged(oldCurator, _newCurator, block.timestamp);
    }

    function updateDefaultWeights(uint256[] calldata _newDefaultWeights) 
        external 
        onlyCurator 
        returns (bool) 
    {
        require(_newDefaultWeights.length == supportedTokens.length, "Weight array length mismatch");

        uint256 totalWeight = 0;
        for (uint256 i = 0; i < _newDefaultWeights.length; i++) {
            totalWeight += _newDefaultWeights[i];
        }
        require(totalWeight == 10000, "Weights must sum to 10000 (100%)");

        defaultWeights = _newDefaultWeights;
        emit DefaultWeightsUpdated(_newDefaultWeights, block.timestamp);
        return true;
    }

    // ============ INTERNAL HELPERS ============

    function _removeOwner(address user) internal {
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == user) {
                owners[i] = owners[owners.length - 1];
                owners.pop();
                break;
            }
        }
    }

    // ============ VIEW FUNCTIONS ============

    function getUserPosition(address user) 
        external 
        view 
        returns (uint256 bTokenBalance, uint256[] memory currentWeights, bool isOwner) 
    {
        UserPosition storage pos = userPositions[user];
        return (pos.bTokenBalance, pos.currentWeights, pos.isOwner);
    }

    function getUserBTokenBalance(address user) external view returns (uint256) {
        return userPositions[user].bTokenBalance;
    }

    function getUserCurrentWeights(address user) external view returns (uint256[] memory) {
        return userPositions[user].currentWeights;
    }

    function isUserOwner(address user) external view returns (bool) {
        return userPositions[user].isOwner;
    }

    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    function getDefaultWeights() external view returns (uint256[] memory) {
        return defaultWeights;
    }

    function getNumberOfOwners() external view returns (uint256) {
        return owners.length;
    }

    function getOwnerAtIndex(uint256 index) external view returns (address) {
        require(index < owners.length, "Index out of bounds");
        return owners[index];
    }

    function getAllOwners() external view returns (address[] memory) {
        return owners;
    }

    function getTokenCount() external view returns (uint256) {
        return supportedTokens.length;
    }

    function getNFTAddress() external view returns (address) {
        return nftAddress;
    }

    function getCurator() external view returns (address) {
        return curator;
    }

    function getProtocolFeePercentage() external view returns (uint256) {
        return protocolFeePercentage;
    }

    function isBasketActive() external view returns (bool) {
        return active;
    }

    function getBasketName() external view returns (string memory) {
        return name;
    }

    function getBasketSymbol() external view returns (string memory) {
        return symbol;
    }

    function getBasketTheme() external view returns (string memory) {
        return theme;
    }

    function getOwnersByRange(uint256 startIndex, uint256 endIndex) 
        external 
        view 
        returns (address[] memory) 
    {
        require(startIndex <= endIndex, "Invalid range");
        require(endIndex < owners.length, "End index out of bounds");

        uint256 length = endIndex - startIndex + 1;
        address[] memory result = new address[](length);

        for (uint256 i = 0; i < length; i++) {
            result[i] = owners[startIndex + i];
        }

        return result;
    }

    function getUserDetails(address user) 
        external 
        view 
        returns (
            uint256 bTokenBalance,
            uint256[] memory currentWeights,
            bool isOwner,
            bool hasApproval
        ) 
    {
        UserPosition storage pos = userPositions[user];
        return (
            pos.bTokenBalance,
            pos.currentWeights,
            pos.isOwner,
            allowance[user][msg.sender] > 0
        );
    }

    function verifyWeights(uint256[] calldata weightsToCheck) 
        external 
        pure 
        returns (bool isValid) 
    {
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < weightsToCheck.length; i++) {
            totalWeight += weightsToCheck[i];
        }
        return totalWeight == 10000;
    }

    // ============ IERC20 IMPLEMENTATION ============

    function balanceOf(address account) external view returns (uint256) {
        return userPositions[account].bTokenBalance;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(active, "Basket is paused");
        require(userPositions[msg.sender].bTokenBalance >= amount, "Insufficient balance");
        
        userPositions[msg.sender].bTokenBalance -= amount;
        userPositions[to].bTokenBalance += amount;

        if (!userPositions[to].isOwner && amount > 0) {
            userPositions[to].isOwner = true;
            userPositions[to].currentWeights = defaultWeights;
            owners.push(to);
            emit OwnerAdded(to, block.timestamp);
        }

        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) external returns (bool) {
        uint256 currentAllowance = allowance[msg.sender][spender];
        allowance[msg.sender][spender] = currentAllowance + addedValue;
        emit Approval(msg.sender, spender, currentAllowance + addedValue);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
        uint256 currentAllowance = allowance[msg.sender][spender];
        require(currentAllowance >= subtractedValue, "Decreased allowance below zero");
        allowance[msg.sender][spender] = currentAllowance - subtractedValue;
        emit Approval(msg.sender, spender, currentAllowance - subtractedValue);
        return true;
    }

    function getAllowance(address owner, address spender) external view returns (uint256) {
        return allowance[owner][spender];
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(active, "Basket is paused");
        require(userPositions[from].bTokenBalance >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");

        allowance[from][msg.sender] -= amount;
        userPositions[from].bTokenBalance -= amount;
        userPositions[to].bTokenBalance += amount;

        if (!userPositions[to].isOwner && amount > 0) {
            userPositions[to].isOwner = true;
            userPositions[to].currentWeights = defaultWeights;
            owners.push(to);
            emit OwnerAdded(to, block.timestamp);
        }

        emit Transfer(from, to, amount);
        return true;
    }
}