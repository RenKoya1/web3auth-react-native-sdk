import { getPublic, sign } from "@toruslabs/eccrypto";
import { decryptData, encryptData, keccak256 } from "@toruslabs/metadata-helpers";
import base64url from "base64url";
import log from "loglevel";
import { URL } from "react-native-url-polyfill";

import { ShareMetadata } from "./api/model";
import { Web3AuthApi } from "./api/Web3AuthApi";
import KeyStore from "./session/KeyStore";
import { EncryptedStorage } from "./types/IEncryptedStorage";
import { SecureStore } from "./types/IExpoSecureStore";
import { IWebBrowser } from "./types/IWebBrowser";
import { SdkInitParams, SdkLoginParams, SdkLogoutParams } from "./types/sdk";
import { State } from "./types/State";

(process as any).browser = true;

class Web3Auth {
  initParams: SdkInitParams;

  webBrowser: IWebBrowser;

  keyStore: KeyStore;

  constructor(webBrowser: IWebBrowser, storage: SecureStore | EncryptedStorage, initParams: SdkInitParams) {
    this.initParams = initParams;
    if (!this.initParams.sdkUrl) {
      this.initParams.sdkUrl = "https://sdk.openlogin.com";
    }
    this.webBrowser = webBrowser;
    this.keyStore = new KeyStore(storage);
  }

  async init(): Promise<State> {
    return this.authorizeSession();
  }

  async login(options: SdkLoginParams): Promise<State> {
    // check for share
    if (this.initParams.loginConfig) {
      const loginConfigItem = Object.values(this.initParams.loginConfig)[0];
      if (loginConfigItem) {
        const share = await this.keyStore.get(loginConfigItem.verifier);
        if (share) {
          options.dappShare = share;
        }
      }
    }

    const result = await this.request("login", options.redirectUrl, options);
    if (result.type !== "success" || !result.url) {
      log.error(`[Web3Auth] login flow failed with error type ${result.type}`);
      throw new Error(`login flow failed with error type ${result.type}`);
    }

    const fragment = new URL(result.url).hash;
    const decodedPayload = base64url.decode(fragment);
    const state = JSON.parse(decodedPayload) as State;

    await this.keyStore.set("sessionId", state?.sessionId);

    if (state.userInfo?.dappShare.length > 0) {
      this.keyStore.set(state.userInfo?.verifier, state.userInfo?.dappShare);
    }

    if (this.initParams.useCoreKitKey && state.coreKitKey) {
      state.privKey = state.coreKitKey;
      // TODO: to confirm should we delete this or not.
      delete state.coreKitKey;
    }

    return state;
  }

  async logout(options: SdkLogoutParams): Promise<void> {
    this.sessionTimeout();
    const result = await this.request("logout", options.redirectUrl, options);
    if (result.type !== "success" || !result.url) {
      log.error(`[Web3Auth] logout flow failed with error type ${result.type}`);
      throw new Error(`logout flow failed with error type ${result.type}`);
    }
  }

  async authorizeSession(): Promise<State> {
    const sessionId = await this.keyStore.get("sessionId");
    if (sessionId && sessionId.length > 0) {
      const pubKey = getPublic(Buffer.from(sessionId, "hex")).toString("hex");
      const response = await Web3AuthApi.authorizeSession(pubKey);

      let web3AuthResponse = await decryptData<any>(sessionId, response.message);
      web3AuthResponse.userInfo = web3AuthResponse.store;
      delete web3AuthResponse.store;

      if (!web3AuthResponse.error) {
        web3AuthResponse = web3AuthResponse as State;
        if (this.initParams.useCoreKitKey) {
          web3AuthResponse.privKey = web3AuthResponse.tKey ? web3AuthResponse.tKey : web3AuthResponse.privKey;
        }
        if (web3AuthResponse.privKey && web3AuthResponse.privKey.trim("0").length > 0) {
          return Promise.resolve(web3AuthResponse);
        }
      } else {
        throw new Error(`session recovery failed with error ${web3AuthResponse.error}`);
      }
    }
  }

  async sessionTimeout() {
    const sessionId = await this.keyStore.get("sessionId");
    if (sessionId && sessionId.length > 0) {
      const pubKey = getPublic(Buffer.from(sessionId, "hex")).toString("hex");
      const response = await Web3AuthApi.authorizeSession(pubKey);
      if (!response.success) {
        return;
      }
      const shareMetadata = JSON.parse(response.message) as ShareMetadata;
      const encryptedData = await encryptData(sessionId, "");
      const encryptedMetadata: ShareMetadata = {
        ...shareMetadata,
        ciphertext: encryptedData,
      };
      const jsonData = JSON.stringify(encryptedMetadata);
      const hashData = keccak256(jsonData);
      try {
        await Web3AuthApi.logout({
          key: getPublic(Buffer.from(sessionId, "hex")).toString("hex"),
          data: jsonData,
          signature: (await sign(Buffer.from(sessionId, "hex"), hashData)).toString("hex"),
          timeout: 1,
        });

        this.keyStore.remove("sessionId");

        if (this.initParams.loginConfig) {
          const loginConfigItem = Object.values(this.initParams.loginConfig)[0];
          if (loginConfigItem) {
            this.keyStore.remove(loginConfigItem.verifier);
          }
        }
      } catch (ex) {
        log.error(ex);
      }
    }
  }

  private async request(path: string, redirectUrl: string, params: Record<string, unknown> = {}) {
    const initParams = {
      ...this.initParams,
      clientId: this.initParams.clientId,
      network: this.initParams.network,
      ...(!!this.initParams.redirectUrl && {
        redirectUrl: this.initParams.redirectUrl,
      }),
    };

    const mergedParams = {
      init: initParams,
      params: {
        ...params,
        ...(!params.redirectUrl && { redirectUrl }),
      },
    };

    log.debug(`[Web3Auth] params passed to Web3Auth: ${mergedParams}`);

    const hash = base64url.encode(JSON.stringify(mergedParams));

    const url = new URL(this.initParams.sdkUrl);
    url.pathname = `${url.pathname}${path}`;
    url.hash = hash;

    log.info(`[Web3Auth] opening login screen in browser at ${url.href}, will redirect to ${redirectUrl}`);

    return this.webBrowser.openAuthSessionAsync(url.href, redirectUrl);
  }
}

export default Web3Auth;
