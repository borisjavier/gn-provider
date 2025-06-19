// Agrega esto al inicio del archivo
// @ts-ignore
import { EventEmitter } from 'events';
import * as scryptlib from 'scryptlib';
import { Provider, TransactionResponse, TxHash, UtxoQueryOptions } from 'scrypt-ts/dist/bsv/abstract-provider';
import * as superagent from 'superagent';
import { filterUTXO } from 'scrypt-ts/dist/bsv/utils';
import { AddressOption, UTXO } from 'scrypt-ts/dist/bsv/types';
//import { EventEmitter } from 'events';

enum ProviderEvent {
    Connected = "connected",
    NetworkChange = "networkChange"
}

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

    /*get apiPrefix(): string {
        const networkStr = this._network.name === scryptlib.bsv.Networks.mainnet.name ? 'main' : 'test';
        return `https://api.whatsonchain.com/v1/bsv/${networkStr}`;
    }*/
   /*apiPrefix = (): string => {
        const networkStr = this._network.name === scryptlib.bsv.Networks.mainnet.name ? 'main' : 'test';
        return `https://api.whatsonchain.com/v1/bsv/${networkStr}`;
    }*/

   connect = async (): Promise<this> => {
        try {
            const headers = this._getHeaders();
            const res = await superagent.get(`${this.apiPrefix()}/woc`)//`${this.apiPrefix}/woc`) 
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

        //async getFeePerKb(): Promise<number> {
    getFeePerKb = async (): Promise<number> => {
        await this._ready();
        const headers = this._getHeaders();
        
        try {
            const now = Math.floor(Date.now() / 1000);
            const from = now - 1800; // 30 minutos atrás
            const res = await superagent.get(`${this.apiPrefix()}/miner/fees?from=${from}&to=${now}`)
                .set(headers);
                
            if (res.body && Array.isArray(res.body) && res.body.length > 0) {
                const totalFeeRate = res.body.reduce((sum: number, minerData: any) => {
                    return sum + minerData.min_fee_rate;
                }, 0);
                
                const averageFeeRate = totalFeeRate / res.body.length;
                const feeRateWithMargin = averageFeeRate * 1.3;
                
                return Math.round(feeRateWithMargin * 100) / 100;
            }
            throw new Error("No fee data available");
        } catch (error) {
            return 1.05; // Valor de fallback
        }
    }

   constructor(network: scryptlib.bsv.Networks.Network, apiKey = '') {
        super();
        
        // Inicializa propiedades primero
        this._network = network;
        this._apiKey = apiKey;
        this._isConnected = false;

        this.apiPrefix = () => {
            const networkStr = this._network.name === scryptlib.bsv.Networks.mainnet.name ? 'main' : 'test';
            return `https://api.whatsonchain.com/v1/bsv/${networkStr}`;
        };
        
        // Configura EventEmitter
        Object.setPrototypeOf(this, EventEmitter.prototype);
        
        // Conexión directa
        this.connect().catch(console.error);
    }

        /*isConnected(): boolean {
        return this._isConnected;
    }*/
   isConnected = (): boolean => this._isConnected;

    /*private _getHeaders() {
        return {
            'Content-Type': 'application/json',
            ...(this._apiKey ? { 'woc-api-key': this._apiKey } : {})
        };
    }*/

    /*updateNetwork(network: scryptlib.bsv.Networks.Network): void {
        this._network = network;
        this.emit(ProviderEvent.NetworkChange, network);
    }*/

    updateNetwork = (network: scryptlib.bsv.Networks.Network): void => {
        this._network = network;
        this.emit(ProviderEvent.NetworkChange, network);
    }

    /*getNetwork(): scryptlib.bsv.Networks.Network {
        return this._network;
    }*/
    getNetwork = (): scryptlib.bsv.Networks.Network => this._network;

    /*protected async _ready(): Promise<void> {
        if (!this.isConnected()) {
            try {
                await this.connect();
            } catch (error) {
                throw error;
            }
        }
    }*/
   protected _ready = async (): Promise<void> => {
        if (!this.isConnected()) {
            try {
                await this.connect();
            } catch (error) {
                throw error;
            }
        }
    }

    //async sendRawTransaction(rawTxHex: string): Promise<TxHash> {
    sendRawTransaction = async (rawTxHex: string): Promise<TxHash> => {
        await this._ready();
        const headers = this._getHeaders();
        const size = Math.max(1, rawTxHex.length / 2 / 1024); // Tamaño en KB
        const timeout = Math.max(10000, 1000 * size); // Timeout dinámico
        
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

// Implementación correcta de sendTransaction
    sendTransaction = async (signedTx: scryptlib.bsv.Transaction): Promise<string> => {
    try {
        const txHex = signedTx.serialize({ disableIsFullySigned: true });
        return await this.sendRawTransaction(txHex);
    } catch (error) {
        // Manejo seguro del error unknown
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

    //async listUnspent(address: AddressOption, options?: UtxoQueryOptions): Promise<UTXO[]> {
    listUnspent = async (address: AddressOption, options?: UtxoQueryOptions): Promise<UTXO[]> => {
        await this._ready();
        const headers = this._getHeaders();
        
        const res = await superagent.get(`${this.apiPrefix()}/address/${address}/unspent`)
            .set(headers);
            
        const utxos = res.body.map((item: any) => ({
            txId: item.tx_hash,
            outputIndex: item.tx_pos,
            satoshis: item.value,
            script: scryptlib.bsv.Script.buildPublicKeyHashOut(address).toHex(),
        }));
        
        return options ? filterUTXO(utxos, options) : utxos;
    }

    
    //async getBalance(address: AddressOption): Promise<{ confirmed: number; unconfirmed: number }> {
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


    //async getTransaction(txHash: string): Promise<TransactionResponse> {
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

    private needIgnoreError(inMsg: string): boolean {
        if (inMsg.includes('Transaction already in the mempool')) return true;
        if (inMsg.includes('txn-already-known')) return true;
        return false;
    }

    private friendlyBIP22RejectionMsg(inMsg: string): string {
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