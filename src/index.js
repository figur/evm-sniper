import blessed from 'blessed';
import Web3 from 'web3';
import config from './config.js'

// Access the stored values
let chains = config.get('chains');
let wallets = config.get('wallets');
let tokenAddresses = config.get('tokenAddresses');

// Watch for changes
const chainsWatcher = config.onDidChange('chains', (newValue, oldValue) => {
    // Update the 'chains' variable
    chains = newValue;
});

const walletsWatcher = config.onDidChange('wallets', (newValue, oldValue) => {
    // Update the 'wallets' variable
    wallets = newValue;
    walletList.setItems(wallets); // Refresh wallet list UI
    walletList.select(walletList.items.length - 1);
    screen.render(); // Render the updated UI
});

const tokenAddressesWatcher = config.onDidChange('tokenAddresses', async (newValue, oldValue) => {
    // Update the 'tokenAddresses' variable
    tokenAddresses = newValue;
    await initTokenList(tokenAddresses); // Refresh token list UI
    tokenList.select(tokenList.items.length - 1);
});

// Initialize the web3 instance with the first chain
const web3 = new Web3(new Web3.providers.HttpProvider(chains[0].url));

// Create the main blessed screen
const screen = blessed.screen({
    smartCSR: true,
    title: 'EVM Wallet',
});

// Create the wallet list box
const walletList = blessed.list({
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
    items: wallets, // Add wallet addresses here
});

async function initTokenList(tokenAddresses) {
    outputLog.log('Refreshing tokens...'); // Log message before retrieving tokens
    const tokenSymbols = await getTokenSymbols(tokenAddresses);
    outputLog.log('Tokens refreshed.'); // Log message after retrieving tokens

    tokenList.setItems(tokenSymbols);

    // Remove previous event listeners
    tokenList.removeAllListeners('select');

    // Set event listeners for tokenList
    tokenList.on('select', async (item) => {
        const walletAddress = walletList.getItem(walletList.selected).content;
        const tokenIndex = tokenSymbols.indexOf(item.content);
        const tokenAddress = tokenAddresses[tokenIndex];
        displayTokenDetails(tokenAddress, walletAddress);
    });

    screen.render();
}

const tokenList = blessed.list({
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

const tokenDetailsBox = blessed.box({
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

const currentChainBox = blessed.box({
    top: 0,
    left: 0,
    height: '10%',
    width: '100%',
    border: 'line',
});

const currentChain = blessed.text({
    parent: currentChainBox,
    tags: true,
    content: `{bold}${chains[0].name}{/bold}`,
});

const rpcUrlText = blessed.text({
    parent: currentChainBox,
    left: '50%',
    tags: true,
    content: `{bold}RPC URL: ${chains[0].url}{/bold}`,
});

const primaryTokenBalanceText = blessed.text({
    parent: currentChainBox,
    left: '75%',
    tags: true,
    content: `{bold}Balance: Loading...{/bold}`,
});

// Create the output log box
const outputLog = blessed.log({
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

const listBar = blessed.listbar({
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
            callback: () => addWallet()
        },
        'Remove Wallet (R)': {
            keys: ['r'],
            callback: () => removeWallet()
        },
        'Add Token (T)': {
            keys: ['t'],
            callback: () => addToken()
        },
        'Remove Token (D)': {
            keys: ['d'],
            callback: () => removeToken()
        },
        'Chain (Ctrl+S)': {
            keys: ['C-s'],
            callback: () => showChainSwitcherMenu()
        },
        'Quit (Q)': {
            keys: ['q', 'C-c'],
            callback: () => process.exit(0)
        }
    }

});


// Attach UI elements to the screen
//screen.append(chainSwitcher);
screen.append(walletList);
screen.append(tokenList);
screen.append(outputLog);
screen.append(tokenDetailsBox);
screen.append(currentChainBox);
screen.append(listBar);

displayTokens(wallets[0]);

// Set the focus to the walletList
walletList.focus();

walletList.on('select', async (item) => {
    const walletAddress = item.content;
    await displayTokens(walletAddress);
});


screen.key(['tab'], () => {
    if (walletList.focused) {
        tokenList.focus();
    } else {
        walletList.focus();
    }
});

function updateFocusedBorderColor() {
    if (walletList.focused) {
        walletList.style.border = { fg: 'green' };
        tokenList.style.border = { fg: 'white' };
    } else {
        walletList.style.border = { fg: 'white' };
        tokenList.style.border = { fg: 'green' };
    }
    screen.render();
}

async function addWallet() {
    const prompt = blessed.prompt({
        parent: screen, // Add the parent property to attach the prompt to the screen
        top: 'center',
        left: 'center',
        height: 'shrink',
        width: '50%',
        label: 'Add Wallet',
        border: 'line',
    });

    prompt.readInput('Enter wallet address:', '', async (err, walletAddress) => {
        if (err) {
            outputLog.log(`Error: ${err.message}`);
            screen.remove(prompt);
            screen.render();
            return;
        }

        if (!walletAddress) {
            outputLog.log('No wallet address provided.');
            screen.remove(prompt);
            screen.render();
            return;
        }

        if (!web3.utils.isAddress(walletAddress)) {
            outputLog.log('Invalid wallet address provided.');
            screen.remove(prompt);
            screen.render();
            return;
        }
        config.set('wallets', [...config.get('wallets'), walletAddress]);
        outputLog.log(`Wallet added: ${walletAddress}`);
        screen.remove(prompt);
        screen.render();
    });
}


function removeWallet() {
    const walletIndex = walletList.selected;
    const walletAddress = config.get('wallets')[walletIndex];
    const updatedWallets = config.get('wallets').filter((_, index) => index !== walletIndex);
    config.set('wallets', updatedWallets);
    outputLog.log(`Wallet removed: ${walletAddress}`);
}

function addToken() {
    const tokenPrompt = blessed.prompt({
        parent: screen, // Add the parent property to attach the prompt to the screen
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
            outputLog.log(`Error adding token: ${err.message}`);
            screen.remove(tokenPrompt);
            screen.render();
            return;
        }

        if (!value) {
            outputLog.log('No token address provided.');
            screen.remove(tokenPrompt);
            screen.render();
            return;
        }
        const token = new web3.eth.Contract(ERC20_ABI, value);
        const symbol = await token.methods.symbol().call();
        const displaySymbol = `${symbol} (${value.slice(0, 6)}...${value.slice(-4)})`;
        config.set('tokenAddresses', [...config.get('tokenAddresses'), value]);
        outputLog.log(`Token added: ${displaySymbol}`);
        screen.remove(tokenPrompt);
        screen.render();
    });
}

function removeToken() {
    const tokenIndex = tokenList.selected;
    const tokenAddress = tokenAddresses[tokenIndex];
    const updatedTokens = tokenAddresses.filter((_, index) => index !== tokenIndex);
    config.set('tokenAddresses', updatedTokens);
    outputLog.log(`Token removed: ${tokenAddress}`);
}

walletList.on('focus', () => updateFocusedBorderColor());
tokenList.on('focus', () => updateFocusedBorderColor());

async function switchChain(index) {
    outputLog.log(`Switching to ${chains[index].name}...`);
    web3.setProvider(new Web3.providers.HttpProvider(chains[index].url));
    currentChain.setContent(`{bold}${chains[index].name}{/bold}`);
    rpcUrlText.setContent(`{bold}RPC URL: ${chains[index].url}{/bold}`);
    outputLog.log(`Switched to ${chains[index].name}`);
    const walletAddress = walletList.getItem(walletList.selected).content;
    await displayTokens(walletAddress);
}


function showChainSwitcherMenu() {
    const chainSwitcherMenu = blessed.list({
        top: 'center',
        left: 'center',
        width: '50%',
        height: '50%',
        keys: true,
        mouse: true,
        label: 'Select Chain',
        border: 'line',
        items: chains.map(chain => chain.name),
        style: {
            selected: { bg: 'blue' },
        },
    });

    chainSwitcherMenu.on('select', (item) => {
        const chainIndex = chains.findIndex(chain => chain.name === item.content);
        switchChain(chainIndex);
        screen.remove(chainSwitcherMenu);
        screen.render();
    });

    chainSwitcherMenu.key(['escape'], () => {
        screen.remove(chainSwitcherMenu);
        screen.render();
    });

    screen.append(chainSwitcherMenu);
    // Set the focus to the chainSwitcherMenu
    chainSwitcherMenu.focus();
    screen.render();
}

async function displayTokens(walletAddress) {
    try {
        const balance = await web3.eth.getBalance(walletAddress);
        const formattedBalance = web3.utils.fromWei(balance, 'ether');
        primaryTokenBalanceText.setContent(`{bold}Balance: ${formattedBalance}{/bold}`);
        screen.render();
    } catch (err) {
        primaryTokenBalanceText.setContent(`{bold}Balance: Error{/bold}`);
        outputLog.log(`Error fetching primary token balance: ${err.message}`);
    }
}


async function getTokenSymbols(tokenAddresses) {
    const tokenSymbols = [];

    for (const tokenAddress of tokenAddresses) {
        try {
            const token = new web3.eth.Contract(ERC20_ABI, tokenAddress);
            const symbol = await token.methods.symbol().call();
            tokenSymbols.push(`${symbol} (${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)})`);
        } catch (err) {
            outputLog.log(`Error fetching token symbol for ${tokenAddress}: ${err.message}`);
            tokenSymbols.push(`Unknown (${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)})`);
        }
    }

    return tokenSymbols;
}


async function displayTokenDetails(tokenAddress, walletAddress) {
    outputLog.log(`Fetching token details for ${tokenAddress}...`);
    try {
        const token = new web3.eth.Contract(ERC20_ABI, tokenAddress);

        const name = await token.methods.name().call();
        const decimals = await token.methods.decimals().call();
        const totalSupply = await token.methods.totalSupply().call();
        const formattedSupply = totalSupply / 10 ** decimals;
        const symbol = await token.methods.symbol().call();
        const balance = await token.methods.balanceOf(walletAddress).call();
        const formattedBalance = balance / 10 ** decimals;
        tokenDetailsBox.setContent(`Name: ${name}\nSymbol: ${symbol}\nDecimals: ${decimals}\nTotal Supply: ${formattedSupply}\nWallet Balance: ${formattedBalance}`);
        screen.render();
        outputLog.log(`Token details fetched for ${tokenAddress}`);
    } catch (err) {
        outputLog.log(`Error fetching token details: ${err.message}`);
    }
}

// Define the ERC20_ABI variable (only relevant methods)
const ERC20_ABI = [
    { "constant": true, "inputs": [], "name": "name", "outputs": [{ "name": "", "type": "string" }], "payable": false, "type": "function" },
    { "constant": true, "inputs": [], "name": "symbol", "outputs": [{ "name": "", "type": "string" }], "payable": false, "type": "function" },
    { "constant": true, "inputs": [], "name": "decimals", "outputs": [{ "name": "", "type": "uint8" }], "payable": false, "type": "function" },
    { "constant": true, "inputs": [], "name": "totalSupply", "outputs": [{ "name": "", "type": "uint256" }], "payable": false, "type": "function" },
    { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "payable": false, "type": "function" },
];

// Start the TUI application
screen.render();
initTokenList(tokenAddresses);