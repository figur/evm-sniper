import config from './config.js';
import UI from './ui.js';

const ui = new UI();

// ui.walletList.focus();

// ui.walletList.on('select', async (item) => {
//     const walletAddress = item.content;
//     await ui.displayTokens(walletAddress, ui.screen);
// });

// ui.screen.key(['tab'], () => {
//     if (ui.walletList.focused) {
//         ui.tokenList.focus();
//     } else {
//         ui.walletList.focus();
//     }
// });

// Focus management
ui.screen.key(['tab', 'S-tab'], function (_, key) {
    if (key.shift) {
        ui.screen.focusPrevious();
    } else {
        ui.screen.focusNext();
    }
});

function getActiveWalletChainTokens(walletAddress, activeChainId) {
    const activeWalletTokens = config.get("walletTokens")[walletAddress] || [];
    const activeChainTokens = config.get("chainTokens")[activeChainId] || [];

    return activeWalletTokens.filter((token) => activeChainTokens.includes(token));
}

// ui.walletList.on('focus', () => ui.updateFocusedBorderColor());
// ui.tokenList.on('focus', () => ui.updateFocusedBorderColor());

ui.screen.render();