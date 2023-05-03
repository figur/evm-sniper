import blessed from 'blessed';
import config from './config.js';
import Web3 from 'web3';
import abi from './abi.js'

class UI {
    constructor() {
        this.config = config
        this.chains = this.config.get('chains');
        this.wallets = this.config.get('wallets');
        this.walletTokens = this.config.get('walletTokens');
        this.web3 = new Web3(new Web3.providers.HttpProvider(this.chains[0].url));

        this.screen = this.createScreen();
        this.walletList = this.createWalletList();
        this.tokenList = this.createTokenList();
        this.tokenDetailsBox = this.createTokenDetailsBox();
        this.currentChainBox = this.createCurrentChainBox();
        this.outputLog = this.createOutputLog();
        this.listBar = this.createListBar();
        this.primaryTokenBalanceText = this.createPrimaryTokenBalanceText();
        this.currentChain = blessed.text({
            parent: this.currentChainBox,
            tags: true,
            content: `{bold}${this.chains[0].name}{/bold}`,
        });
        this.rpcUrlText = blessed.text({
            parent: this.currentChainBox,
            left: '50%',
            tags: true,
            content: `{bold}RPC URL: ${this.chains[0].url}{/bold}`,
        });

        this.screen.append(this.walletList);
        this.screen.append(this.tokenList);
        this.screen.append(this.outputLog);
        this.screen.append(this.tokenDetailsBox);
        this.screen.append(this.currentChainBox);
        this.screen.append(this.listBar);
        this.updateWalletsUI();
    }

    createScreen() {
        return blessed.screen({
            smartCSR: true,
            title: 'EVM Wallet',
        });
    }

    createWalletList() {
        this.config.onDidChange('chains', (newValue, oldValue) => {
            this.chains = newValue;
        });

        this.config.onDidChange('wallets', (newValue, oldValue) => {
            this.wallets = newValue;
            this.updateWalletsUI();
        });

        this.config.onDidChange('walletTokens', async (newValue, oldValue) => {
            this.walletTokens = newValue;
            await this.updateTokensUI();
        });

        return blessed.list({
            top: '10%',
            left: 0,
            width: '50%',
            height: '45%',
            keys: true,
            mouse: true,
            label: 'Wallets',
            border: 'line',
            scrollbar: {
                ch: ' ',
                track: { bg: 'cyan' },
            },
            style: {
                selected: { bg: 'blue' },
            },
            items: [],
        });
    }

    createTokenList() {
        return blessed.list({
            top: "10%",
            left: "50%",
            width: "25%",
            height: "45%",
            keys: true,
            mouse: true,
            label: "ERC20 Tokens",
            border: "line",
            scrollbar: {
                ch: " ",
                track: { bg: "cyan" },
            },
            style: {
                selected: { bg: "blue" },
            },
            items: [],
        });
    }

    createTokenDetailsBox() {
        return blessed.box({
            top: '10%',
            left: '75%',
            width: '25%',
            height: '45%',
            keys: true,
            mouse: true,
            label: 'Token Details',
            border: 'line',
            scrollbar: {
                ch: ' ',
                track: { bg: 'cyan' },
            },
        });
    }

    createCurrentChainBox() {
        return blessed.box({
            top: 0,
            left: 0,
            height: '10%',
            width: '100%',
            border: 'line',
        });
    }

    createOutputLog() {
        return blessed.log({
            top: '55%',
            left: 0,
            right: 0,
            height: '45%',
            keys: true,
            mouse: true,
            label: 'Output Logs',
            border: 'line',
            scrollbar: {
                ch: ' ',
                track: { bg: 'cyan' },
            },
        });
    }

    createListBar() {
        return blessed.listbar({
            bottom: 0,
            left: 0,
            right: 0,
            height: 'shrink',
            keys: true,
            mouse: true,
            style: {
                prefix: { fg: 'blue' },
                item: { fg: 'white', bg: 'black', hover: { bg: 'blue' } },
                selected: { fg: 'white', bg: 'blue' }
            },
            commands: {
                'Add Wallet (A)': {
                    keys: ['a'],
                    callback: () => this.addWallet()
                },
                'Remove Wallet (R)': {
                    keys: ['r'],
                    callback: () => this.removeWallet()
                },
                'Add Token (T)': {
                    keys: ['t'],
                    callback: () => this.addToken()
                },
                'Remove Token (D)': {
                    keys: ['d'],
                    callback: () => this.removeToken()
                },
                'Chain (Ctrl+S)': {
                    keys: ['C-s'],
                    callback: () => this.showChainSwitcherMenu()
                },
                'Quit (Q)': {
                    keys: ['q', 'C-c'],
                    callback: () => process.exit(0)
                }
            }

        });
    }

    async updateWalletsUI() {
        if (!this.wallets || !this.wallets.length) {
            this.walletList.setItems(this.wallets);
            this.outputLog.log('No wallets have been added. Add a wallet by pressing (A).');
        } else {
            this.walletList.setItems(this.wallets);
            this.walletList.select(this.walletList.items.length - 1);
            let walletIndex = this.walletList.selected;
            let walletAddress = this.wallets[walletIndex];
            await this.getPrimaryTokenBalance(walletAddress);
            await this.updateTokensUI(walletAddress);
        }
        this.screen.render();
    }

    async updateTokensUI(walletAddress) {
        if (walletAddress) {
            await this.initTokenList(this.walletTokens[walletAddress]);
            this.tokenList.select(this.tokenList.items.length - 1);
            const tokenIndex = this.tokenList.selected;
            if (this.walletTokens[walletAddress]) {
                const tokenAddress = this.walletTokens[walletAddress][tokenIndex];
                this.displayTokenDetails(tokenAddress, walletAddress);
                this.screen.render();
            }
        }
    }

    async updateFocusedBorderColor() {
        if (this.walletList.focused) {
            this.walletList.style.border = { fg: 'green' };
            this.tokenList.style.border = { fg: 'white' };
        } else {
            this.walletList.style.border = { fg: 'white' };
            this.tokenList.style.border = { fg: 'green' };
        }
        this.screen.render();
    }

    async getTokenSymbols(tokenAddresses = []) {
        const tokenSymbols = [];

        for (const tokenAddress of tokenAddresses) {
            try {
                const token = new this.web3.eth.Contract(abi, tokenAddress);
                const symbol = await token.methods.symbol().call();
                tokenSymbols.push(`${symbol} (${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)})`);
            } catch (err) {
                this.outputLog.log(`Error fetching token symbol for ${tokenAddress}: ${err.message}`);
                tokenSymbols.push(`Unknown (${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)})`);
            }
        }

        return tokenSymbols;
    }

    async initTokenList(tokenAddresses = []) {
        this.outputLog.log('Refreshing tokens...');
        const tokenSymbols = await this.getTokenSymbols(tokenAddresses);
        this.outputLog.log('Tokens refreshed.');

        this.tokenList.setItems(tokenSymbols);

        this.tokenList.removeAllListeners('select');

        this.tokenList.on('select', async (item) => {
            const walletAddress = this.walletList.getItem(this.walletList.selected).content;
            const tokenIndex = tokenSymbols.indexOf(item.content);
            const tokenAddress = tokenAddresses[tokenIndex];
            this.displayTokenDetails(tokenAddress, walletAddress);
        });

        this.screen.render();
    }

    async switchChain(index) {
        this.outputLog.log(`Switching to ${this.chains[index].name}...`);
        this.web3.setProvider(new Web3.providers.HttpProvider(this.chains[index].url));
        this.currentChain.setContent(`{bold}${this.chains[index].name}{/bold}`);
        this.rpcUrlText.setContent(`{bold}RPC URL: ${this.chains[index].url}{/bold}`);
        this.outputLog.log(`Switched to ${this.chains[index].name}`);
        if (!this.wallets || !this.wallets.length) {
            this.outputLog.log('No wallets have been added. Add a wallet by pressing (A).');
        } else {
            const walletAddress = this.walletList.getItem(this.walletList.selected).content;
            await this.getPrimaryTokenBalance(walletAddress);
            if (!this.walletTokens[walletAddress] || !this.walletTokens[walletAddress].length) {
                this.outputLog.log('No tokens have been added. Add a token by pressing (T).');
            } else {
                this.initTokenList(this.walletTokens[walletAddress]);
            }
        }
    }

    showChainSwitcherMenu() {
        const chainSwitcherMenu = blessed.list({
            top: 'center',
            left: 'center',
            width: '50%',
            height: '50%',
            keys: true,
            mouse: true,
            label: 'Select Chain',
            border: 'line',
            items: this.chains.map(chain => chain.name),
            style: {
                selected: { bg: 'blue' },
            },
        });

        chainSwitcherMenu.on('select', (item) => {
            const chainIndex = this.chains.findIndex(chain => chain.name === item.content);
            this.switchChain(chainIndex);
            this.screen.remove(chainSwitcherMenu);
            this.screen.render();
        });

        chainSwitcherMenu.key(['escape'], () => {
            this.screen.remove(chainSwitcherMenu);
            this.screen.render();
        });

        this.screen.append(chainSwitcherMenu);
        const chainSwitcherListBar = blessed.listbar({
            parent: chainSwitcherMenu,
            bottom: 0,
            left: 0,
            right: 0,
            height: 'shrink',
            keys: true,
            mouse: true,
            autoCommandKeys: true,
            border: 'line',
            style: {
                prefix: { fg: 'blue' },
                item: { fg: 'white' },
                selected: { bg: 'blue', fg: 'white' },
            },
            commands: {
                'Info': {
                    keys: ['i'],
                    callback: () => {
                        this.screen.render();
                    }
                },
            },
        });

        chainSwitcherMenu.focus();
        this.screen.render();
    }

    createPrimaryTokenBalanceText() {
        return blessed.text({
            parent: this.currentChainBox,
            left: '75%',
            tags: true,
            content: `{bold}Balance: Loading...{/bold}`,
        });
    };

    async addWallet() {
        const prompt = blessed.prompt({
            parent: this.screen,
            top: 'center',
            left: 'center',
            height: 'shrink',
            width: '50%',
            label: 'Add Wallet',
            border: 'line',
        });

        prompt.readInput('Enter wallet address:', '', async (err, walletAddress) => {
            if (err) {
                this.outputLog.log(`Error: ${err.message}`);
                this.screen.remove(prompt);
                this.screen.render();
                return;
            }

            if (!walletAddress) {
                this.outputLog.log('No wallet address provided.');
                this.screen.remove(prompt);
                this.screen.render();
                return;
            }

            if (!this.web3.utils.isAddress(walletAddress)) {
                this.outputLog.log('Invalid wallet address provided.');
                this.screen.remove(prompt);
                this.screen.render();
                return;
            }
            this.config.set('wallets', [...this.config.get('wallets'), walletAddress]);
            this.config.set('walletTokens', { ...this.config.get('walletTokens'), [walletAddress]: [] });
            this.outputLog.log(`Wallet added: ${walletAddress}`);
            this.screen.remove(prompt);
            this.screen.render();
        });
    }

    removeWallet() {
        const walletIndex = this.walletList.selected;
        const walletAddress = this.config.get('wallets')[walletIndex];
        if (walletAddress === null || walletAddress === undefined) {
            outputLog.log('No wallet to remove.');
        } else {
            const updatedWallets = this.config.get('wallets').filter((_, index) => index !== walletIndex);
            this.config.set('wallets', updatedWallets);
            const updatedWalletTokens = { ...this.walletTokens };
            delete updatedWalletTokens[walletAddress];
            this.config.set('walletTokens', updatedWalletTokens);
        }
    }

    async addToken() {
        const walletIndex = this.walletList.selected;
        if (walletIndex === -1) {
            this.outputLog.log("No wallet selected. Please add and select a wallet before adding a token.");
            return;
        }
        const walletAddress = this.wallets[walletIndex];

        const tokenPrompt = blessed.prompt({
            parent: this.screen,
            top: 'center',
            left: 'center',
            width: '50%',
            height: 'shrink',
            keys: true,
            mouse: true,
            label: 'Add Token',
            border: 'line',
        });

        tokenPrompt.readInput('Enter token address:', '', async (err, value) => {
            if (err) {
                this.outputLog.log(`Error adding token: ${err.message}`);
                this.screen.remove(tokenPrompt);
                this.screen.render();
                return;
            }

            if (!value) {
                this.outputLog.log('No token address provided.');
                this.screen.remove(tokenPrompt);
                this.screen.render();
                return;
            }
            const token = new this.web3.eth.Contract(abi, value);
            const symbol = await token.methods.symbol().call();
            const displaySymbol = `${symbol} (${value.slice(0, 6)}...${value.slice(-4)})`;

            const newTokenAddresses = [...(this.walletTokens[walletAddress] || []), value];
            this.walletTokens = {
                ...this.walletTokens,
                [walletAddress]: newTokenAddresses,
            };
            this.config.set('walletTokens', this.walletTokens);

            this.outputLog.log(`Token added: ${displaySymbol}`);
            this.screen.remove(tokenPrompt);
            await this.initTokenList(this.walletTokens[walletAddress]);
            this.screen.render();
        });
    }

    removeToken() {
        const walletIndex = this.walletList.selected;
        if (walletIndex === -1) {
            this.outputLog.log("No wallet selected. Please add and select a wallet before removing a token.");
            return;
        }
        const walletAddress = this.wallets[walletIndex];

        const tokenIndex = this.tokenList.selected;
        if (this.walletTokens[walletAddress]) {
            const tokenAddress = this.walletTokens[walletAddress][tokenIndex];
            const updatedTokens = this.walletTokens[walletAddress].filter((_, index) => index !== tokenIndex);
            this.walletTokens = {
                ...this.walletTokens,
                [walletAddress]: updatedTokens,
            };
            this.config.set('walletTokens', this.walletTokens);
            this.outputLog.log(`Token removed: ${tokenAddress}`);
            this.initTokenList(this.walletTokens[walletAddress]);
        } else {
            this.outputLog.log('No token to remove.');
        }
    }

    async getPrimaryTokenBalance(walletAddress) {
        try {
            const balance = await this.web3.eth.getBalance(walletAddress);
            const formattedBalance = this.web3.utils.fromWei(balance, 'ether');
            this.primaryTokenBalanceText.setContent(`{bold}Balance: ${formattedBalance}{/bold}`);
            this.screen.render();
        } catch (err) {
            this.primaryTokenBalanceText.setContent(`{bold}Balance: Error{/bold}`);
            this.outputLog.log(`Error fetching primary token balance: ${err.message}`);
        }
    }

    async displayTokenDetails(tokenAddress, walletAddress) {
        this.outputLog.log(`Fetching token details for ${tokenAddress}...`);
        try {
            const token = new this.web3.eth.Contract(abi, tokenAddress);
            const name = await token.methods.name().call();
            const decimals = await token.methods.decimals().call();
            const totalSupply = await token.methods.totalSupply().call();
            const formattedSupply = totalSupply / 10 ** decimals;
            const symbol = await token.methods.symbol().call();
            const balance = await token.methods.balanceOf(walletAddress).call();
            const formattedBalance = balance / 10 ** decimals;
            this.tokenDetailsBox.setContent(`Name: ${name}\nSymbol: ${symbol}\nDecimals: ${decimals}\nTotal Supply: ${formattedSupply}\nWallet Balance: ${formattedBalance}`);
            this.screen.render();
            this.outputLog.log(`Token details fetched for ${tokenAddress}`);
        } catch (err) {
            this.outputLog.log(`Error fetching token details: ${err.message}`);
        }
    }
}

export default UI;