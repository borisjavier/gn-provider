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
const events_1 = require("events");
const scryptlib = __importStar(require("scryptlib"));
const abstract_provider_1 = require("scrypt-ts/dist/bsv/abstract-provider");
const superagent = __importStar(require("superagent"));
const utils_1 = require("scrypt-ts/dist/bsv/utils");
var ProviderEvent;
(function (ProviderEvent) {
    ProviderEvent["Connected"] = "connected";
    ProviderEvent["NetworkChange"] = "networkChange";
})(ProviderEvent || (ProviderEvent = {}));
/*export type UTXOWithHeight = UTXO & {
    height: number;
};*/
class GNProvider extends abstract_provider_1.Provider {
    constructor(network, wocApiKey = '', gpApiKey = '') {
        super();
        this._isConnected = false;
        this._getHeaders = () => {
            return Object.assign({ 'Content-Type': 'application/json' }, (this._wocApiKey ? { 'woc-api-key': this._wocApiKey } : {}));
        };
        this.connect = () => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const headers = this._getHeaders();
                const res = yield superagent.get(`${this.apiPrefix()}/woc`)
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
        this.getFeePerKb = () => __awaiter(this, void 0, void 0, function* () {
            yield this._ready();
            const headers = this._getHeaders();
            try {
                // Paso 1: Obtener la información de la cadena para obtener la altura actual
                const chainInfoRes = yield superagent.get(`${this.apiPrefix()}/chain/info`)
                    .set(headers);
                const currentHeight = chainInfoRes.body.blocks;
                // Paso 2: Obtener las estadísticas del bloque actual
                const blockStatsRes = yield superagent.get(`${this.apiPrefix()}/block/height/${currentHeight}/stats`)
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
            }
            catch (error) {
                console.warn('Fee estimation from block stats failed, using fallback');
                return 500; // Fallback a 500 sat/kb
            }
        });
        this.isConnected = () => this._isConnected;
        this.updateNetwork = (network) => {
            this._network = network;
            this.emit(ProviderEvent.NetworkChange, network);
        };
        this.getNetwork = () => this._network;
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
        /*sendRawTransaction = async (rawTxHex: string): Promise<TxHash> => {
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
        }*/
        /*sendRawTransaction = async (rawTxHex: string): Promise<TxHash> => {
            await this._ready();
            const headers = this._getHeaders();
            const size = Math.max(1, rawTxHex.length / 2 / 1024);
            const timeout = Math.max(15000, 1000 * size);
    
            // 1. Preparar el envío a WhatsOnChain (tu implementación actual)
            const wocRequest = superagent.post(`${this.apiPrefix()}/tx/raw`)
                .timeout({
                    response: timeout,
                    deadline: 60000
                })
                .set(headers)
                .send({ txhex: rawTxHex });
    
            // 2. Preparar el envío a GorillaPool (basado en el código de referencia)
            const gpRequest = superagent.post(this._mapiURL + 'tx')
                .timeout({
                    response: timeout,
                    deadline: 60000,
                })
                .set('Content-Type', 'application/octet-stream')
                .send(Buffer.from(rawTxHex, 'hex'));
            
            if (this._gorillaPoolApiKey) {
                gpRequest.set('Authorization', `Bearer ${this._gorillaPoolApiKey}`);
            }
    
            // 3. Ejecutar ambos envíos en paralelo y obtener el primer resultado exitoso
            try {
                const responses = await Promise.allSettled([
                    wocRequest.then(res => ({ source: 'WhatsOnChain', result: res.body })),
                    gpRequest.then(res => {
                        const payload = JSON.parse(res.body.payload);
                        if (payload.returnResult === 'success') {
                            return { source: 'GorillaPool', result: payload.txid };
                        } else {
                            throw new Error(`GorillaPool: ${payload.resultDescription}`);
                        }
                    })
                ]);
    
                // Buscar el primer resultado exitoso
                for (const response of responses) {
                    if (response.status === 'fulfilled') {
                        console.log(`✅ Transacción aceptada por: ${response.value.source}`);
                        return response.value.result; // Retorna el TXID
                    }
                }
    
                // Si ambos fallan, lanza el primer error
                const firstRejection = responses.find(r => r.status === 'rejected');
                if (firstRejection) {
                    throw new Error(firstRejection.reason.message || firstRejection.reason);
                }
                
                throw new Error('Todos los intentos de envío fallaron');
    
            } catch (error: any) {
                if (error.response?.text) {
                    if (this.needIgnoreError(error.response.text)) {
                        return new scryptlib.bsv.Transaction(rawTxHex).id;
                    }
                    throw new Error(`GNProvider ERROR: ${this.friendlyBIP22RejectionMsg(error.response.text)}`);
                }
                throw new Error(`GNProvider ERROR: ${error.message}`);
            }
        }*/
        this.sendRawTransaction = (rawTxHex) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            yield this._ready();
            const headers = this._getHeaders();
            const size = Math.max(1, rawTxHex.length / 2 / 1024);
            const timeout = Math.max(10000, 1000 * size);
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
        /*sendRawTransaction = async (rawTxHex: string): Promise<TxHash> => {
            await this._ready();
            const headers = this._getHeaders();
            const size = Math.max(1, rawTxHex.length / 2 / 1024);
            const timeout = Math.max(15000, 1000 * size);
    
            const wocRequest = superagent.post(`${this.apiPrefix()}/tx/raw`)
                .timeout({ response: timeout, deadline: 60000 })
                .set(headers)
                .send({ txhex: rawTxHex });
    
            const gpRequest = superagent.post(this._mapiURL + 'tx')
                .timeout({ response: timeout, deadline: 60000 })
                .set('Content-Type', 'application/octet-stream')
                .send(Buffer.from(rawTxHex, 'hex'));
            
            if (this._gorillaPoolApiKey) {
                gpRequest.set('Authorization', `Bearer ${this._gorillaPoolApiKey}`);
            }
    
            try {
                const responses = await Promise.allSettled([
                    wocRequest.then(res => ({ source: 'WhatsOnChain', result: res.body })),
                    gpRequest.then(res => {
                        try {
                            if (!res.body?.payload) {
                                throw new Error('Respuesta inválida de GorillaPool: falta payload');
                            }
                            
                            const payload = JSON.parse(res.body.payload);
                            
                            if (payload.returnResult === 'success') {
                                return { source: 'GorillaPool', result: payload.txid };
                            } else {
                                throw new Error(`GorillaPool [${payload.returnResult || 'unknown'}]: ${payload.resultDescription || 'Sin descripción'}`);
                            }
                        } catch (parseError) {
                            const message = parseError instanceof Error ? parseError.message : String(parseError);
                            throw new Error(`GorillaPool: Error parsing response - ${message}`);
                        }
                    })
                ]);
    
                for (const response of responses) {
                    if (response.status === 'fulfilled') {
                        console.log(`✅ Transacción aceptada por: ${response.value.source}`);
                        return response.value.result;
                    }
                }
    
                const firstRejection = responses.find(r => r.status === 'rejected');
                if (firstRejection) {
                    throw new Error(firstRejection.reason.message || firstRejection.reason);
                }
                
                throw new Error('Todos los intentos de envío fallaron');
    
            } catch (error: any) {
                if (error.response?.text) {
                    if (this.needIgnoreError(error.response.text)) {
                        return new scryptlib.bsv.Transaction(rawTxHex).id;
                    }
                    throw new Error(`GNProvider ERROR: ${this.friendlyBIP22RejectionMsg(error.response.text)}`);
                }
                throw new Error(`GNProvider ERROR: ${error.message}`);
            }
        }*/
        this.sendTransaction = (signedTx) => __awaiter(this, void 0, void 0, function* () {
            try {
                const txHex = signedTx.serialize({ disableIsFullySigned: true });
                return yield this.sendRawTransaction(txHex);
            }
            catch (error) {
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
        this.listUnspent = (address, options) => __awaiter(this, void 0, void 0, function* () {
            yield this._ready();
            const headers = this._getHeaders();
            try {
                const res = yield superagent.get(`${this.apiPrefix()}/address/${address}/unspent`)
                    .set(headers);
                const utxos = res.body.map((item) => ({
                    txId: item.tx_hash,
                    outputIndex: item.tx_pos,
                    satoshis: item.value,
                    script: scryptlib.bsv.Script.buildPublicKeyHashOut(address).toHex(), //item.script, // ✅ CORRECTO - script real de la blockchain //
                }));
                return options ? (0, utils_1.filterUTXO)(utxos, options) : utxos;
            }
            catch (error) {
                throw new Error(`Failed to list UTXOs for address ${address}: ${error.message}`);
            }
        });
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
        this.getTransaction = (txHash) => __awaiter(this, void 0, void 0, function* () {
            var _a;
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
                if (((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 404) {
                    throw new Error(`Transaction not found: ${txHash}`);
                }
                throw new Error(`Error fetching transaction ${txHash}: ${error.message}`);
            }
        });
        this.needIgnoreError = (inMsg) => {
            if (inMsg.includes('Transaction already in the mempool'))
                return true;
            if (inMsg.includes('txn-already-known'))
                return true;
            if (inMsg.includes('Missing inputs'))
                return true;
            return false;
        };
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
                'mandatory-script-verify-flag-failed': 'Script evaluation failed.',
                'Missing inputs': 'Transaction inputs are missing or already spent.'
            };
            for (const [key, msg] of Object.entries(messages)) {
                if (inMsg.includes(key))
                    return msg;
            }
            return inMsg;
        };
        this._network = network;
        this._wocApiKey = wocApiKey;
        this._gorillaPoolApiKey = gpApiKey;
        this._isConnected = false;
        this._mapiURL = network == scryptlib.bsv.Networks.mainnet ?
            'https://mapi.gorillapool.io/mapi/' :
            'https://testnet-mapi.gorillapool.io/mapi/';
        this.apiPrefix = () => {
            const networkStr = this._network.name === scryptlib.bsv.Networks.mainnet.name ? 'main' : 'test';
            return `https://api.whatsonchain.com/v1/bsv/${networkStr}`;
        };
        Object.setPrototypeOf(this, events_1.EventEmitter.prototype);
        this.connect().catch(console.error);
    }
}
exports.GNProvider = GNProvider;
