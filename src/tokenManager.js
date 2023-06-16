import abi from './abi.js'
import { config } from "./conf.js";

class TokenManager {
    constructor(uiManager, web3) {
        this.uiManager = uiManager;
        this.walletTokens = config.get("walletTokens");
        this.web3 = web3

        config.onDidChange('walletTokens', async (newValue, oldValue) => {
            this.walletTokens = newValue;
            await this.updateTokensUI();
        });
    }

    async initTokenList(tokenAddresses = []) {
        this.uiManager.outputLog.log("Refreshing tokens...");
        const tokenSymbols = await this.getTokenSymbols(tokenAddresses);
        this.uiManager.outputLog.log("Tokens refreshed.");

        this.tokenList.setItems(tokenSymbols);

        this.tokenList.removeAllListeners("select");

        this.tokenList.on("select", async (item) => {
            const tokenIndex = tokenSymbols.indexOf(item.content);
            const tokenAddress = tokenAddresses[tokenIndex];
            this.displayTokenDetails(tokenAddress, this.uiManager.activeWallet.public);
        });

        this.uiManager.screen.render();
    }

    async getTokenSymbols(tokenAddresses = []) {
        const tokenSymbols = [];

        for (const tokenAddress of tokenAddresses) {
            try {
                const token = new this.web3.eth.Contract(abi, tokenAddress);
                const symbol = await token.methods.symbol().call();
                tokenSymbols.push(
                    `${symbol} (${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)})`
                );
            } catch (err) {
                this.uiManager.outputLog.log(
                    `Error fetching token symbol for ${tokenAddress}: ${err.message}`
                );
                tokenSymbols.push(
                    `Unknown (${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)})`
                );
            }
        }

        return tokenSymbols;
    }

    async addToken() {
        if (this.uiManager.activeWalletIndex === -1) {
            this.uiManager.outputLog.log(
                "No wallet selected. Please add and select a wallet before adding a token."
            );
            return;
        }

        await this.uiManager.promptUser("Token address:", async (tokenAddress) => {
            if (!tokenAddress) {
                this.logError("No token address provided.");
                return;
            }

            const token = new this.web3.eth.Contract(abi, tokenAddress);
            const symbol = await token.methods.symbol().call();
            const displaySymbol = `${symbol} (${tokenAddress.slice(
                0,
                6
            )}...${tokenAddress.slice(-4)})`;

            const newTokenAddresses = [
                ...(this.walletTokens[this.uiManager.activeWallet.public] || []),
                tokenAddress,
            ];
            this.walletTokens = {
                ...this.walletTokens,
                [this.uiManager.activeWallet.public]: newTokenAddresses,
            };
            this.config.set("walletTokens", this.walletTokens);

            this.uiManager.outputLog.log(`Token added: ${displaySymbol}`);
            await this.initTokenList(this.walletTokens[this.uiManager.activeWallet.public]);
        }, this.uiManager.screen);
    }

    removeToken() {
        if (this.uiManager.activeWalletIndex === -1) {
            this.uiManager.outputLog.log(
                "No wallet selected. Please add and select a wallet before removing a token."
            );
            return;
        }

        const tokenIndex = this.tokenList.selected;
        if (this.walletTokens[this.uiManager.activeWallet.public]) {
            const tokenAddress = this.walletTokens[this.uiManager.activeWallet.public][tokenIndex];
            const updatedTokens = this.walletTokens[this.uiManager.activeWallet.public].filter(
                (_, index) => index !== tokenIndex
            );
            this.walletTokens = {
                ...this.walletTokens,
                [this.uiManager.activeWallet.public]: updatedTokens,
            };
            this.config.set("walletTokens", this.walletTokens);
            this.uiManager.outputLog.log(`Token removed: ${tokenAddress}`);
            this.initTokenList(this.walletTokens[this.uiManager.activeWallet.public]);
        } else {
            this.uiManager.outputLog.log("No token to remove.");
        }
    }

    async getPrimaryTokenBalance() {
        try {
            const balance = await this.web3.eth.getBalance(this.uiManager.activeWallet.public);
            return this.web3.utils.fromWei(balance, "ether");
        } catch (err) {
            this.uiManager.outputLog.log(
                `Error fetching primary token balance: ${err.message}`
            );
        }
    }

    async displayTokenDetails(tokenAddress) {
        this.uiManager.outputLog.log(`Fetching token details for ${tokenAddress}...`);
        try {
            const token = new this.web3.eth.Contract(abi, tokenAddress);
            const [name, decimals, totalSupply, symbol, balance] = await Promise.all([
                token.methods.name().call(),
                token.methods.decimals().call(),
                token.methods.totalSupply().call(),
                token.methods.symbol().call(),
                token.methods.balanceOf(this.uiManager.activeWallet.public).call(),
            ]);
            const formattedSupply = totalSupply / 10 ** decimals;
            const formattedBalance = balance / 10 ** decimals;
            this.tokenDetailsBox.setContent(
                `Name: ${name}\nSymbol: ${symbol}\nDecimals: ${decimals}\nTotal Supply: ${formattedSupply}\nWallet Balance: ${formattedBalance}`
            );
            this.uiManager.screen.render();
            this.uiManager.outputLog.log(`Token details fetched for ${tokenAddress}`);
        } catch (err) {
            this.uiManager.outputLog.log(`Error fetching token details: ${err.message}`);
        }
    }
}

export default TokenManager;