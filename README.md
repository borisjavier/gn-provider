# GN Provider for sCrypt

A custom BSV provider for sCrypt contracts using the WhatsOnChain API. This package provides seamless integration with the Bitcoin SV blockchain through the popular WhatsOnChain service.

## Prerequisites

Before using GN Provider, you need to have sCrypt installed in your project. The recommended version is **scrypt-ts v1.4.5** or higher.

To check your current sCrypt version:
```bash
npm list scrypt-ts
```

To install/update sCrypt:
```bash
npm install scrypt-ts@latest
```

## Installation

Install GN Provider using npm:

```bash
npm install gn-provider
```

During installation, the package will automatically:
1. Build the provider files
2. Copy them to the sCrypt providers directory
3. Make them available for import within your sCrypt projects

## Usage

### Basic Setup

```typescript
import { GNProvider } from 'scrypt-ts/dist/providers/gn-provider';

// Initialize provider (mainnet or testnet)
const provider = new GNProvider(bsv.Networks.mainnet);

// Connect to the provider
await provider.connect();

// Check connection status
console.log('Connected:', provider.isConnected());
```

### Using with sCrypt Contracts

```typescript
import { GNProvider } from 'scrypt-ts/dist/providers/gn-provider';
import { bsv, TestWallet } from 'scrypt-ts';
import { MyContract } from './src/contracts/myContract';
import * as dotenv from 'dotenv';
dotenv.config();

const privateKey = bsv.PrivateKey.fromWIF(process.env.PRIVATE_KEY || '')
const woc_api_key = 'your_woc_api_key_here';

async function main() {
  // 1. Initialize provider
  const provider = new GNProvider(bsv.Networks.mainnet, woc_api_key);
  const signer = new TestWallet( privateKey, provider );
  
  // 2. Load your contract artifact
  await MyContract.loadArtifact();
  
  // 3. Create contract instance
  const instance = new MyContract();
  
  // 4. Connect contract to provider
  instance.connect(signer);
  
  // 5. Deploy contract
  const deployTx = await instance.deploy(100); // Deploy with initial satoshis
  console.log('Contract deployed:', deployTx.id);
  
  // 6. Call contract method
  const { tx: callTx } = await instance.methods.myMethod(...parameters);
  console.log('Method executed:', callTx.id);
}

main().catch(console.error);
```

### Advanced Configuration

```typescript
// Use your API key for enhanced rate limits
const provider = new GNProvider(
  bsv.Networks.mainnet, 
  'your-woc-api-key-here'
);

// Set custom timeout (milliseconds)
provider.connect().timeout(5000);

// Handle connection events
provider.on('connected', (status) => {
  console.log('Connection status changed:', status);
});

provider.on('networkChange', (network) => {
  console.log('Network changed to:', network.name);
});
```

## API Reference

### `new GNProvider(network: bsv.Networks.Network, apiKey?: string)`
Creates a new provider instance.
- `network`: BSV network (mainnet or testnet)
- `apiKey`: Optional. User your WhatsOnChain API key for higher rate limits

### Methods
| Method | Description |
|--------|-------------|
| `connect(): Promise<this>` | Connects to the provider |
| `isConnected(): boolean` | Checks connection status |
| `sendRawTransaction(rawTxHex: string): Promise<string>` | Sends raw transaction |
| `listUnspent(address: string): Promise<UTXO[]>` | Lists UTXOs for an address |
| `getBalance(address: string): Promise<{confirmed: number, unconfirmed: number}>` | Gets address balance |
| `getTransaction(txHash: string): Promise<Transaction>` | Retrieves transaction details |
| `getFeePerKb(): Promise<number>` | Estimates current fee rate |

## Features

- **Seamless sCrypt integration**: Automatically installs into sCrypt's provider directory
- **Real-time connection monitoring**: Event-based connection status updates
- **Smart fee estimation**: Dynamic fee calculation based on network conditions
- **Error handling**: Built-in handling of common blockchain errors
- **TypeScript support**: Full type definitions included

## Troubleshooting

If you encounter any issues:
1. Verify sCrypt version: `npm list scrypt-ts`
2. Check provider installation: Look for `gn-provider.js` in:
   `node_modules/scrypt-ts/dist/providers/`
3. Ensure you're using the correct network (mainnet/testnet)
4. Verify your WhatsOnChain API key if using rate-limited operations

## Support

For support, bug reports, or feature requests, please open an issue on our [GitHub repository](https://github.com/borisjavier/gn-provider).

## License

MIT License - see [LICENSE](LICENSE) for details.