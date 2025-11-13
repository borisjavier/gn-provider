import * as scryptlib from 'scryptlib';
import { Provider, TransactionResponse, TxHash, UtxoQueryOptions } from 'scrypt-ts/dist/bsv/abstract-provider';
import { AddressOption, UTXO } from 'scrypt-ts/dist/bsv/types';
declare enum ProviderEvent {
    Connected = "connected",
    NetworkChange = "networkChange"
}
export declare class GNProvider extends Provider {
    emit: (event: ProviderEvent, ...args: any[]) => boolean;
    private _network;
    private _isConnected;
    private _wocApiKey;
    private _gorillaPoolApiKey;
    private apiPrefix;
    private _mapiURL;
    private _getHeaders;
    connect: () => Promise<this>;
    getFeePerKb: () => Promise<number>;
    constructor(network: scryptlib.bsv.Networks.Network, wocApiKey?: string, gpApiKey?: string);
    isConnected: () => boolean;
    updateNetwork: (network: scryptlib.bsv.Networks.Network) => void;
    getNetwork: () => scryptlib.bsv.Networks.Network;
    protected _ready: () => Promise<void>;
    sendRawTransaction: (rawTxHex: string) => Promise<TxHash>;
    sendTransaction: (signedTx: scryptlib.bsv.Transaction) => Promise<string>;
    listUnspent: (address: AddressOption, options?: UtxoQueryOptions) => Promise<UTXO[]>;
    getBalance: (address: AddressOption) => Promise<{
        confirmed: number;
        unconfirmed: number;
    }>;
    getTransaction: (txHash: string) => Promise<TransactionResponse>;
    private needIgnoreError;
    private friendlyBIP22RejectionMsg;
}
export {};
