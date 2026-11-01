import { StyleSheet, Text, View } from '@weifxn/react-native-ink';

export function App({ name = 'world' }: { name?: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Hello, {name}!</Text>
      <Text style={styles.body}>
        React Native components, rendered in your terminal with <Text style={styles.ink}>Ink</Text>.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 4,
    borderColor: '#00aaff',
    paddingHorizontal: 2,
    paddingVertical: 1,
    maxWidth: 60,
  },
  title: { color: 'green', fontWeight: 'bold' },
  body: { color: 'gray' },
  ink: { color: 'magenta', fontStyle: 'italic' },
});
