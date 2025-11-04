import { EventEmitter } from 'events';
import * as scryptlib from 'scryptlib';
import { Provider, TransactionResponse, TxHash, UtxoQueryOptions } from 'scrypt-ts/dist/bsv/abstract-provider';
import * as superagent from 'superagent';
import { filterUTXO } from 'scrypt-ts/dist/bsv/utils';
import { AddressOption, UTXO } from 'scrypt-ts/dist/bsv/types';

enum ProviderEvent {
    Connected = "connected",
    NetworkChange = "networkChange"
}

export type UTXOWithHeight = UTXO & {
    height: number;
};

export class GNProvider extends Provider {
    emit!: (event: ProviderEvent, ...args: any[]) => boolean;
    private _network: scryptlib.bsv.Networks.Network;
    private _isConnected = false;
    private _apiKey: string;
    private apiPrefix!: () => string;

    private _getHeaders = () => {
        return {
            'Content-Type': 'application/json',
            ...(this._apiKey ? { 'woc-api-key': this._apiKey } : {})
        };
    }


   connect = async (): Promise<this> => {
        try {
            const headers = this._getHeaders();
            const res = await superagent.get(`${this.apiPrefix()}/woc`)
                .timeout(3000)
                .set(headers);

            if (res.ok && res.text === "Whats On Chain") {
                this._isConnected = true;
                this.emit(ProviderEvent.Connected, true);
                return this;
            }
            throw new Error(res.body?.msg || res.text);
        } catch (error: any) {
            this._isConnected = false;
            this.emit(ProviderEvent.Connected, false);
            throw new Error(`connect failed: ${error.message || "unknown error"}`);
        }
    }

    getFeePerKb = async (): Promise<number> => {
        await this._ready();
        const headers = this._getHeaders();
        
        try {
            // Paso 1: Obtener la información de la cadena para obtener la altura actual
            const chainInfoRes = await superagent.get(`${this.apiPrefix()}/chain/info`)
                .set(headers);
            
            const currentHeight = chainInfoRes.body.blocks;
            
            // Paso 2: Obtener las estadísticas del bloque actual
            const blockStatsRes = await superagent.get(`${this.apiPrefix()}/block/height/${currentHeight}/stats`)
                .set(headers);
            
            const blockStats = blockStatsRes.body;
            const totalFee = blockStats.total_fee;
            const size = blockStats.size;
            
            // Si el tamaño es 0, evitar división por cero
            if (size === 0) {
                throw new Error('Block size is zero');
            }
            
            // Calcular tarifa por kilobyte: (total_fee * 1024) / size
            const feePerKb = (totalFee * 1024) / size;
            
            // Aplicar un multiplicador para asegurar una tarifa competitiva (1.5x)
            const competitiveFee = feePerKb * 1.5;
            
            // Establecer un mínimo de 50 sat/kb y un máximo de 5000 sat/kb para evitar valores extremos
            const safeFee = Math.max(50, Math.min(competitiveFee, 5000));
            
            console.log(`Calculated fee rate: ${safeFee.toFixed(2)} sat/kb from block ${currentHeight}`);
            return Math.round(safeFee * 100) / 100;
            
        } catch (error) {
            console.warn('Fee estimation from block stats failed, using fallback');
            return 500; // Fallback a 500 sat/kb
        }
    }

   constructor(network: scryptlib.bsv.Networks.Network, apiKey = '') {
        super();
        
        this._network = network;
        this._apiKey = apiKey;
        this._isConnected = false;

        this.apiPrefix = () => {
            const networkStr = this._network.name === scryptlib.bsv.Networks.mainnet.name ? 'main' : 'test';
            return `https://api.whatsonchain.com/v1/bsv/${networkStr}`;
        };
        
        Object.setPrototypeOf(this, EventEmitter.prototype);
        
        this.connect().catch(console.error);
    }
   isConnected = (): boolean => this._isConnected;


    updateNetwork = (network: scryptlib.bsv.Networks.Network): void => {
        this._network = network;
        this.emit(ProviderEvent.NetworkChange, network);
    }

    getNetwork = (): scryptlib.bsv.Networks.Network => this._network;


   protected _ready = async (): Promise<void> => {
        if (!this.isConnected()) {
            try {
                await this.connect();
            } catch (error) {
                throw error;
            }
        }
    }

    sendRawTransaction = async (rawTxHex: string): Promise<TxHash> => {
        await this._ready();
        const headers = this._getHeaders();
        const size = Math.max(1, rawTxHex.length / 2 / 1024); 
        const timeout = Math.max(10000, 1000 * size); 
        
        try {
            const res = await superagent.post(`${this.apiPrefix()}/tx/raw`)
                .timeout({
                    response: timeout,
                    deadline: 60000
                })
                .set(headers)
                .send({ txhex: rawTxHex });
                
            return res.body;
        } catch (error: any) {
            if (error.response?.text) {
                if (this.needIgnoreError(error.response.text)) {
                    return new scryptlib.bsv.Transaction(rawTxHex).id;
                }
                throw new Error(`GNProvider ERROR: ${this.friendlyBIP22RejectionMsg(error.response.text)}`);
            }
            throw new Error(`GNProvider ERROR: ${error.message}`);
        }
    }

    sendTransaction = async (signedTx: scryptlib.bsv.Transaction): Promise<string> => {
    try {
        const txHex = signedTx.serialize({ disableIsFullySigned: true });
        return await this.sendRawTransaction(txHex);
    } catch (error) {
        let errorMessage = "Unknown error occurred";
        
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === "string") {
            errorMessage = error;
        } else if (error && typeof error === "object" && "message" in error) {
            errorMessage = String(error.message);
        } else {
            errorMessage = JSON.stringify(error);
        }
        
        throw new Error(`GNProvider ERROR: failed to send transaction: ${errorMessage}`);
    }
}

    listUnspent = async (address: AddressOption, options?: UtxoQueryOptions): Promise<UTXOWithHeight[]> => {
        await this._ready();
        const headers = this._getHeaders();
        
        const res = await superagent.get(`${this.apiPrefix()}/address/${address}/unspent`)
            .set(headers);
            
        return res.body.map((item: any) => ({
            txId: item.tx_hash,
            outputIndex: item.tx_pos,
            satoshis: item.value,
            script: scryptlib.bsv.Script.buildPublicKeyHashOut(address).toHex(),
            height: item.height
        }));
        
        //return options ? filterUTXO(utxos, options) : utxos;
    }

    getBalance = async (address: AddressOption): Promise<{ confirmed: number; unconfirmed: number }> => {
        try {
            const headers = this._getHeaders();
            const res = await superagent.get(`${this.apiPrefix()}/address/${address}/balance`)
                .set(headers);
                
            return {
                confirmed: res.body.confirmed || 0,
                unconfirmed: res.body.unconfirmed || 0
            };
        } catch (error) {
            // Fallback a listUnspent
            const utxos = await this.listUnspent(address);
            return {
                confirmed: utxos.reduce((acc, utxo) => acc + utxo.satoshis, 0),
                unconfirmed: 0
            };
        }
    }

    getTransaction = async (txHash: string): Promise<TransactionResponse> => {   
        await this._ready();
        const headers = this._getHeaders();
        
        try {
            const res = await superagent.get(`${this.apiPrefix()}/tx/${txHash}/hex`)
                .set(headers);
                
            if (res.ok) {
                return new scryptlib.bsv.Transaction(res.text);
            }
            throw new Error(`Transaction not found: ${txHash}`);
        } catch (error: any) {
            throw new Error(`Error fetching transaction: ${error.message}`);
        }
    }

    private needIgnoreError = (inMsg: string): boolean => {
        if (inMsg.includes('Transaction already in the mempool')) return true;
        if (inMsg.includes('txn-already-known')) return true;
        return false;
    }


    private friendlyBIP22RejectionMsg = (inMsg: string): string => {
        const messages: Record<string, string> = {
            'bad-txns-vin-empty': 'Transaction is missing inputs.',
            'bad-txns-vout-empty': 'Transaction is missing outputs.',
            'bad-txns-oversize': 'Transaction is too large.',
            'bad-txns-vout-negative': 'Transaction output value is negative.',
            'bad-txns-vout-toolarge': 'Transaction output value is too large.',
            'bad-txns-txouttotal-toolarge': 'Transaction total output value is too large.',
            'bad-txns-prevout-null': 'Transaction inputs previous TX reference is null.',
            'bad-txns-inputs-duplicate': 'Transaction contains duplicate inputs.',
            'bad-txns-inputs-too-large': 'Transaction inputs too large.',
            'bad-txns-fee-negative': 'Transaction network fee is negative.',
            'bad-txns-fee-outofrange': 'Transaction network fee is out of range.',
            'mandatory-script-verify-flag-failed': 'Script evaluation failed.'
        };

        for (const [key, msg] of Object.entries(messages)) {
            if (inMsg.includes(key)) return msg;
        }
        return inMsg;
    }
}