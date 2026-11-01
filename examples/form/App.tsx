import { useState } from 'react';
import {
  Button,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useApp,
} from '@weifxn/react-native-ink';

/** A sign-up form: Tab moves between fields, Enter submits, Esc leaves a field. */
export function App() {
  const { exit } = useApp();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [newsletter, setNewsletter] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <View style={styles.form}>
        <Text style={styles.success}>✔ Welcome, {name || 'anonymous'}!</Text>
        <Text>Newsletter: {newsletter ? 'yes' : 'no'}</Text>
        <Button title="Quit" autoFocus onPress={() => exit()} />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.title}>Create an account</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          autoFocus
          value={name}
          onChangeText={setName}
          placeholder="Ada Lovelace"
          style={styles.input}
          submitBehavior="submit"
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          submitBehavior="submit"
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Newsletter</Text>
        <Switch value={newsletter} onValueChange={setNewsletter} />
      </View>
      <Button
        title="Sign up"
        color="green"
        disabled={!name || password.length < 4}
        onPress={() => setSubmitted(true)}
      />
      <Text style={styles.hint}>Tab: next field · Space: toggle · Enter: press · Ctrl+C: quit</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 1, padding: 1, borderWidth: 1, borderRadius: 2, width: 50 },
  title: { fontWeight: 'bold' },
  row: { flexDirection: 'row', gap: 1 },
  label: { width: 11 },
  input: { flex: 1, borderBottomWidth: 1 },
  success: { color: 'green', fontWeight: 'bold' },
  hint: { color: 'gray' },
});
