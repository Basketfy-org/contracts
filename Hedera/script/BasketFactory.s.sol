// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {BasketFactory} from "../src/BasketFactory.sol";

contract BasketFactoryScript is Script {
    function run() external returns (address) {
        // Load the private key from the .env file
        uint256 deployerPrivateKey = vm.envUint("HEDERA_PRIVATE_KEY");
        
        // Start broadcasting transactions with the loaded private key
        vm.startBroadcast(deployerPrivateKey);

        // Get the deployer's address to use as the initial owner
        address deployerAddress = vm.addr(deployerPrivateKey);

        // Deploy the contract
       BasketFactory basketFactory = new BasketFactory();

        // Stop broadcasting
        vm.stopBroadcast();

        console.log("BasketFactory deployed to:", address(basketFactory));

        return address(basketFactory);
    }
}