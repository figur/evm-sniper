const blessed = require('blessed');
const Web3 = require('web3');

// Define the EVM compatible chains
const chains = [
    { name: 'Ethereum', url: 'https://rpc.mevblocker.io' },
    { name: 'BSC', url: 'https://bsc-dataseed3.binance.org' },
    // Add more EVM compatible chains here
];

// Initialize the web3 instance with the first chain
const web3 = new Web3(new Web3.providers.HttpProvider(chains[0].url));

// Create the main blessed screen
const screen = blessed.screen({
    smartCSR: true,
    title: 'EVM Wallet',
});

const currentChain = blessed.text({
    top: 0,
    left: 0,
    height: '10%',
    tags: true,
    content: `{bold}${chains[0].name}{/bold}`,
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
    items: ["0x601A63C50448477310feDb826ED0295499bAf623", "0x0caC9C3D7196f5BbD76FaDcd771fB69b772c0F9d"], // Add wallet addresses here
});

async function initTokenList() {
    const tokenAddresses = [
        "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
        "0x7D8146cf21e8D7cbe46054e01588207b51198729",
    ];
    outputLog.log('Retrieving tokens...'); // Log message before retrieving tokens
    const tokenSymbols = await getTokenSymbols(tokenAddresses);
    outputLog.log('Tokens retrieved.'); // Log message after retrieving tokens

    tokenList.setItems(tokenSymbols);

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
screen.append(currentChain);
screen.append(listBar);

// Set the focus to the walletList
walletList.focus();

// Handle input events
// screen.key(['C-s'], () => showChainSwitcherMenu());
// screen.key(['q', 'C-c'], () => process.exit(0));

walletList.on('select', (item) => displayTokens(item.content));



function switchChain(index) {
    outputLog.log(`Switching to ${chains[index].name}...`);
    web3.setProvider(new Web3.providers.HttpProvider(chains[index].url));
    currentChain.setContent(`{bold}${chains[index].name}{/bold}`);
    outputLog.log(`Switched to ${chains[index].name}`);
    displayTokens(walletList.selected);
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

// async function displayTokens(walletAddress, tokenAddress) {
//     try {
//         const token = new web3.eth.Contract(ERC20_ABI, tokenAddress);
//         const decimals = await token.methods.decimals().call();

//         const formattedBalance = balance / 10 ** decimals;

//         outputLog.log(`${symbol} balance for wallet ${walletAddress}: ${formattedBalance}`);
//         return { symbol, balance: formattedBalance };
//     } catch (err) {
//         outputLog.log(`Error fetching token balance: ${err.message}`);
//     }
// }

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
initTokenList();