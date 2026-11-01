// This file only imports from 'react-native': the same component runs in a React Native app and,
// with 'react-native' aliased to '@weifxn/react-native-ink', in the terminal.
import { Platform, StyleSheet, Text, View } from 'react-native';

export function Greeting({ name }: { name: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Hi {name}, this component runs on <Text style={styles.platform}>{Platform.OS}</Text>.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 1, borderWidth: 1, borderColor: 'gray', alignSelf: 'flex-start' },
  text: { color: Platform.select({ cli: 'cyan', default: '#333333' }) },
  platform: { fontWeight: 'bold' },
});
