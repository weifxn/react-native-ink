import { useEffect, useState } from 'react';
import { BackHandler, Text, View } from '@weifxn/react-native-ink';

/** Counts to `until`, then exits. */
export function App({ until = 10, interval = 100 }: { until?: number; interval?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (count >= until) {
      BackHandler.exitApp();
      return;
    }
    const timer = setTimeout(() => setCount((value) => value + 1), interval);
    return () => clearTimeout(timer);
  }, [count, until, interval]);

  return (
    <View style={{ padding: 1 }}>
      <Text style={{ color: count >= until ? 'green' : 'yellow' }}>
        {count} {count === 1 ? 'test' : 'tests'} passed
      </Text>
    </View>
  );
}
