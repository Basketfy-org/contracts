pragma solidity ^0.8.20;
import "../interfaces/IERC20.sol";

// Mock ERC20 token for testing
contract USDC is IERC20 {
    mapping(address => uint256) public balance;
    mapping(address => mapping(address => uint256)) public allowance;
    
    uint8 public _decimals = 6;
    uint256 public _totalSupply = 1_000_000_000 * 10**6;
    string public _name = "USDC";
    string public _symbol = "USDC";

    constructor() {
        balance[msg.sender] = _totalSupply;
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        balance[msg.sender] -= amount;
        balance[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balance[from] -= amount;
        balance[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function mint (address to, uint256 amount) external {
        balance[to] += amount;
        _totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function burn (address from, uint256 amount) external {
        balance[from] -= amount;
        _totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    function balanceOf(address account) external view returns (uint256) {
        return balance[account];
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function symbol() external view returns ( string memory) {
        return _symbol;
    }

    function name() external view returns (string memory ) {
        return _name;
    }
    

}