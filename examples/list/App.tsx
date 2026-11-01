import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from '@weifxn/react-native-ink';

interface Package {
  id: string;
  name: string;
  downloads: number;
}

export const PACKAGES: Package[] = Array.from({ length: 40 }, (_, index) => ({
  id: String(index),
  name: `package-${String(index + 1).padStart(2, '0')}`,
  downloads: Math.round(1_000_000 / (index + 1)),
}));

/** A scrollable, selectable list: Tab focuses rows (the list scrolls along), Enter selects. */
export function App({ height = 10 }: { height?: number }) {
  const [selected, setSelected] = useState<Package | null>(null);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Popular packages</Text>
      <FlatList
        style={[styles.list, { height }]}
        data={PACKAGES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelected(item)}>
            {({ focused }) => (
              <View style={[styles.row, focused && styles.focused]}>
                <Text>{item.name}</Text>
                <Text style={styles.downloads}>{item.downloads.toLocaleString('en-US')}</Text>
              </View>
            )}
          </Pressable>
        )}
      />
      <Text style={styles.status}>
        {selected ? `Selected ${selected.name}` : 'Tab to move · Enter to select'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: 40 },
  title: { fontWeight: 'bold', marginBottom: 1 },
  list: { borderWidth: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 1 },
  focused: { backgroundColor: 'blue' },
  downloads: { color: 'gray' },
  status: { color: 'cyan', marginTop: 1 },
});
