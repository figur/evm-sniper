import Conf from 'conf';
import yaml from 'js-yaml';

function toYamlString(input) {
  // Convert object to JSON, converting all leaf values to strings
  const stringifiedJson = JSON.stringify(input, (key, value) => 
    typeof value === 'object' && value !== null ? value : String(value)
  );
  
  // Convert back to object, so that js-yaml can handle it
  const stringifiedObject = JSON.parse(stringifiedJson);

  // Dump object to YAML
  return yaml.dump(stringifiedObject);
}


const config = new Conf({
  projectName: 'evm-sniper',
  fileExtension: 'yaml',
  serialize: toYamlString,
  deserialize: yaml.load,
  watch: true,
  defaults: {
    chains: [
      {
        name: 'Ethereum',
        rpc: {
          http: 'https://rpc.mevblocker.io',
          ws: ''
        },
        chainId: '1',
      },
      {
        name: 'BSC',
        rpc: {
          http: 'https://bsc-dataseed3.binance.org',
          ws: ''
        },
        chainId: '56',
      },
    ],
    wallets: [],
    tokens: []
  },
});

class Chain {
  static getAll() {
    return config.get('chains') || [];
  }

  static add(chain) {
    const chains = Chain.getAll();
    config.set("chains", [...chains, chain,]);
  }

  static remove(chainName) {
    let chains = Chain.getAll();
    chains = chains.filter(chain => chain.name !== chainName);
    config.set('chains', chains);
  }
}

class Wallet {
  static getAll() {
    return config.get('wallets') || [];
  }

  static add(wallet) {
    const wallets = Wallet.getAll();
    config.set("wallets", [...wallets, wallet,]);
  }

  static remove(publicKey) {
    let wallets = Wallet.getAll();
    wallets = wallets.filter(wallet => wallet.publicKey !== publicKey);
    config.set('wallets', wallets);
  }
}

class Token {
  static getAll(walletPublicKey, chainId) {
    const tokens = config.get('tokens') || [];
    return tokens.filter(token =>
      token.wallet === walletPublicKey &&
      token.chainId === chainId
    );
  }

  static add(tokenData) {
    const tokens = config.get("tokens") || [];
    config.set("tokens", [...tokens, tokenData,]);
  }

  static remove(contract, walletPublicKey, chainId) {
    const tokens = config.get("tokens") || [];
    tokens = tokens.filter(token =>
      token.contract !== contract ||
      token.wallet !== walletPublicKey ||
      token.chainId !== chainId
    );
    config.set('tokens', tokens);
  }
}


export default { config, Chain, Wallet, Token };
