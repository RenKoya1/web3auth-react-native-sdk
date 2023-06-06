import "./global";
import Web3Auth, { LOGIN_PROVIDER, OPENLOGIN_NETWORK } from "@web3auth/react-native-sdk";
import Constants, { AppOwnership } from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import React, { useState, useEffect } from "react";
import { Button, Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";

import RPC from "./ethersRPC"; // for using ethers.js

const resolvedRedirectUrl =
  Constants.appOwnership == AppOwnership.Expo || Constants.appOwnership == AppOwnership.Guest
    ? Linking.createURL("web3auth", {})
    : Linking.createURL("web3auth", { scheme: "com.anonymous.rnexpoexample" });

const clientId = "BILxiaDYbvlcwNdeJsyXEUDieKdYPIHfSdvEabzidwYZ3zaGsEN6noiM5u8f-5wuIksJcOn-Ga1LWNqen1eUZbw";

export default function App() {
  const [key, setKey] = useState("");
  const [userInfo, setUserInfo] = useState("");
  const [console, setConsole] = useState("");
  const [web3auth, setWeb3Auth] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const auth = new Web3Auth(WebBrowser, SecureStore, {
          clientId,
          network: OPENLOGIN_NETWORK.CYAN, // or other networks
        });
        setWeb3Auth(auth);
        await auth.init();
        if (auth?.privKey) {
          uiConsole("Re logged in");
          setUserInfo(auth.userInfo());
          setKey(auth.privKey);
          window.console.log(auth.privKey);
        }
      } catch (e) {
        throw e;
      }
    };
    init();
  }, []);

  const login = async () => {
    try {
      setConsole("Logging in");
      await web3auth.login({
        loginProvider: LOGIN_PROVIDER.GOOGLE,
        redirectUrl: resolvedRedirectUrl,
        mfaLevel: "none",
        curve: "secp256k1",
      });

      if (web3auth.privKey) {
        setUserInfo(web3auth.userInfo());
        setKey(web3auth.privKey);
        uiConsole("Logged In");
      }
    } catch (e) {
      uiConsole(e);
      throw e;
    }
  };

  const logout = async () => {
    if (!web3auth) {
      setConsole("Web3auth not initialized");
      return;
    }

    setConsole("Logging out");
    await web3auth.logout();

    if (!web3auth.privKey) {
      setUserInfo(undefined);
      setKey("");
      uiConsole("Logged out");
    }
  };

  const getChainId = async () => {
    setConsole("Getting chain id");
    const networkDetails = await RPC.getChainId();
    uiConsole(networkDetails);
  };

  const getAccounts = async () => {
    setConsole("Getting account");
    const address = await RPC.getAccounts(key);
    uiConsole(address);
  };
  const getBalance = async () => {
    setConsole("Fetching balance");
    const balance = await RPC.getBalance(key);
    uiConsole(balance);
  };
  const sendTransaction = async () => {
    setConsole("Sending transaction");
    const tx = await RPC.sendTransaction(key);
    uiConsole(tx);
  };
  const signMessage = async () => {
    setConsole("Signing message");
    const message = await RPC.signMessage(key);
    uiConsole(message);
  };

  const uiConsole = (...args) => {
    setConsole(`${JSON.stringify(args || {}, null, 2)}\n\n\n\n${console}`);
  };

  const loggedInView = (
    <View style={styles.buttonArea}>
      <Button title="Get User Info" onPress={() => uiConsole(userInfo)} />
      <Button title="Get Chain ID" onPress={getChainId} />
      <Button title="Get Accounts" onPress={getAccounts} />
      <Button title="Get Balance" onPress={getBalance} />
      <Button title="Send Transaction" onPress={sendTransaction} />
      <Button title="Sign Message" onPress={signMessage} />
      <Button title="Get Private Key" onPress={() => uiConsole(key)} />
      <Button title="Log Out" onPress={logout} />
    </View>
  );

  const unloggedInView = (
    <View style={styles.buttonArea}>
      <Button title="Login with Web3Auth" onPress={login} />
    </View>
  );

  return (
    <View style={styles.container}>
      {key ? loggedInView : unloggedInView}
      <View style={styles.consoleArea}>
        <Text style={styles.consoleText}>Console:</Text>
        <ScrollView style={styles.console}>
          <Text>{console}</Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 50,
    paddingBottom: 30,
  },
  consoleArea: {
    margin: 20,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  console: {
    flex: 1,
    backgroundColor: "#CCCCCC",
    color: "#ffffff",
    padding: 10,
    width: Dimensions.get("window").width - 60,
  },
  consoleText: {
    padding: 10,
  },
  buttonArea: {
    flex: 2,
    alignItems: "center",
    justifyContent: "space-around",
    paddingBottom: 30,
  },
});
