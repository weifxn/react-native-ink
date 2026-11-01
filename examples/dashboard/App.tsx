import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  View,
  useAnimatedValue,
  useWindowDimensions,
} from '@weifxn/react-native-ink';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ProgressBar({ progress }: { progress: Animated.Value }) {
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width }]} />
    </View>
  );
}

/** A live dashboard: flex layout, borders, a spinner and an animated progress bar. */
export function App({ autoStart = true }: { autoStart?: boolean }) {
  const { width } = useWindowDimensions();
  const progress = useAnimatedValue(0);
  const [done, setDone] = useState(false);
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    if (!autoStart) return;
    Animated.timing(progress, { toValue: 1, duration: 3000, useNativeDriver: false }).start(() =>
      setDone(true),
    );
    const clock = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(clock);
  }, [autoStart, progress]);

  return (
    <View style={[styles.screen, { width: Math.min(width, 72) }]}>
      <View style={styles.header}>
        <Text style={styles.headerText}>deploy-dashboard</Text>
        <Text style={styles.headerText}>{time.toLocaleTimeString('en-US', { hour12: false })}</Text>
      </View>
      <View style={styles.row}>
        <Panel title="Build">
          <View style={styles.status}>
            {done ? <Text style={styles.ok}>✔</Text> : <ActivityIndicator color="yellow" />}
            <Text>{done ? 'Deployed' : 'Deploying…'}</Text>
          </View>
          <ProgressBar progress={progress} />
        </Panel>
        <Panel title="Services">
          <Text>
            <Text style={styles.ok}>●</Text> api
          </Text>
          <Text>
            <Text style={styles.ok}>●</Text> web
          </Text>
          <Text>
            <Text style={styles.warn}>●</Text> queue
          </Text>
        </Panel>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 1,
  },
  headerText: { color: 'white', fontWeight: 'bold' },
  row: { flexDirection: 'row', gap: 1 },
  panel: { flex: 1, borderWidth: 1, borderRadius: 2, paddingHorizontal: 1, gap: 1 },
  panelTitle: { fontWeight: 'bold', color: 'cyan' },
  status: { flexDirection: 'row', gap: 1 },
  track: { height: 1, backgroundColor: '#333333' },
  fill: { height: 1, backgroundColor: 'green' },
  ok: { color: 'green' },
  warn: { color: 'yellow' },
});
