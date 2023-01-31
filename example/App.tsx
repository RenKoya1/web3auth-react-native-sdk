import Web3Auth, { LOGIN_PROVIDER, OPENLOGIN_NETWORK, State } from "@web3auth/react-native-sdk";
import { Buffer } from "buffer";
import Constants, { AppOwnership } from "expo-constants";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

global.Buffer = global.Buffer || Buffer;

const scheme = "web3authexposample";

const resolvedRedirectUrl =
  Constants.appOwnership === AppOwnership.Expo || Constants.appOwnership === AppOwnership.Guest
    ? Linking.createURL("web3auth", {})
    : Linking.createURL("web3auth", { scheme });

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default function App() {
  const [key, setKey] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [userInfo, setUserInfo] = useState<State>(null);
  const login = async () => {
    try {
      const web3auth = new Web3Auth(WebBrowser, {
        clientId: "BA0mVyeHATikwuXVhXWCNjAxHthlw0w84mUhLuxlC4KZKjvmBsbdbmEWTizJ26YzrbKSWbOZbtGYdVDm0ESuYSg",
        network: OPENLOGIN_NETWORK.TESTNET,
      });
      const state = await web3auth.login({
        redirectUrl: resolvedRedirectUrl,
        loginProvider: LOGIN_PROVIDER.GOOGLE,
      });
      setKey(state.privKey || "no key");
      setUserInfo(state);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      setErrorMsg(String(e));
    }
  };
  return (
    <View style={styles.container}>
      {key !== "" ? <Text>Key: {key}</Text> : null}
      {userInfo !== null ? <Text>UserInfo: {JSON.stringify(userInfo)}</Text> : null}
      {errorMsg !== "" ? <Text>Error: {errorMsg}</Text> : null}
      <Text>Linking URL: {resolvedRedirectUrl}</Text>
      <Button title="Login with Web3Auth" onPress={login} />
      <StatusBar style="auto" />
    </View>
  );
}
