import Conf from 'conf';
import yaml from 'js-yaml';

const config = new Conf({
  projectName: 'evm-sniper',
  fileExtension: 'yaml',
  serialize: yaml.dump,
  deserialize: yaml.load,
  watch: true,
  defaults: {
    chains: [
      {
        name: 'Ethereum',
        url: 'https://rpc.mevblocker.io',
        chainId: 1,
      },
      {
        name: 'BSC',
        url: 'https://bsc-dataseed3.binance.org',
        chainId: 56,
      },
    ],
    wallets: [],
    walletTokens: {},
    chainTokens: {},
  },
});

export default config;
