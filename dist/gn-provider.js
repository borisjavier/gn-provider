"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GNProvider = void 0;
// Agrega esto al inicio del archivo
// @ts-ignore
const events_1 = require("events");
const scryptlib = __importStar(require("scryptlib"));
const abstract_provider_1 = require("scrypt-ts/dist/bsv/abstract-provider");
const superagent = __importStar(require("superagent"));
const utils_1 = require("scrypt-ts/dist/bsv/utils");
//import { EventEmitter } from 'events';
var ProviderEvent;
(function (ProviderEvent) {
    ProviderEvent["Connected"] = "connected";
    ProviderEvent["NetworkChange"] = "networkChange";
})(ProviderEvent || (ProviderEvent = {}));
class GNProvider extends abstract_provider_1.Provider {
    constructor(network, apiKey = '') {
        super();
        this._isConnected = false;
        this._getHeaders = () => {
            return Object.assign({ 'Content-Type': 'application/json' }, (this._apiKey ? { 'woc-api-key': this._apiKey } : {}));
        };
        /*get apiPrefix(): string {
            const networkStr = this._network.name === scryptlib.bsv.Networks.mainnet.name ? 'main' : 'test';
            return `https://api.whatsonchain.com/v1/bsv/${networkStr}`;
        }*/
        /*apiPrefix = (): string => {
             const networkStr = this._network.name === scryptlib.bsv.Networks.mainnet.name ? 'main' : 'test';
             return `https://api.whatsonchain.com/v1/bsv/${networkStr}`;
         }*/
        this.connect = () => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const headers = this._getHeaders();
                const res = yield superagent.get(`${this.apiPrefix()}/woc`) //`${this.apiPrefix}/woc`) 
                    .timeout(3000)
                    .set(headers);
                if (res.ok && res.text === "Whats On Chain") {
                    this._isConnected = true;
                    this.emit(ProviderEvent.Connected, true);
                    return this;
                }
                throw new Error(((_a = res.body) === null || _a === void 0 ? void 0 : _a.msg) || res.text);
            }
            catch (error) {
                this._isConnected = false;
                this.emit(ProviderEvent.Connected, false);
                throw new Error(`connect failed: ${error.message || "unknown error"}`);
            }
        });
        //async getFeePerKb(): Promise<number> {
        this.getFeePerKb = () => __awaiter(this, void 0, void 0, function* () {
            yield this._ready();
            const headers = this._getHeaders();
            try {
                const now = Math.floor(Date.now() / 1000);
                const from = now - 1800; // 30 minutos atrás
                const res = yield superagent.get(`${this.apiPrefix()}/miner/fees?from=${from}&to=${now}`)
                    .set(headers);
                if (res.body && Array.isArray(res.body) && res.body.length > 0) {
                    const totalFeeRate = res.body.reduce((sum, minerData) => {
                        return sum + minerData.min_fee_rate;
                    }, 0);
                    const averageFeeRate = totalFeeRate / res.body.length;
                    const feeRateWithMargin = averageFeeRate * 1.3;
                    return Math.round(feeRateWithMargin * 100) / 100;
                }
                throw new Error("No fee data available");
            }
            catch (error) {
                return 1.05; // Valor de fallback
            }
        });
        /*isConnected(): boolean {
        return this._isConnected;
    }*/
        this.isConnected = () => this._isConnected;
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
        this.updateNetwork = (network) => {
            this._network = network;
            this.emit(ProviderEvent.NetworkChange, network);
        };
        /*getNetwork(): scryptlib.bsv.Networks.Network {
            return this._network;
        }*/
        this.getNetwork = () => this._network;
        /*protected async _ready(): Promise<void> {
            if (!this.isConnected()) {
                try {
                    await this.connect();
                } catch (error) {
                    throw error;
                }
            }
        }*/
        this._ready = () => __awaiter(this, void 0, void 0, function* () {
            if (!this.isConnected()) {
                try {
                    yield this.connect();
                }
                catch (error) {
                    throw error;
                }
            }
        });
        //async sendRawTransaction(rawTxHex: string): Promise<TxHash> {
        this.sendRawTransaction = (rawTxHex) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            yield this._ready();
            const headers = this._getHeaders();
            const size = Math.max(1, rawTxHex.length / 2 / 1024); // Tamaño en KB
            const timeout = Math.max(10000, 1000 * size); // Timeout dinámico
            try {
                const res = yield superagent.post(`${this.apiPrefix()}/tx/raw`)
                    .timeout({
                    response: timeout,
                    deadline: 60000
                })
                    .set(headers)
                    .send({ txhex: rawTxHex });
                return res.body;
            }
            catch (error) {
                if ((_a = error.response) === null || _a === void 0 ? void 0 : _a.text) {
                    if (this.needIgnoreError(error.response.text)) {
                        return new scryptlib.bsv.Transaction(rawTxHex).id;
                    }
                    throw new Error(`GNProvider ERROR: ${this.friendlyBIP22RejectionMsg(error.response.text)}`);
                }
                throw new Error(`GNProvider ERROR: ${error.message}`);
            }
        });
        // Implementación correcta de sendTransaction
        this.sendTransaction = (signedTx) => __awaiter(this, void 0, void 0, function* () {
            try {
                const txHex = signedTx.serialize({ disableIsFullySigned: true });
                return yield this.sendRawTransaction(txHex);
            }
            catch (error) {
                // Manejo seguro del error unknown
                let errorMessage = "Unknown error occurred";
                if (error instanceof Error) {
                    errorMessage = error.message;
                }
                else if (typeof error === "string") {
                    errorMessage = error;
                }
                else if (error && typeof error === "object" && "message" in error) {
                    errorMessage = String(error.message);
                }
                else {
                    errorMessage = JSON.stringify(error);
                }
                throw new Error(`GNProvider ERROR: failed to send transaction: ${errorMessage}`);
            }
        });
        //async listUnspent(address: AddressOption, options?: UtxoQueryOptions): Promise<UTXO[]> {
        this.listUnspent = (address, options) => __awaiter(this, void 0, void 0, function* () {
            yield this._ready();
            const headers = this._getHeaders();
            const res = yield superagent.get(`${this.apiPrefix()}/address/${address}/unspent`)
                .set(headers);
            const utxos = res.body.map((item) => ({
                txId: item.tx_hash,
                outputIndex: item.tx_pos,
                satoshis: item.value,
                script: scryptlib.bsv.Script.buildPublicKeyHashOut(address).toHex(),
            }));
            return options ? (0, utils_1.filterUTXO)(utxos, options) : utxos;
        });
        //async getBalance(address: AddressOption): Promise<{ confirmed: number; unconfirmed: number }> {
        this.getBalance = (address) => __awaiter(this, void 0, void 0, function* () {
            try {
                const headers = this._getHeaders();
                const res = yield superagent.get(`${this.apiPrefix()}/address/${address}/balance`)
                    .set(headers);
                return {
                    confirmed: res.body.confirmed || 0,
                    unconfirmed: res.body.unconfirmed || 0
                };
            }
            catch (error) {
                // Fallback a listUnspent
                const utxos = yield this.listUnspent(address);
                return {
                    confirmed: utxos.reduce((acc, utxo) => acc + utxo.satoshis, 0),
                    unconfirmed: 0
                };
            }
        });
        //async getTransaction(txHash: string): Promise<TransactionResponse> {
        this.getTransaction = (txHash) => __awaiter(this, void 0, void 0, function* () {
            yield this._ready();
            const headers = this._getHeaders();
            try {
                const res = yield superagent.get(`${this.apiPrefix()}/tx/${txHash}/hex`)
                    .set(headers);
                if (res.ok) {
                    return new scryptlib.bsv.Transaction(res.text);
                }
                throw new Error(`Transaction not found: ${txHash}`);
            }
            catch (error) {
                throw new Error(`Error fetching transaction: ${error.message}`);
            }
        });
        /*private needIgnoreError(inMsg: string): boolean {
            if (inMsg.includes('Transaction already in the mempool')) return true;
            if (inMsg.includes('txn-already-known')) return true;
            return false;
        }*/
        this.needIgnoreError = (inMsg) => {
            if (inMsg.includes('Transaction already in the mempool'))
                return true;
            if (inMsg.includes('txn-already-known'))
                return true;
            return false;
        };
        //private friendlyBIP22RejectionMsg(inMsg: string): string {
        this.friendlyBIP22RejectionMsg = (inMsg) => {
            const messages = {
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
                if (inMsg.includes(key))
                    return msg;
            }
            return inMsg;
        };
        // Inicializa propiedades primero
        this._network = network;
        this._apiKey = apiKey;
        this._isConnected = false;
        this.apiPrefix = () => {
            const networkStr = this._network.name === scryptlib.bsv.Networks.mainnet.name ? 'main' : 'test';
            return `https://api.whatsonchain.com/v1/bsv/${networkStr}`;
        };
        // Configura EventEmitter
        Object.setPrototypeOf(this, events_1.EventEmitter.prototype);
        // Conexión directa
        this.connect().catch(console.error);
    }
}
exports.GNProvider = GNProvider;
